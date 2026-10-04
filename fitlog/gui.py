"""Оконное приложение дневника тренировок."""

import calendar
import sys
import tkinter as tk
from datetime import date
from functools import cache
from pathlib import Path
from tkinter import messagebox

import customtkinter as ctk

from .catalog import CATALOG, CUSTOM_GROUP, display_name, group_of, is_custom
from .db import FAILURE, WARMUP, WORK, Diary, Set, default_db_path, normalize_exercise

# ---------- оформление: пары цветов (светлая тема, тёмная тема) ----------
BG = ("#F4F4F6", "#0F0F11")
SURFACE = ("#FFFFFF", "#1A1A1D")
FIELD = ("#F1F1F4", "#25252A")
HOVER = ("#E8E8EC", "#2E2E33")
TEXT = ("#111114", "#EDEDF0")
MUTED = ("#71717A", "#8B8B94")
ACCENT = ("#4F46E5", "#6366F1")
ACCENT_HOVER = ("#4338CA", "#5458E8")
ACCENT_SOFT = ("#EEF0FF", "#25254D")
WHITE = ("#FFFFFF", "#FFFFFF")
DANGER = ("#DC2626", "#F87171")
TREND = ("#0D9488", "#2DD4BF")

KIND_LABELS = {WARMUP: "Разминочный", WORK: "Рабочий", FAILURE: "Отказной"}
KIND_BY_LABEL = {v: k for k, v in KIND_LABELS.items()}
KIND_FG = {WARMUP: ("#B45309", "#FBBF24"), WORK: ACCENT, FAILURE: ("#DC2626", "#F87171")}
KIND_BG = {WARMUP: ("#FEF3C7", "#352A10"), WORK: ACCENT_SOFT, FAILURE: ("#FEE2E2", "#3B1818")}

WEEKDAYS = ["понедельник", "вторник", "среда", "четверг", "пятница", "суббота", "воскресенье"]
MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
          "сентября", "октября", "ноября", "декабря"]
MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август",
              "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"]
MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"]


def human_date(d: date) -> str:
    return f"{d.day} {MONTHS[d.month - 1]}, {WEEKDAYS[d.weekday()]}"


def short_date(d: date | str) -> str:
    if isinstance(d, str):
        d = date.fromisoformat(d)
    return f"{d.day} {MONTHS_SHORT[d.month - 1]}"


def fmt(x: float) -> str:
    return f"{x:g}"


def set_text(s: Set) -> str:
    return f"{fmt(s.weight)} × {s.reps}" if s.weight else f"{s.reps} повт."


def plural(n: int, one: str, few: str, many: str) -> str:
    if n % 10 == 1 and n % 100 != 11:
        return one
    if 2 <= n % 10 <= 4 and not 12 <= n % 100 <= 14:
        return few
    return many


def pick(color: tuple[str, str]) -> str:
    return color[1] if ctk.get_appearance_mode() == "Dark" else color[0]


def asset_path(name: str) -> Path:
    base = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent.parent))
    return base / "assets" / name


@cache
def font(size: int = 14, weight: str = "normal") -> ctk.CTkFont:
    return ctk.CTkFont(size=size, weight=weight)


def ghost_button(master, text: str, command, **kw) -> ctk.CTkButton:
    opts = dict(fg_color="transparent", hover_color=HOVER, text_color=TEXT, height=34,
                corner_radius=8, font=font(13), width=10)
    opts.update(kw)
    return ctk.CTkButton(master, text=text, command=command, **opts)


def accent_button(master, text: str, command, **kw) -> ctk.CTkButton:
    opts = dict(fg_color=ACCENT, hover_color=ACCENT_HOVER, text_color=WHITE, height=34,
                corner_radius=8, font=font(13, "bold"), width=10)
    opts.update(kw)
    return ctk.CTkButton(master, text=text, command=command, **opts)


def card(master, **kw) -> ctk.CTkFrame:
    return ctk.CTkFrame(master, fg_color=SURFACE, corner_radius=16, **kw)


def chip(master, s: Set) -> ctk.CTkLabel:
    return ctk.CTkLabel(master, text=set_text(s), fg_color=KIND_BG[s.kind], text_color=KIND_FG[s.kind],
                        corner_radius=8, font=font(12, "bold"), height=26, padx=8)


# ---------- приложение ----------

class App(ctk.CTk):
    def __init__(self, diary: Diary):
        super().__init__(fg_color=BG)
        self.diary = diary
        self.title("Fitlog — дневник тренировок")
        self.geometry("1200x760")
        self.minsize(1120, 660)
        self.after(0, lambda: self.state("zoomed"))
        icon = asset_path("fitlog.ico")
        if icon.exists():
            self.iconbitmap(str(icon))

        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        sidebar = ctk.CTkFrame(self, width=210, corner_radius=0, fg_color=SURFACE)
        sidebar.grid(row=0, column=0, sticky="ns")
        sidebar.grid_propagate(False)
        sidebar.grid_columnconfigure(0, weight=1)
        sidebar.grid_rowconfigure(5, weight=1)

        logo = ctk.CTkFrame(sidebar, fg_color="transparent")
        logo.grid(row=0, column=0, padx=20, pady=(26, 30), sticky="w")
        ctk.CTkLabel(logo, text="F", width=34, height=34, corner_radius=10, fg_color=ACCENT,
                     text_color=WHITE, font=font(17, "bold")).pack(side="left")
        ctk.CTkLabel(logo, text="Fitlog", font=font(20, "bold"), text_color=TEXT).pack(
            side="left", padx=10)

        self.pages = {"diary": DiaryPage(self, self), "history": HistoryPage(self, self),
                      "progress": ProgressPage(self, self)}
        self.nav = {}
        for i, (key, title) in enumerate(
                [("diary", "Дневник"), ("history", "История"), ("progress", "Прогресс")]):
            btn = ctk.CTkButton(sidebar, text=title, anchor="w", height=40, corner_radius=10,
                                font=font(14), command=lambda k=key: self.show(k))
            btn.grid(row=i + 1, column=0, padx=14, pady=2, sticky="ew")
            self.nav[key] = btn

        ctk.CTkLabel(sidebar, text="Тема", text_color=MUTED, font=font(12)).grid(
            row=6, column=0, padx=22, pady=(0, 6), sticky="w")
        modes = {"Светлая": "light", "Тёмная": "dark", "Авто": "system"}
        theme = ctk.CTkSegmentedButton(
            sidebar, values=list(modes), font=font(12), height=30, corner_radius=8,
            fg_color=FIELD, unselected_color=FIELD, unselected_hover_color=HOVER,
            selected_color=("#FFFFFF", "#3A3A41"), selected_hover_color=("#FFFFFF", "#3A3A41"),
            text_color=TEXT, command=lambda v: self.set_mode(modes[v]))
        theme.set("Авто")
        theme.grid(row=7, column=0, padx=16, pady=(0, 22), sticky="ew")

        for page in self.pages.values():
            page.grid(row=0, column=1, sticky="nsew", padx=28, pady=26)
        self.current = "diary"
        self.show("diary")

    def show(self, key: str) -> None:
        self.current = key
        for k, btn in self.nav.items():
            active = k == key
            btn.configure(fg_color=ACCENT_SOFT if active else "transparent",
                          text_color=ACCENT if active else MUTED,
                          hover_color=ACCENT_SOFT if active else HOVER,
                          font=font(14, "bold") if active else font(14))
        page = self.pages[key]
        page.refresh()
        page.tkraise()

    def open_day(self, day: date) -> None:
        self.pages["diary"].select_day(day)
        self.show("diary")

    def set_mode(self, mode: str) -> None:
        ctk.set_appearance_mode(mode)
        self.after(50, self.pages["progress"].draw)


# ---------- календарь ----------

class Calendar(ctk.CTkFrame):
    def __init__(self, master, diary: Diary, on_select):
        super().__init__(master, fg_color=SURFACE, corner_radius=16)
        self.diary = diary
        self.on_select = on_select
        self.selected = date.today()
        self.month = self.selected.replace(day=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.pack(fill="x", padx=16, pady=(14, 6))
        self.title = ctk.CTkLabel(head, font=font(16, "bold"), text_color=TEXT)
        self.title.pack(side="left")
        ghost_button(head, "›", lambda: self.shift_month(1), width=30, height=30,
                     font=font(18)).pack(side="right")
        ghost_button(head, "‹", lambda: self.shift_month(-1), width=30, height=30,
                     font=font(18)).pack(side="right")

        grid = ctk.CTkFrame(self, fg_color="transparent")
        grid.pack(padx=12)
        for i, wd in enumerate(["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]):
            ctk.CTkLabel(grid, text=wd, text_color=MUTED, font=font(11), width=38, height=22).grid(
                row=0, column=i)
        self.cells = []
        for r in range(6):
            for c in range(7):
                b = ctk.CTkButton(grid, text="", width=36, height=36, corner_radius=18,
                                  font=font(13), border_color=ACCENT)
                b.grid(row=r + 1, column=c, padx=1, pady=1)
                self.cells.append(b)

        self.footer = ctk.CTkLabel(self, text="", text_color=MUTED, font=font(12))
        self.footer.pack(padx=18, pady=(6, 14), anchor="w")

    def shift_month(self, delta: int) -> None:
        m = self.month.month - 1 + delta
        self.month = date(self.month.year + m // 12, m % 12 + 1, 1)
        self.render()

    def select(self, d: date) -> None:
        self.selected = d
        self.month = d.replace(day=1)
        self.render()

    def render(self) -> None:
        y, m = self.month.year, self.month.month
        self.title.configure(text=f"{MONTHS_NOM[m - 1]} {y}")
        marked = self.diary.workout_days(y, m)
        days = [d for week in calendar.Calendar().monthdatescalendar(y, m) for d in week]
        days += [None] * (42 - len(days))
        today = date.today()
        for btn, d in zip(self.cells, days):
            if d is None or d.month != m:
                btn.configure(text="", state="disabled", fg_color="transparent", border_width=0,
                              hover=False)
                continue
            is_marked = d.isoformat() in marked
            if d == self.selected:
                fg, tc, hover = ACCENT, WHITE, ACCENT_HOVER
            elif is_marked:
                fg, tc, hover = ACCENT_SOFT, ACCENT, HOVER
            else:
                fg, tc, hover = "transparent", TEXT, HOVER
            btn.configure(text=str(d.day), state="normal", fg_color=fg, text_color=tc,
                          hover_color=hover, hover=True,
                          font=font(13, "bold") if is_marked or d == today else font(13),
                          border_width=2 if d == today and d != self.selected else 0,
                          command=lambda d=d: self.on_select(d))
        n = len(marked)
        self.footer.configure(text=f"{n} {plural(n, 'тренировка', 'тренировки', 'тренировок')} за месяц")


# ---------- выбор упражнения ----------

class ExercisePicker(ctk.CTkFrame):
    def __init__(self, master, page: "DiaryPage"):
        super().__init__(master, fg_color=SURFACE, corner_radius=16)
        self.page = page
        self.group = "Все группы"
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(3, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew", padx=20, pady=(16, 10))
        ctk.CTkLabel(head, text="Выберите упражнение", font=font(17, "bold"), text_color=TEXT).pack(
            side="left")
        ghost_button(head, "Отмена", page.close_editor, text_color=MUTED).pack(side="right")

        bar = ctk.CTkFrame(self, fg_color="transparent")
        bar.grid(row=1, column=0, sticky="ew", padx=20, pady=(0, 6))
        self.search = ctk.CTkEntry(bar, placeholder_text="Поиск или название своего упражнения",
                                   height=38, border_width=0, fg_color=FIELD, corner_radius=10,
                                   font=font(14))
        self.search.pack(side="left", fill="x", expand=True)
        self.search.bind("<KeyRelease>", lambda e: self.apply_filter())
        self.search.bind("<Return>", lambda e: self.pick_first())
        self.groups = ctk.CTkOptionMenu(bar, values=["Все группы"], width=170, height=38,
                                        corner_radius=10, fg_color=FIELD, button_color=FIELD,
                                        button_hover_color=HOVER, text_color=TEXT, font=font(13),
                                        dropdown_font=font(13), dynamic_resizing=False,
                                        command=self.set_group)
        self.groups.pack(side="left", padx=(8, 0))

        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=3, column=0, sticky="nsew", padx=8, pady=(0, 12))
        self.add_custom = accent_button(self.list, "", self.pick_custom, anchor="w")
        self.empty = ctk.CTkLabel(self.list, text="Ничего не найдено", text_color=MUTED)

        # секции справочника строятся один раз, свои упражнения — при каждом открытии
        self.sections: list[tuple[str, ctk.CTkLabel, list[tuple[str, ctk.CTkButton]]]] = []
        for group, names in CATALOG.items():
            self.sections.append(self._section(group, names))
        self.custom_section = None

    def _section(self, group: str, names: list[str]):
        header = ctk.CTkLabel(self.list, text=group.upper(), text_color=MUTED, font=font(11, "bold"),
                              anchor="w")
        items = []
        for name in names:
            norm = normalize_exercise(name)
            btn = ctk.CTkButton(self.list, text=display_name(norm), anchor="w", height=36,
                                fg_color="transparent", hover_color=HOVER, text_color=TEXT,
                                corner_radius=8, font=font(14),
                                command=lambda n=norm: self.page.open_editor(n))
            items.append((norm, btn))
        return group, header, items

    def open(self) -> None:
        if self.custom_section:
            _, header, items = self.custom_section
            header.destroy()
            for _, btn in items:
                btn.destroy()
        custom = [e for e in self.page.app.diary.exercises() if is_custom(e)]
        self.custom_section = self._section(CUSTOM_GROUP, custom) if custom else None

        groups = ["Все группы", *CATALOG] + ([CUSTOM_GROUP] if custom else [])
        self.groups.configure(values=groups)
        if self.group not in groups:
            self.group = "Все группы"
        self.search.delete(0, "end")
        self.set_group(self.group)
        self.search.focus()

    def set_group(self, group: str) -> None:
        self.group = group
        self.groups.set(group)
        self.apply_filter()

    def visible_sections(self):
        sections = self.sections + ([self.custom_section] if self.custom_section else [])
        query = normalize_exercise(self.search.get())
        for group, header, items in sections:
            if self.group not in ("Все группы", group):
                continue
            shown = [(n, b) for n, b in items if query in n]
            if shown:
                yield group, header, shown

    def apply_filter(self) -> None:
        for child in self.list.winfo_children():
            child.pack_forget()
        query = " ".join(self.search.get().split())
        all_names = {n for _, _, items in self.sections + [self.custom_section or ("", None, [])]
                     for n, _ in items}
        if query and normalize_exercise(query) not in all_names:
            self.add_custom.configure(text=f"+  Добавить своё упражнение «{query}»")
            self.add_custom.pack(fill="x", padx=8, pady=(4, 8))
        any_shown = False
        for _, header, shown in self.visible_sections():
            any_shown = True
            header.pack(fill="x", padx=12, pady=(10, 2))
            for _, btn in shown:
                btn.pack(fill="x", padx=4)
        if not any_shown and not query:
            self.empty.pack(pady=30)

    def pick_first(self) -> None:
        for _, _, shown in self.visible_sections():
            return self.page.open_editor(shown[0][0])
        if self.search.get().strip():
            self.pick_custom()

    def pick_custom(self) -> None:
        name = normalize_exercise(self.search.get())
        if name:
            self.page.open_editor(name)


# ---------- редактор подходов ----------

class SetEditor(ctk.CTkFrame):
    COLUMNS = ["#", "Тип подхода", "Вес, кг", "Повторы"]

    def __init__(self, master, page: "DiaryPage"):
        super().__init__(master, fg_color=SURFACE, corner_radius=16)
        self.page = page
        self.exercise = ""
        self.rows: list[list[str]] = []
        self.widgets: list[tuple[ctk.CTkOptionMenu, ctk.CTkEntry, ctk.CTkEntry]] = []
        self.prev: list[tuple[str, list[Set]]] = []

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.pack(fill="x", padx=20, pady=(16, 4))
        titles = ctk.CTkFrame(head, fg_color="transparent")
        titles.pack(side="left")
        self.name_label = ctk.CTkLabel(titles, font=font(18, "bold"), text_color=TEXT, anchor="w")
        self.name_label.pack(anchor="w")
        self.group_label = ctk.CTkLabel(titles, font=font(12), text_color=MUTED, anchor="w", height=16)
        self.group_label.pack(anchor="w")
        ghost_button(head, "Сменить упражнение", page.open_picker, text_color=MUTED).pack(side="right")

        self.table = ctk.CTkFrame(self, fg_color="transparent")
        self.table.pack(fill="x", padx=14, pady=(8, 0))

        foot = ctk.CTkFrame(self, fg_color="transparent")
        foot.pack(fill="x", padx=16, pady=(8, 16))
        ghost_button(foot, "+  Добавить подход", self.add_row, text_color=ACCENT).pack(side="left")
        accent_button(foot, "Сохранить", self.save, width=120).pack(side="right")
        ghost_button(foot, "Отмена", page.close_editor, text_color=MUTED).pack(side="right", padx=6)
        self.error = ctk.CTkLabel(foot, text="", text_color=DANGER, font=font(12))
        self.error.pack(side="left", padx=10)

    def load(self, exercise: str, day: date) -> None:
        diary = self.page.app.diary
        self.exercise = exercise
        self.name_label.configure(text=display_name(exercise))
        self.group_label.configure(text=group_of(exercise))
        existing = diary.exercise_sets(day.isoformat(), exercise)
        self.rows = ([[s.kind, fmt(s.weight), str(s.reps)] for s in existing]
                     or [[WORK, "", ""] for _ in range(3)])
        self.prev = diary.previous_sessions(exercise, day.isoformat(), 2)
        self.error.configure(text="")
        self.render()
        self.widgets[0][1].focus()

    def sync(self) -> None:
        self.rows = [[KIND_BY_LABEL[m.get()], w.get().strip(), r.get().strip()]
                     for m, w, r in self.widgets]

    def render(self) -> None:
        for child in self.table.winfo_children():
            child.destroy()
        self.widgets = []
        t = self.table

        headers = self.COLUMNS + [
            f"{title}\n{short_date(self.prev[k][0]) if k < len(self.prev) else '—'}"
            for k, title in enumerate(["Прошлая", "Позапрошлая"])]
        for col, text in enumerate(headers):
            ctk.CTkLabel(t, text=text, text_color=MUTED, font=font(11), justify="left",
                         anchor="w").grid(row=0, column=col, padx=5, pady=(0, 4), sticky="sw")

        for i, (kind, weight, reps) in enumerate(self.rows):
            row = i + 1
            ctk.CTkLabel(t, text=str(i + 1), text_color=MUTED, font=font(13), width=22).grid(
                row=row, column=0, padx=5, pady=3)
            menu = ctk.CTkOptionMenu(t, values=list(KIND_LABELS.values()), width=140, height=34,
                                     corner_radius=8, font=font(13, "bold"), dynamic_resizing=False,
                                     dropdown_font=font(13))
            menu.set(KIND_LABELS[kind])
            menu.configure(command=lambda v, m=menu: self.style_kind(m))
            self.style_kind(menu)
            menu.grid(row=row, column=1, padx=5, pady=3)

            entries = []
            for col, (value, width) in enumerate([(weight, 86), (reps, 76)], start=2):
                e = ctk.CTkEntry(t, width=width, height=34, border_width=0, fg_color=FIELD,
                                 corner_radius=8, justify="center", font=font(14))
                if value:
                    e.insert(0, value)
                e.bind("<Return>", lambda ev: self.save())
                e.grid(row=row, column=col, padx=5, pady=3)
                entries.append(e)
            self.widgets.append((menu, *entries))

            for k in range(2):
                sets = self.prev[k][1] if k < len(self.prev) else []
                s = sets[i] if i < len(sets) else None
                ctk.CTkLabel(t, text=set_text(s) if s else "—", width=96, anchor="w",
                             font=font(13, "bold") if s and s.kind != WORK else font(13),
                             text_color=KIND_FG[s.kind] if s and s.kind != WORK else
                             (TEXT if s else MUTED)).grid(row=row, column=4 + k, padx=5, pady=3,
                                                          sticky="w")

            ghost_button(t, "✕", lambda i=i: self.remove_row(i), width=30, height=30,
                         text_color=MUTED).grid(row=row, column=6, padx=(2, 0), pady=3)

        if not self.rows:
            ctk.CTkLabel(t, text="Подходов нет. При сохранении упражнение будет удалено из тренировки.",
                         text_color=MUTED, font=font(12)).grid(row=1, column=0, columnspan=7,
                                                               pady=10, sticky="w", padx=5)

    @staticmethod
    def style_kind(menu: ctk.CTkOptionMenu) -> None:
        kind = KIND_BY_LABEL[menu.get()]
        menu.configure(fg_color=KIND_BG[kind], button_color=KIND_BG[kind],
                       button_hover_color=KIND_BG[kind], text_color=KIND_FG[kind])

    def add_row(self) -> None:
        self.sync()
        last = self.rows[-1] if self.rows else [WORK, "", ""]
        self.rows.append(list(last))
        self.render()
        self.widgets[-1][1].focus()

    def remove_row(self, index: int) -> None:
        self.sync()
        self.rows.pop(index)
        self.render()

    def save(self) -> None:
        self.sync()
        sets = []
        for n, (kind, weight, reps) in enumerate(self.rows, 1):
            if not weight and not reps:
                continue
            try:
                w = float(weight.replace(",", ".")) if weight else 0.0
                r = int(reps)
            except ValueError:
                return self.error.configure(text=f"Подход {n}: вес и повторы должны быть числами")
            if r <= 0 or w < 0:
                return self.error.configure(text=f"Подход {n}: проверь вес и повторы")
            sets.append((w, r, kind))
        day = self.page.day.isoformat()
        if not sets and self.rows:
            return self.error.configure(text="Заполни хотя бы один подход")
        self.page.app.diary.save_exercise(day, self.exercise, sets)
        self.page.close_editor()


# ---------- дневник ----------

class DiaryPage(ctk.CTkFrame):
    def __init__(self, master, app: App):
        super().__init__(master, fg_color="transparent")
        self.app = app
        self.day = date.today()
        self.grid_columnconfigure(1, weight=1)
        self.grid_rowconfigure(0, weight=1)

        left = ctk.CTkFrame(self, fg_color="transparent")
        left.grid(row=0, column=0, sticky="ns", padx=(0, 24))
        self.calendar = Calendar(left, app.diary, self.select_day)
        self.calendar.pack()
        ghost_button(left, "Сегодня", lambda: self.select_day(date.today()), fg_color=SURFACE,
                     height=38, corner_radius=10).pack(fill="x", pady=(10, 0))
        legend = ctk.CTkFrame(left, fg_color="transparent")
        legend.pack(fill="x", pady=(18, 0), padx=4)
        ctk.CTkLabel(legend, text="Типы подходов", text_color=MUTED, font=font(12)).pack(anchor="w")
        for kind, label in KIND_LABELS.items():
            ctk.CTkLabel(legend, text=label, fg_color=KIND_BG[kind], text_color=KIND_FG[kind],
                         corner_radius=8, font=font(12, "bold"), height=26, padx=10).pack(
                anchor="w", pady=2)

        right = ctk.CTkFrame(self, fg_color="transparent")
        right.grid(row=0, column=1, sticky="nsew")
        right.grid_columnconfigure(0, weight=1)
        self.right = right

        head = ctk.CTkFrame(right, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew")
        head.grid_columnconfigure(0, weight=1)
        titles = ctk.CTkFrame(head, fg_color="transparent")
        titles.grid(row=0, column=0, sticky="w")
        self.title = ctk.CTkLabel(titles, font=font(26, "bold"), text_color=TEXT, anchor="w")
        self.title.pack(anchor="w")
        self.subtitle = ctk.CTkLabel(titles, text_color=MUTED, font=font(13), anchor="w")
        self.subtitle.pack(anchor="w")
        self.add_btn = accent_button(head, "+  Добавить упражнение", self.open_picker, height=40,
                                     corner_radius=10)
        self.add_btn.grid(row=0, column=1, sticky="e", padx=(16, 0))

        self.picker = ExercisePicker(right, self)
        self.editor = SetEditor(right, self)

        self.list = ctk.CTkScrollableFrame(right, fg_color="transparent")
        self.list.grid(row=2, column=0, sticky="nsew", pady=(10, 0))
        right.grid_rowconfigure(2, weight=1)

        self.note = ctk.CTkEntry(right, placeholder_text="Заметка к тренировке: самочувствие, сон…",
                                 height=40, border_width=0, fg_color=SURFACE, corner_radius=10,
                                 font=font(13))
        self.note.bind("<Return>", lambda e: self.save_note())
        self.note.bind("<FocusOut>", lambda e: self.save_note())
        self.mode = "idle"

    # --- переключение состояний ---

    def _layout(self, mode: str) -> None:
        self.mode = mode
        self.picker.grid_forget()
        self.editor.grid_forget()
        self.list.grid_forget()
        self.right.grid_rowconfigure(1, weight=0)
        self.right.grid_rowconfigure(2, weight=0)
        if mode == "pick":
            self.picker.grid(row=1, column=0, sticky="nsew", pady=(16, 0))
            self.right.grid_rowconfigure(1, weight=1)
            return
        if mode == "edit":
            self.editor.grid(row=1, column=0, sticky="ew", pady=(16, 0))
        self.list.grid(row=2, column=0, sticky="nsew", pady=(10, 0))
        self.right.grid_rowconfigure(2, weight=1)

    def open_picker(self) -> None:
        self._layout("pick")
        self.add_btn.grid_remove()
        self.picker.open()

    def open_editor(self, exercise: str) -> None:
        self.editor.load(exercise, self.day)
        self._layout("edit")
        self.add_btn.grid_remove()

    def close_editor(self) -> None:
        self._layout("idle")
        self.add_btn.grid()
        self.refresh()

    def select_day(self, d: date) -> None:
        self.save_note()
        self.day = d
        self.close_editor()

    def save_note(self) -> None:
        if self.note.winfo_ismapped():
            self.app.diary.set_note(self.day.isoformat(), self.note.get().strip())

    def delete_exercise(self, exercise: str) -> None:
        if messagebox.askyesno("Удалить упражнение",
                               f"Удалить «{display_name(exercise)}» из этой тренировки?", parent=self):
            self.app.diary.save_exercise(self.day.isoformat(), exercise, [])
            self.close_editor()

    # --- отрисовка ---

    def refresh(self) -> None:
        if self.mode == "idle":
            self._layout("idle")
        self.calendar.select(self.day)
        today = date.today()
        title = f"{self.day.day} {MONTHS[self.day.month - 1]}"
        if self.day.year != today.year:
            title += f" {self.day.year}"
        self.title.configure(text=title)
        weekday = WEEKDAYS[self.day.weekday()]
        weekday = f"Сегодня, {weekday}" if self.day == today else weekday.capitalize()
        for child in self.list.winfo_children():
            child.destroy()

        workout = self.app.diary.get(self.day.isoformat())
        self.note.grid_forget()
        if not workout:
            self.subtitle.configure(text=f"{weekday} · тренировки нет")
            if self.mode == "idle":
                empty = card(self.list)
                empty.pack(fill="x", pady=4)
                ctk.CTkLabel(empty, text="В этот день тренировки нет", font=font(16, "bold"),
                             text_color=TEXT).pack(pady=(40, 4))
                ctk.CTkLabel(empty, text="Нажми «Добавить упражнение», чтобы начать",
                             text_color=MUTED).pack(pady=(0, 40))
            return

        groups: dict[str, list[Set]] = {}
        for s in workout.sets:
            groups.setdefault(s.exercise, []).append(s)
        work_sets = sum(1 for s in workout.sets if s.kind != WARMUP)
        n = len(groups)
        self.subtitle.configure(
            text=f"{weekday} · {n} "
                 f"{plural(n, 'упражнение', 'упражнения', 'упражнений')} · "
                 f"{work_sets} {plural(work_sets, 'рабочий подход', 'рабочих подхода', 'рабочих подходов')}"
                 f" · объём {fmt(workout.volume)} кг")

        for exercise, sets in groups.items():
            self._exercise_card(exercise, sets)

        self.note.grid(row=3, column=0, sticky="ew", pady=(10, 0))
        self.note.delete(0, "end")
        if workout.note:
            self.note.insert(0, workout.note)

    def _exercise_card(self, exercise: str, sets: list[Set]) -> None:
        c = card(self.list)
        c.pack(fill="x", pady=5)
        c.grid_columnconfigure(0, weight=1)
        name = ctk.CTkLabel(c, text=display_name(exercise), font=font(15, "bold"), text_color=TEXT,
                            anchor="w", cursor="hand2")
        name.grid(row=0, column=0, padx=18, pady=(14, 0), sticky="w")
        ctk.CTkLabel(c, text=group_of(exercise), font=font(12), text_color=MUTED, anchor="w",
                     height=16).grid(row=1, column=0, padx=18, sticky="w")
        chips = ctk.CTkFrame(c, fg_color="transparent")
        chips.grid(row=2, column=0, padx=14, pady=(8, 14), sticky="w")
        for i, s in enumerate(sets):
            chip(chips, s).grid(row=i // 8, column=i % 8, padx=3, pady=2)
        actions = ctk.CTkFrame(c, fg_color="transparent")
        actions.grid(row=0, column=1, rowspan=3, padx=12)
        ghost_button(actions, "Изменить", lambda: self.open_editor(exercise),
                     text_color=ACCENT).pack(side="left")
        ghost_button(actions, "✕", lambda: self.delete_exercise(exercise), width=34,
                     text_color=MUTED).pack(side="left", padx=(4, 0))
        for w in (c, name):
            w.bind("<Button-1>", lambda e: self.open_editor(exercise))


# ---------- история ----------

class HistoryPage(ctk.CTkFrame):
    def __init__(self, master, app: App):
        super().__init__(master, fg_color="transparent")
        self.app = app
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(1, weight=1)
        ctk.CTkLabel(self, text="История", font=font(26, "bold"), text_color=TEXT).grid(
            row=0, column=0, sticky="w")
        self.list = ctk.CTkScrollableFrame(self, fg_color="transparent")
        self.list.grid(row=1, column=0, sticky="nsew", pady=(16, 0))

    def delete(self, day: str) -> None:
        if messagebox.askyesno("Удалить тренировку",
                               f"Удалить тренировку за {human_date(date.fromisoformat(day))}?",
                               parent=self):
            self.app.diary.delete(day)
            self.refresh()

    def refresh(self) -> None:
        for child in self.list.winfo_children():
            child.destroy()
        workouts = self.app.diary.recent(1000)
        if not workouts:
            ctk.CTkLabel(self.list, text="Пока пусто — запиши первую тренировку в «Дневнике»",
                         text_color=MUTED, font=font(14)).pack(pady=60)
            return
        for w in workouts:
            day = date.fromisoformat(w.day)
            c = card(self.list)
            c.pack(fill="x", pady=5)
            c.grid_columnconfigure(0, weight=1)
            ctk.CTkLabel(c, text=f"{day.day} {MONTHS[day.month - 1]} {day.year}, {WEEKDAYS[day.weekday()]}", font=font(15, "bold"),
                         text_color=TEXT, anchor="w").grid(row=0, column=0, padx=18, pady=(14, 0),
                                                           sticky="w")
            names = ", ".join(display_name(e) for e in dict.fromkeys(s.exercise for s in w.sets))
            work = sum(1 for s in w.sets if s.kind != WARMUP)
            ctk.CTkLabel(c, text=f"{names}  ·  {work} раб. подх.  ·  {fmt(w.volume)} кг",
                         text_color=MUTED, font=font(13), anchor="w", justify="left",
                         wraplength=700).grid(row=1, column=0, padx=18,
                                              pady=(2, 14 if not w.note else 0), sticky="w")
            if w.note:
                ctk.CTkLabel(c, text=w.note, anchor="w", text_color=TEXT, padx=2,
                             font=ctk.CTkFont(size=13, slant="italic")).grid(
                    row=2, column=0, padx=18, pady=(2, 14), sticky="w")
            actions = ctk.CTkFrame(c, fg_color="transparent")
            actions.grid(row=0, column=1, rowspan=3, padx=12)
            ghost_button(actions, "Открыть", lambda d=day: self.app.open_day(d),
                         text_color=ACCENT).pack(side="left")
            ghost_button(actions, "Удалить", lambda d=w.day: self.delete(d),
                         text_color=DANGER).pack(side="left", padx=(4, 0))


# ---------- прогресс ----------

class ProgressPage(ctk.CTkFrame):
    TILES = [("sessions", "тренировок"), ("sets", "рабочих подходов"), ("volume", "объём, кг"),
             ("best", "рекорд веса, кг"), ("orm", "расчётный 1ПМ, кг")]

    def __init__(self, master, app: App):
        super().__init__(master, fg_color="transparent")
        self.app = app
        self.exercise: str | None = None
        self.by_label: dict[str, str] = {}
        self.history: list[tuple[str, float, float]] = []
        self.grid_columnconfigure(0, weight=1)
        self.grid_rowconfigure(2, weight=1)

        head = ctk.CTkFrame(self, fg_color="transparent")
        head.grid(row=0, column=0, sticky="ew")
        ctk.CTkLabel(head, text="Прогресс", font=font(26, "bold"), text_color=TEXT).pack(side="left")
        self.menu = ctk.CTkOptionMenu(head, width=280, height=38, values=["—"], corner_radius=10,
                                      fg_color=SURFACE, button_color=SURFACE, button_hover_color=HOVER,
                                      text_color=TEXT, font=font(14), dropdown_font=font(13),
                                      dynamic_resizing=False, command=self.select)
        self.menu.pack(side="right")

        tiles = ctk.CTkFrame(self, fg_color="transparent")
        tiles.grid(row=1, column=0, sticky="ew", pady=(18, 0))
        self.tile_values = {}
        for i, (key, caption) in enumerate(self.TILES):
            tiles.grid_columnconfigure(i, weight=1, uniform="tile")
            tile = card(tiles)
            tile.grid(row=0, column=i, sticky="ew", padx=(0 if i == 0 else 10, 0))
            value = ctk.CTkLabel(tile, text="—", font=font(26, "bold"), text_color=TEXT)
            value.pack(padx=18, pady=(16, 0), anchor="w")
            ctk.CTkLabel(tile, text=caption, text_color=MUTED, font=font(12)).pack(
                padx=18, pady=(0, 16), anchor="w")
            self.tile_values[key] = value

        chart = card(self)
        chart.grid(row=2, column=0, sticky="nsew", pady=(12, 0))
        self.canvas = tk.Canvas(chart, highlightthickness=0, bd=0)
        self.canvas.pack(fill="both", expand=True, padx=14, pady=14)
        self.canvas.bind("<Configure>", lambda e: self.draw())

    def select(self, label: str) -> None:
        self.exercise = self.by_label.get(label)
        self.refresh()

    def refresh(self) -> None:
        names = [e for e in self.app.diary.exercises() if self.app.diary.stats(e)]
        self.by_label = {display_name(e): e for e in names}
        if not names:
            self.menu.configure(values=["—"])
            self.menu.set("Нет данных")
            for label in self.tile_values.values():
                label.configure(text="—")
            self.history = []
            self.draw()
            return
        if self.exercise not in names:
            self.exercise = names[0]
        self.menu.configure(values=list(self.by_label))
        self.menu.set(display_name(self.exercise))
        st = self.app.diary.stats(self.exercise)
        values = {"sessions": st.sessions, "sets": st.total_sets, "volume": fmt(st.total_volume),
                  "best": fmt(st.best_weight), "orm": f"{st.best_one_rep_max:.1f}"}
        for key, value in values.items():
            self.tile_values[key].configure(text=str(value))
        self.history = self.app.diary.history(self.exercise)
        self.draw()

    def draw(self) -> None:
        c = self.canvas
        c.delete("all")
        bg, grid, muted, text = pick(SURFACE), pick(HOVER), pick(MUTED), pick(TEXT)
        orm_color, weight_color = pick(ACCENT), pick(TREND)
        small = ("Segoe UI", 9)
        c.configure(bg=bg)
        w, h = c.winfo_width(), c.winfo_height()
        if w < 100 or h < 100:
            return
        data = self.history
        if not data:
            c.create_text(w / 2, h / 2, text="Нет данных — запиши первую тренировку",
                          fill=muted, font=("Segoe UI", 12))
            return

        left, right, top, bottom = 48, 24, 44, 32
        values = [v for _, best, orm in data for v in (best, orm)]
        lo, hi = min(values), max(values)
        pad = max((hi - lo) * 0.15, 2.5)
        lo, hi = max(0.0, lo - pad), hi + pad
        days = [date.fromisoformat(d) for d, _, _ in data]
        span = (days[-1] - days[0]).days

        def x(i: int) -> float:
            frac = (days[i] - days[0]).days / span if span else 0.5
            return left + (w - left - right) * frac

        def y(v: float) -> float:
            return top + (h - top - bottom) * (1 - (v - lo) / (hi - lo))

        for k in range(5):
            v = lo + (hi - lo) * k / 4
            c.create_line(left, y(v), w - right, y(v), fill=grid)
            c.create_text(left - 10, y(v), text=f"{v:.0f}", anchor="e", fill=muted, font=small)

        last_x = -1e9
        for i, d in enumerate(days):
            if x(i) - last_x >= 48:
                c.create_text(x(i), h - bottom + 16, text=short_date(d), fill=muted, font=small)
                last_x = x(i)

        for idx, color in ((1, weight_color), (2, orm_color)):
            pts = [(x(i), y(row[idx])) for i, row in enumerate(data)]
            if len(pts) > 1:
                c.create_line(*[p for pt in pts for p in pt], fill=color, width=2.5)
            for px, py in pts:
                c.create_oval(px - 4.5, py - 4.5, px + 4.5, py + 4.5, fill=color, outline=bg, width=2)

        lx = left
        for color, label in ((orm_color, "Расчётный 1ПМ"), (weight_color, "Лучший вес")):
            c.create_oval(lx, 14, lx + 10, 24, fill=color, outline=color)
            item = c.create_text(lx + 16, 19, text=label, anchor="w", fill=text, font=("Segoe UI", 10))
            lx = c.bbox(item)[2] + 22


def main() -> None:
    ctk.set_appearance_mode("system")
    diary = Diary(default_db_path())
    app = App(diary)

    def on_close():
        app.pages["diary"].save_note()
        diary.close()
        app.destroy()

    app.protocol("WM_DELETE_WINDOW", on_close)
    app.mainloop()


if __name__ == "__main__":
    main()
