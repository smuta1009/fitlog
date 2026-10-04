import argparse
import sqlite3
import tempfile
import unittest
from pathlib import Path

from fitlog.catalog import display_name, group_of
from fitlog.cli import parse_sets
from fitlog.db import FAILURE, WARMUP, WORK, Diary, Set


class ParseSetsTest(unittest.TestCase):
    def test_single_and_multiple(self):
        self.assertEqual(parse_sets(["60x10"]), [(60.0, 10)])
        self.assertEqual(parse_sets(["60x10x3"]), [(60.0, 10)] * 3)

    def test_decimal_and_cyrillic_x(self):
        self.assertEqual(parse_sets(["22,5х8"]), [(22.5, 8)])

    def test_invalid(self):
        with self.assertRaises(argparse.ArgumentTypeError):
            parse_sets(["abc"])


class DiaryTest(unittest.TestCase):
    def setUp(self):
        self.d = Diary(":memory:")

    def tearDown(self):
        self.d.close()

    def test_log_appends_to_same_day(self):
        self.d.log("Жим  лёжа", [(60, 10)], day="2026-10-01")
        self.d.log("присед", [(80, 5), (80, 5)], day="2026-10-01", note="тяжело")
        w = self.d.get("2026-10-01")
        self.assertEqual(len(w.sets), 3)
        self.assertEqual(w.sets[0].exercise, "жим лёжа")
        self.assertEqual(w.note, "тяжело")
        self.assertEqual(w.volume, 600 + 800)

    def test_stats_and_history(self):
        self.d.log("жим", [(60, 10)], day="2026-10-01")
        self.d.log("жим", [(70, 5), (75, 1)], day="2026-10-03")
        st = self.d.stats("ЖИМ")
        self.assertEqual(st.sessions, 2)
        self.assertEqual(st.total_sets, 3)
        self.assertEqual(st.best_weight, 75)
        self.assertAlmostEqual(st.best_one_rep_max, 70 * (1 + 5 / 30))  # 70x5 лучше 60x10
        self.assertEqual([h[0] for h in self.d.history("жим")], ["2026-10-01", "2026-10-03"])

    def test_delete_cascades(self):
        self.d.log("жим", [(60, 10)], day="2026-10-01")
        self.assertTrue(self.d.delete("2026-10-01"))
        self.assertIsNone(self.d.stats("жим"))
        self.assertFalse(self.d.delete("2026-10-01"))

    def test_validation(self):
        with self.assertRaises(ValueError):
            self.d.log("жим", [(60, 0)])
        with self.assertRaises(ValueError):
            self.d.log("жим", [(60, 10)], day="01.10.2026")

    def test_save_exercise_replaces_and_keeps_order(self):
        day = "2026-10-01"
        self.d.save_exercise(day, "жим", [(60, 10), (60, 10)])
        self.d.save_exercise(day, "присед", [(100, 5)])
        self.d.save_exercise(day, "жим", [(40, 12, WARMUP), (70, 5), (70, 4, FAILURE)])
        sets = self.d.get(day).sets
        self.assertEqual([s.exercise for s in sets], ["жим", "жим", "присед", "жим"])
        self.assertEqual([(s.weight, s.kind) for s in self.d.exercise_sets(day, "жим")],
                         [(40, WARMUP), (70, WORK), (70, FAILURE)])
        self.d.save_exercise(day, "жим", [(70, 5)])
        self.assertEqual(len(self.d.exercise_sets(day, "жим")), 1)

    def test_save_empty_removes_exercise_and_workout(self):
        self.d.save_exercise("2026-10-01", "жим", [(60, 10)])
        self.d.save_exercise("2026-10-01", "жим", [])
        self.assertIsNone(self.d.get("2026-10-01"))
        self.d.save_exercise("2026-10-02", "жим", [])  # нет тренировки — ничего не ломается
        self.assertIsNone(self.d.get("2026-10-02"))

    def test_previous_sessions(self):
        for day, w in [("2026-09-01", 50), ("2026-09-05", 55), ("2026-09-09", 60), ("2026-09-12", 65)]:
            self.d.save_exercise(day, "жим", [(w, 10)])
        self.d.save_exercise("2026-09-10", "присед", [(100, 5)])
        prev = self.d.previous_sessions("жим", "2026-09-12")
        self.assertEqual([(d, sets[0].weight) for d, sets in prev],
                         [("2026-09-09", 60), ("2026-09-05", 55)])
        self.assertEqual(self.d.previous_sessions("жим", "2026-09-01"), [])

    def test_stats_ignore_warmup(self):
        self.d.save_exercise("2026-10-01", "жим", [(100, 1, WARMUP), (60, 10)])
        st = self.d.stats("жим")
        self.assertEqual((st.total_sets, st.best_weight), (1, 60))
        self.d.save_exercise("2026-10-02", "тяга", [(40, 10, WARMUP)])
        self.assertIsNone(self.d.stats("тяга"))

    def test_workout_days(self):
        self.d.log("жим", [(60, 10)], day="2026-10-01")
        self.d.log("жим", [(60, 10)], day="2026-11-01")
        self.assertEqual(self.d.workout_days(2026, 10), {"2026-10-01"})

    def test_export_import_roundtrip(self):
        self.d.save_exercise("2026-10-01", "жим", [(40, 12, WARMUP), (60, 10)])
        self.d.set_note("2026-10-01", "ок")
        data = self.d.export_data()
        other = Diary(":memory:")
        other.log("присед", [(100, 5)], day="2026-10-01")  # будет заменено
        self.assertEqual(other.import_data(data), 1)
        w = other.get("2026-10-01")
        self.assertEqual(w.note, "ок")
        self.assertEqual([(s.exercise, s.weight, s.kind) for s in w.sets],
                         [("жим", 40, WARMUP), ("жим", 60, WORK)])
        with self.assertRaises(ValueError):
            other.import_data({"foo": 1})
        other.close()

    def test_one_rep_max_single(self):
        self.assertEqual(Set("x", 100, 1).one_rep_max, 100)


class MigrationTest(unittest.TestCase):
    def test_old_database_gets_kind_column(self):
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "old.db"
            conn = sqlite3.connect(path)
            conn.executescript("""
                CREATE TABLE workouts (id INTEGER PRIMARY KEY, day TEXT NOT NULL UNIQUE,
                                       note TEXT NOT NULL DEFAULT '');
                CREATE TABLE sets (id INTEGER PRIMARY KEY, workout_id INTEGER NOT NULL,
                                   exercise TEXT NOT NULL, weight REAL NOT NULL, reps INTEGER NOT NULL);
                INSERT INTO workouts (id, day) VALUES (1, '2026-10-01');
                INSERT INTO sets (workout_id, exercise, weight, reps) VALUES (1, 'жим', 60, 10);
            """)
            conn.commit()
            conn.close()
            d = Diary(path)
            self.assertEqual(d.get("2026-10-01").sets[0].kind, WORK)
            d.close()


class CatalogTest(unittest.TestCase):
    def test_names(self):
        self.assertEqual(display_name("жим штанги лёжа"), "Жим штанги лёжа")
        self.assertEqual(group_of("подтягивания"), "Спина")
        self.assertEqual(display_name("мой жим"), "Мой жим")
        self.assertEqual(group_of("мой жим"), "Мои")


if __name__ == "__main__":
    unittest.main()
