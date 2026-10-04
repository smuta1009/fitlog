"""Хранилище тренировок на SQLite."""

import os
import sqlite3
from dataclasses import dataclass
from datetime import date
from pathlib import Path

WARMUP, WORK, FAILURE = "warmup", "work", "failure"
KINDS = (WARMUP, WORK, FAILURE)

SCHEMA = """
CREATE TABLE IF NOT EXISTS workouts (
    id    INTEGER PRIMARY KEY,
    day   TEXT NOT NULL UNIQUE,
    note  TEXT NOT NULL DEFAULT ''
);
CREATE TABLE IF NOT EXISTS sets (
    id          INTEGER PRIMARY KEY,
    workout_id  INTEGER NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    exercise    TEXT NOT NULL,
    weight      REAL NOT NULL,
    reps        INTEGER NOT NULL,
    kind        TEXT NOT NULL DEFAULT 'work'
);
CREATE INDEX IF NOT EXISTS idx_sets_exercise ON sets(exercise);
"""


@dataclass
class Set:
    exercise: str
    weight: float
    reps: int
    kind: str = WORK
    id: int | None = None

    @property
    def volume(self) -> float:
        return self.weight * self.reps

    @property
    def one_rep_max(self) -> float:
        """Оценка разового максимума по формуле Эпли."""
        if self.reps == 1:
            return self.weight
        return self.weight * (1 + self.reps / 30)


@dataclass
class Workout:
    id: int
    day: str
    note: str
    sets: list[Set]

    @property
    def volume(self) -> float:
        return sum(s.volume for s in self.sets)


@dataclass
class ExerciseStats:
    exercise: str
    sessions: int
    total_sets: int
    total_volume: float
    best_weight: float
    best_one_rep_max: float


def default_db_path() -> Path:
    if env := os.environ.get("FITLOG_DB"):
        return Path(env)
    return Path.home() / ".fitlog" / "fitlog.db"


def normalize_exercise(name: str) -> str:
    return " ".join(name.split()).lower()


SetInput = tuple[float, int] | tuple[float, int, str]


def _validate(exercise: str, sets: list[SetInput]) -> tuple[str, list[tuple[float, int, str]]]:
    exercise = normalize_exercise(exercise)
    if not exercise:
        raise ValueError("Название упражнения не может быть пустым")
    result = []
    for s in sets:
        weight, reps, kind = (*s, WORK) if len(s) == 2 else s
        if weight < 0 or reps <= 0:
            raise ValueError(f"Некорректный подход: {weight}x{reps}")
        if kind not in KINDS:
            raise ValueError(f"Неизвестный тип подхода: {kind}")
        result.append((weight, reps, kind))
    return exercise, result


class Diary:
    def __init__(self, path: Path | str):
        if str(path) != ":memory:":
            Path(path).parent.mkdir(parents=True, exist_ok=True)
        self.conn = sqlite3.connect(path)
        self.conn.execute("PRAGMA foreign_keys = ON")
        self.conn.executescript(SCHEMA)
        self._migrate()

    def _migrate(self) -> None:
        columns = {r[1] for r in self.conn.execute("PRAGMA table_info(sets)")}
        if "kind" not in columns:
            with self.conn:
                self.conn.execute("ALTER TABLE sets ADD COLUMN kind TEXT NOT NULL DEFAULT 'work'")

    def close(self) -> None:
        self.conn.close()

    def _workout_id(self, day: str, create: bool) -> int | None:
        row = self.conn.execute("SELECT id FROM workouts WHERE day = ?", (day,)).fetchone()
        if row:
            return row[0]
        if not create:
            return None
        return self.conn.execute("INSERT INTO workouts (day) VALUES (?)", (day,)).lastrowid

    def _drop_empty_workouts(self) -> None:
        self.conn.execute(
            "DELETE FROM workouts WHERE id NOT IN (SELECT DISTINCT workout_id FROM sets)")

    def log(self, exercise: str, sets: list[SetInput], day: str | None = None,
            note: str | None = None) -> int:
        """Добавляет подходы в тренировку за указанный день (создаёт её при необходимости)."""
        day = day or date.today().isoformat()
        date.fromisoformat(day)  # проверка формата
        exercise, sets = _validate(exercise, sets)
        with self.conn:
            wid = self._workout_id(day, create=True)
            self.conn.executemany(
                "INSERT INTO sets (workout_id, exercise, weight, reps, kind) VALUES (?, ?, ?, ?, ?)",
                [(wid, exercise, w, r, k) for w, r, k in sets],
            )
            if note is not None:
                self.conn.execute("UPDATE workouts SET note = ? WHERE id = ?", (note, wid))
        return wid

    def save_exercise(self, day: str, exercise: str, sets: list[SetInput]) -> None:
        """Заменяет подходы упражнения за день; порядок упражнений в тренировке сохраняется.

        Пустой список удаляет упражнение из тренировки.
        """
        date.fromisoformat(day)
        exercise, sets = _validate(exercise, sets)
        with self.conn:
            wid = self._workout_id(day, create=bool(sets))
            if wid is None:
                return
            old_ids = [r[0] for r in self.conn.execute(
                "SELECT id FROM sets WHERE workout_id = ? AND exercise = ? ORDER BY id",
                (wid, exercise))]
            for set_id, (w, r, k) in zip(old_ids, sets):
                self.conn.execute("UPDATE sets SET weight = ?, reps = ?, kind = ? WHERE id = ?",
                                  (w, r, k, set_id))
            self.conn.executemany(
                "INSERT INTO sets (workout_id, exercise, weight, reps, kind) VALUES (?, ?, ?, ?, ?)",
                [(wid, exercise, w, r, k) for w, r, k in sets[len(old_ids):]],
            )
            self.conn.executemany("DELETE FROM sets WHERE id = ?",
                                  [(i,) for i in old_ids[len(sets):]])
            self._drop_empty_workouts()

    def get(self, day: str) -> Workout | None:
        row = self.conn.execute(
            "SELECT id, day, note FROM workouts WHERE day = ?", (day,)
        ).fetchone()
        return self._load(row) if row else None

    def _load(self, row) -> Workout:
        sets = [
            Set(*r)
            for r in self.conn.execute(
                "SELECT exercise, weight, reps, kind, id FROM sets WHERE workout_id = ? ORDER BY id",
                (row[0],),
            )
        ]
        return Workout(row[0], row[1], row[2], sets)

    def exercise_sets(self, day: str, exercise: str) -> list[Set]:
        exercise = normalize_exercise(exercise)
        return [Set(*r) for r in self.conn.execute(
            """SELECT s.exercise, s.weight, s.reps, s.kind, s.id FROM sets s
               JOIN workouts w ON w.id = s.workout_id
               WHERE w.day = ? AND s.exercise = ? ORDER BY s.id""",
            (day, exercise))]

    def previous_sessions(self, exercise: str, before: str, count: int = 2) -> list[tuple[str, list[Set]]]:
        """Последние тренировки с этим упражнением до указанной даты, от новых к старым."""
        exercise = normalize_exercise(exercise)
        days = [r[0] for r in self.conn.execute(
            """SELECT DISTINCT w.day FROM workouts w JOIN sets s ON s.workout_id = w.id
               WHERE s.exercise = ? AND w.day < ? ORDER BY w.day DESC LIMIT ?""",
            (exercise, before, count))]
        return [(d, self.exercise_sets(d, exercise)) for d in days]

    def workout_days(self, year: int, month: int) -> set[str]:
        prefix = f"{year:04d}-{month:02d}-"
        return {r[0] for r in self.conn.execute(
            "SELECT day FROM workouts WHERE day LIKE ?", (prefix + "%",))}

    def recent(self, limit: int = 10) -> list[Workout]:
        rows = self.conn.execute(
            "SELECT id, day, note FROM workouts ORDER BY day DESC LIMIT ?", (limit,)
        ).fetchall()
        return [self._load(r) for r in rows]

    def delete(self, day: str) -> bool:
        with self.conn:
            cur = self.conn.execute("DELETE FROM workouts WHERE day = ?", (day,))
        return cur.rowcount > 0

    def set_note(self, day: str, note: str) -> bool:
        with self.conn:
            cur = self.conn.execute("UPDATE workouts SET note = ? WHERE day = ?", (note, day))
        return cur.rowcount > 0

    def delete_set(self, set_id: int) -> None:
        """Удаляет подход; опустевшая тренировка удаляется вместе с ним."""
        with self.conn:
            self.conn.execute("DELETE FROM sets WHERE id = ?", (set_id,))
            self._drop_empty_workouts()

    def export_data(self) -> dict:
        """Все тренировки в формате, общем с веб-версией (JSON)."""
        workouts = []
        for wid, day, note in self.conn.execute("SELECT id, day, note FROM workouts ORDER BY day"):
            sets = [{"exercise": e, "weight": w, "reps": r, "kind": k} for e, w, r, k in self.conn.execute(
                "SELECT exercise, weight, reps, kind FROM sets WHERE workout_id = ? ORDER BY id", (wid,))]
            workouts.append({"day": day, "note": note, "sets": sets})
        return {"app": "fitlog", "version": 1, "workouts": workouts}

    def import_data(self, data: dict) -> int:
        """Загружает тренировки; записи за совпадающие дни заменяются. Возвращает число дней."""
        if not isinstance(data, dict) or not isinstance(data.get("workouts"), list):
            raise ValueError("Это не файл Fitlog")
        parsed = []
        for w in data["workouts"]:
            day = w["day"]
            date.fromisoformat(day)
            sets = [_validate(s["exercise"], [(float(s["weight"]), int(s["reps"]), s.get("kind", WORK))])
                    for s in w["sets"]]
            parsed.append((day, w.get("note", ""), [(ex, *vals[0]) for ex, vals in sets]))
        with self.conn:
            for day, note, sets in parsed:
                self.conn.execute("DELETE FROM workouts WHERE day = ?", (day,))
                if not sets:
                    continue
                wid = self.conn.execute("INSERT INTO workouts (day, note) VALUES (?, ?)",
                                        (day, note)).lastrowid
                self.conn.executemany(
                    "INSERT INTO sets (workout_id, exercise, weight, reps, kind) VALUES (?, ?, ?, ?, ?)",
                    [(wid, *s) for s in sets])
        return sum(1 for _, _, sets in parsed if sets)

    def exercises(self) -> list[str]:
        return [r[0] for r in self.conn.execute(
            "SELECT DISTINCT exercise FROM sets ORDER BY exercise")]

    def stats(self, exercise: str) -> ExerciseStats | None:
        """Статистика по рабочим и отказным подходам (разминка не учитывается)."""
        exercise = normalize_exercise(exercise)
        rows = self.conn.execute(
            "SELECT workout_id, weight, reps FROM sets WHERE exercise = ? AND kind != ?",
            (exercise, WARMUP),
        ).fetchall()
        if not rows:
            return None
        sets = [Set(exercise, w, r) for _, w, r in rows]
        return ExerciseStats(
            exercise=exercise,
            sessions=len({wid for wid, _, _ in rows}),
            total_sets=len(sets),
            total_volume=sum(s.volume for s in sets),
            best_weight=max(s.weight for s in sets),
            best_one_rep_max=max(s.one_rep_max for s in sets),
        )

    def history(self, exercise: str) -> list[tuple[str, float, float]]:
        """По дням: (дата, лучший вес, лучший расчётный 1ПМ); разминка не учитывается."""
        exercise = normalize_exercise(exercise)
        rows = self.conn.execute(
            """SELECT w.day, s.weight, s.reps FROM sets s
               JOIN workouts w ON w.id = s.workout_id
               WHERE s.exercise = ? AND s.kind != ? ORDER BY w.day""",
            (exercise, WARMUP),
        ).fetchall()
        by_day: dict[str, list[Set]] = {}
        for day, weight, reps in rows:
            by_day.setdefault(day, []).append(Set(exercise, weight, reps))
        return [
            (day, max(s.weight for s in sets), max(s.one_rep_max for s in sets))
            for day, sets in by_day.items()
        ]
