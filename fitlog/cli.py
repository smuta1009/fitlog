"""Интерфейс командной строки дневника тренировок."""

import argparse
import json
import re
import sys
from datetime import date, timedelta

from .db import FAILURE, KINDS, WARMUP, Diary, default_db_path

SET_RE = re.compile(r"^(\d+(?:[.,]\d+)?)[xх×\*](\d+)(?:[xх×\*](\d+))?$", re.IGNORECASE)


KIND_MARKS = {WARMUP: " (разм.)", FAILURE: " (отказ)"}


def parse_sets(tokens: list[str]) -> list[tuple[float, int]]:
    """Разбирает подходы: '60x10' — один подход, '60x10x3' — три подхода по 10."""
    result = []
    for token in tokens:
        m = SET_RE.match(token.strip())
        if not m:
            raise argparse.ArgumentTypeError(
                f"Не понял подход '{token}'. Формат: ВЕСxПОВТОРЫ или ВЕСxПОВТОРЫxПОДХОДЫ, напр. 60x10x3"
            )
        weight = float(m.group(1).replace(",", "."))
        reps = int(m.group(2))
        count = int(m.group(3) or 1)
        result.extend([(weight, reps)] * count)
    return result


def parse_day(value: str) -> str:
    aliases = {"today": 0, "сегодня": 0, "yesterday": 1, "вчера": 1}
    if value.lower() in aliases:
        return (date.today() - timedelta(days=aliases[value.lower()])).isoformat()
    try:
        return date.fromisoformat(value).isoformat()
    except ValueError:
        raise argparse.ArgumentTypeError(f"Неверная дата '{value}', нужен формат ГГГГ-ММ-ДД")


def fmt_weight(w: float) -> str:
    return f"{w:g}"


def print_workout(w) -> None:
    print(f"📅 {w.day}" + (f"  — {w.note}" if w.note else ""))
    groups: dict[str, list] = {}
    for s in w.sets:
        groups.setdefault(s.exercise, []).append(s)
    for exercise, sets in groups.items():
        sets_str = ", ".join(f"{fmt_weight(s.weight)}×{s.reps}{KIND_MARKS.get(s.kind, '')}"
                             for s in sets)
        print(f"   • {exercise}: {sets_str}")
    print(f"   Объём: {fmt_weight(w.volume)} кг, подходов: {len(w.sets)}")


def cmd_log(diary: Diary, args) -> None:
    sets = [(w, r, args.kind) for w, r in parse_sets(args.sets)]
    diary.log(args.exercise, sets, day=args.date, note=args.note)
    print(f"✅ Записано {len(sets)} подх. «{args.exercise}» на {args.date}")


def cmd_list(diary: Diary, args) -> None:
    workouts = diary.recent(args.limit)
    if not workouts:
        print("Пока нет ни одной тренировки. Начни с: fitlog log \"жим лёжа\" 60x10x3")
        return
    for w in workouts:
        print_workout(w)
        print()


def cmd_show(diary: Diary, args) -> None:
    w = diary.get(args.date)
    if not w:
        print(f"Тренировки за {args.date} нет")
        sys.exit(1)
    print_workout(w)


def cmd_delete(diary: Diary, args) -> None:
    if diary.delete(args.date):
        print(f"🗑  Тренировка за {args.date} удалена")
    else:
        print(f"Тренировки за {args.date} нет")
        sys.exit(1)


def cmd_stats(diary: Diary, args) -> None:
    names = [args.exercise] if args.exercise else diary.exercises()
    if not names:
        print("Статистики пока нет")
        return
    for name in names:
        st = diary.stats(name)
        if not st:
            if not args.exercise:
                continue
            print(f"По упражнению «{name}» нет рабочих подходов")
            sys.exit(1)
        print(f"🏋  {st.exercise}")
        print(f"   Тренировок: {st.sessions}, подходов: {st.total_sets}, "
              f"объём: {fmt_weight(st.total_volume)} кг")
        print(f"   Рекорд веса: {fmt_weight(st.best_weight)} кг, "
              f"расчётный 1ПМ: {st.best_one_rep_max:.1f} кг")
        if args.exercise:
            print("   История:")
            hist = diary.history(name)
            top = max(orm for _, _, orm in hist)
            for day, best, orm in hist:
                bar = "█" * max(1, round(orm / top * 30))
                print(f"   {day}  {fmt_weight(best):>6} кг  1ПМ {orm:6.1f}  {bar}")


def cmd_exercises(diary: Diary, args) -> None:
    for name in diary.exercises():
        print(name)


def cmd_export(diary: Diary, args) -> None:
    data = diary.export_data()
    with open(args.file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    print(f"💾 Сохранено тренировок: {len(data['workouts'])} → {args.file}")


def cmd_import(diary: Diary, args) -> None:
    with open(args.file, encoding="utf-8") as f:
        count = diary.import_data(json.load(f))
    print(f"📥 Загружено тренировок: {count}")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="fitlog", description="Дневник тренировок")
    p.add_argument("--db", default=None, help="путь к файлу базы (по умолчанию ~/.fitlog/fitlog.db)")
    sub = p.add_subparsers(dest="command", required=True)

    s = sub.add_parser("log", help="записать подходы")
    s.add_argument("exercise", help="название упражнения")
    s.add_argument("sets", nargs="+", help="подходы: 60x10 или 60x10x3")
    s.add_argument("-d", "--date", type=parse_day, default=date.today().isoformat(),
                   help="дата (ГГГГ-ММ-ДД, today, вчера...)")
    s.add_argument("-n", "--note", help="заметка к тренировке")
    s.add_argument("-k", "--kind", choices=KINDS, default="work",
                   help="тип подходов: warmup — разминочный, work — рабочий, failure — отказной")
    s.set_defaults(func=cmd_log)

    s = sub.add_parser("list", help="последние тренировки")
    s.add_argument("-l", "--limit", type=int, default=10)
    s.set_defaults(func=cmd_list)

    s = sub.add_parser("show", help="показать тренировку за день")
    s.add_argument("date", type=parse_day, nargs="?", default=date.today().isoformat())
    s.set_defaults(func=cmd_show)

    s = sub.add_parser("delete", help="удалить тренировку за день")
    s.add_argument("date", type=parse_day)
    s.set_defaults(func=cmd_delete)

    s = sub.add_parser("stats", help="статистика и рекорды")
    s.add_argument("exercise", nargs="?", help="упражнение (без него — по всем)")
    s.set_defaults(func=cmd_stats)

    s = sub.add_parser("exercises", help="список упражнений")
    s.set_defaults(func=cmd_exercises)

    s = sub.add_parser("export", help="сохранить все тренировки в JSON (для переноса на телефон)")
    s.add_argument("file", help="куда сохранить, напр. fitlog.json")
    s.set_defaults(func=cmd_export)

    s = sub.add_parser("import", help="загрузить тренировки из JSON (например, из веб-версии)")
    s.add_argument("file")
    s.set_defaults(func=cmd_import)
    return p


def main(argv: list[str] | None = None) -> None:
    for stream in (sys.stdout, sys.stderr):
        if hasattr(stream, "reconfigure"):
            stream.reconfigure(encoding="utf-8")
    parser = build_parser()
    args = parser.parse_args(argv)
    diary = Diary(args.db or default_db_path())
    try:
        args.func(diary, args)
    except (ValueError, KeyError, TypeError, OSError, json.JSONDecodeError,
            argparse.ArgumentTypeError) as e:
        parser.error(str(e))
    finally:
        diary.close()
