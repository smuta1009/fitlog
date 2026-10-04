"use strict";

(() => {
  // ---------- справочник ----------

  const CATALOG = {
    "Грудь": ["Жим штанги лёжа", "Жим штанги на наклонной скамье", "Жим гантелей лёжа",
      "Жим гантелей на наклонной скамье", "Разводка гантелей лёжа", "Сведение рук в кроссовере",
      "Жим в тренажёре от груди", "Отжимания на брусьях", "Отжимания от пола"],
    "Спина": ["Подтягивания", "Тяга верхнего блока к груди", "Тяга штанги в наклоне",
      "Тяга гантели в наклоне", "Тяга горизонтального блока", "Тяга Т-грифа", "Становая тяга",
      "Пуловер на верхнем блоке", "Гиперэкстензия"],
    "Ноги": ["Приседания со штангой", "Фронтальные приседания", "Жим ногами", "Гакк-приседания",
      "Выпады с гантелями", "Болгарские сплит-приседания", "Румынская тяга",
      "Разгибание ног в тренажёре", "Сгибание ног в тренажёре", "Подъём на носки стоя",
      "Подъём на носки сидя"],
    "Ягодицы": ["Ягодичный мост со штангой", "Отведение ноги в кроссовере", "Разведение ног в тренажёре"],
    "Плечи": ["Армейский жим стоя", "Жим гантелей сидя", "Махи гантелями в стороны",
      "Махи гантелями в наклоне", "Тяга штанги к подбородку", "Тяга каната к лицу",
      "Обратная бабочка", "Шраги со штангой"],
    "Бицепс": ["Подъём штанги на бицепс", "Подъём гантелей на бицепс", "Молотковые сгибания",
      "Сгибания на скамье Скотта", "Концентрированные сгибания", "Сгибания на нижнем блоке"],
    "Трицепс": ["Жим лёжа узким хватом", "Французский жим лёжа", "Разгибания на блоке с канатом",
      "Разгибание гантели из-за головы", "Отжимания от скамьи", "Разгибание руки в наклоне"],
    "Пресс": ["Скручивания", "Скручивания на блоке", "Подъём ног в висе", "Ролик для пресса",
      "Планка", "Боковая планка"],
  };
  const CUSTOM = "Мои";
  const ALL = "Все";

  const norm = (s) => String(s).trim().replace(/\s+/g, " ").toLowerCase();
  const INDEX = new Map();
  for (const [group, names] of Object.entries(CATALOG)) {
    for (const name of names) INDEX.set(norm(name), { name, group });
  }
  const displayName = (ex) => INDEX.get(ex)?.name ?? ex.charAt(0).toUpperCase() + ex.slice(1);
  const groupOf = (ex) => INDEX.get(ex)?.group ?? Store.data.groups?.[ex] ?? CUSTOM;
  const GROUPS = Object.keys(CATALOG);

  // Упражнения с двумя снарядами: вес пишется для одного, в объёме учитываются оба.
  // Для остальных пользователь может включить это сам (настройка хранится по упражнению).
  const PAIRED_DEFAULT = new Set([
    "Жим гантелей лёжа", "Жим гантелей на наклонной скамье", "Разводка гантелей лёжа",
    "Выпады с гантелями", "Жим гантелей сидя", "Махи гантелями в стороны", "Махи гантелями в наклоне",
    "Подъём гантелей на бицепс", "Молотковые сгибания",
  ].map(norm));

  // ---------- форматирование ----------

  const KINDS = ["warmup", "work", "failure"];
  const KIND_LABELS = { warmup: "Разминка", work: "Рабочий", failure: "Отказ" };
  const WEEKDAYS = ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"];
  const WD_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
  const MONTHS = ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа",
    "сентября", "октября", "ноября", "декабря"];
  const MONTHS_NOM = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август",
    "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];
  const MONTHS_SHORT = ["янв", "фев", "мар", "апр", "мая", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

  const $ = (sel, root = document) => root.querySelector(sel);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
  const fmt = (x) => String(Math.round(x * 100) / 100);
  const pad = (n) => String(n).padStart(2, "0");
  const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parse = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const todayIso = () => iso(new Date());
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return iso(d); };
  const shortDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`; };
  const longDate = (s) => { const d = parse(s); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
  const weekday = (s) => WEEKDAYS[parse(s).getDay()];
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  /** Вес подхода: «50 кг», «20 кг (×2)» для двух снарядов, «свой вес» без отягощения. */
  /** Сравнение подхода с тем же подходом прошлой тренировки: up / same / down или "" (не с чем сравнивать).
   *  Повторы сравниваются, только если вес не изменился. */
  function compare(cur, prev, field) {
    if (!cur || !prev || !(cur.reps > 0)) return "";
    if (field === "w") return cur.weight > prev.weight ? "up" : cur.weight < prev.weight ? "down" : "same";
    if (cur.weight !== prev.weight) return "";
    return cur.reps > prev.reps ? "up" : cur.reps < prev.reps ? "down" : "same";
  }

  const weightHTML = (s, paired = Store.isPaired(s.exercise)) =>
    (s.weight ? `${fmt(s.weight)} кг${paired ? ' <small class="x2">(×2)</small>' : ""}` : "свой вес");
  const orm = (s) => (s.reps === 1 ? s.weight : s.weight * (1 + s.reps / 30));
  const plural = (n, one, few, many) => {
    if (n % 10 === 1 && n % 100 !== 11) return one;
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14)) return few;
    return many;
  };

  const ICONS = {
    chevron: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
    left: '<svg viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></svg>',
    right: '<svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg>',
    close: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    up: '<svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg>',
    down: '<svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg>',
  };

  // ---------- хранилище ----------
  //
  // workouts[day] = { name, note, template, exercises: [порядок упражнений], sets: [подходы] }
  // В тренировке могут быть упражнения без подходов — запланированные (например, из шаблона).
  // templates = [{ id, name, exercises }]

  const STORE_KEY = "fitlog.data.v1";
  const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const Store = {
    data: { workouts: {}, templates: [] },

    load() {
      try {
        const d = JSON.parse(localStorage.getItem(STORE_KEY));
        if (d && typeof d.workouts === "object") this.data = d;
      } catch (e) { /* пустое хранилище */ }
      this.data.templates = this.data.templates || [];
    },

    save() {
      try {
        localStorage.setItem(STORE_KEY, JSON.stringify(this.data));
      } catch (e) {
        toast("Не удалось сохранить данные");
      }
    },

    get(day) { return this.data.workouts[day] || null; },

    sets(day, ex) {
      const w = this.get(day);
      return w ? w.sets.filter((s) => s.exercise === ex) : [];
    },

    /** Упражнения тренировки по порядку, включая запланированные без подходов. */
    exercisesOf(w) {
      const list = [...(w.exercises || [])];
      for (const s of w.sets) if (!list.includes(s.exercise)) list.push(s.exercise);
      return list;
    },

    ensure(day) {
      if (!this.data.workouts[day]) {
        this.data.workouts[day] = { name: "", note: "", template: null, exercises: [], sets: [] };
      }
      return this.data.workouts[day];
    },

    cleanup(day) {
      const w = this.get(day);
      if (w && !w.sets.length && !this.exercisesOf(w).length) delete this.data.workouts[day];
    },

    /** Заменяет подходы упражнения за день; упражнение остаётся в тренировке на своём месте. */
    saveExercise(day, ex, sets) {
      const w = this.ensure(day);
      w.exercises = this.exercisesOf(w);
      if (!w.exercises.includes(ex)) w.exercises.push(ex);
      w.sets = w.sets.filter((s) => s.exercise !== ex).concat(sets);
      this.save();
    },

    removeExercise(day, ex) {
      const w = this.get(day);
      if (!w) return;
      w.exercises = this.exercisesOf(w).filter((e) => e !== ex);
      w.sets = w.sets.filter((s) => s.exercise !== ex);
      this.cleanup(day);
      this.save();
    },

    startWorkout(day, name, exercises, template = null) {
      const w = this.ensure(day);
      if (name) w.name = name;
      if (template) w.template = template;
      w.exercises = [...new Set([...this.exercisesOf(w), ...exercises])];
      this.save();
    },

    updateWorkout(day, name, exercises, template) {
      const w = this.ensure(day);
      w.name = name;
      w.template = template;
      w.exercises = [...exercises];
      w.sets = w.sets.filter((s) => exercises.includes(s.exercise));
      this.cleanup(day);
      this.save();
    },

    setNote(day, note) {
      const w = this.get(day);
      if (w) { w.note = note; this.save(); }
    },

    deleteDay(day) { delete this.data.workouts[day]; this.save(); },

    templates() { return this.data.templates; },
    template(id) { return this.data.templates.find((t) => t.id === id) || null; },

    saveTemplate({ id, name, exercises }) {
      const existing = id && this.template(id);
      if (existing) Object.assign(existing, { name, exercises: [...exercises] });
      else this.data.templates.push({ id: id = newId(), name, exercises: [...exercises] });
      this.save();
      return id;
    },

    deleteTemplate(id) {
      this.data.templates = this.data.templates.filter((t) => t.id !== id);
      for (const w of Object.values(this.data.workouts)) if (w.template === id) w.template = null;
      this.save();
    },

    setGroup(ex, group) {
      this.data.groups = this.data.groups || {};
      if (group && group !== CUSTOM) this.data.groups[ex] = group;
      else delete this.data.groups[ex];
      this.save();
    },

    // вес тела: body[day] = кг
    bodyEntries() {
      return Object.entries(this.data.body || {}).sort(([a], [b]) => (a < b ? -1 : 1));
    },
    setBody(day, kg) {
      this.data.body = this.data.body || {};
      this.data.body[day] = kg;
      this.save();
    },
    deleteBody(day) {
      if (this.data.body) delete this.data.body[day];
      this.save();
    },

    isPaired(ex) { return this.data.paired?.[ex] ?? PAIRED_DEFAULT.has(ex); },

    setPaired(ex, value) {
      this.data.paired = this.data.paired || {};
      if (value === PAIRED_DEFAULT.has(ex)) delete this.data.paired[ex];
      else this.data.paired[ex] = value;
      this.save();
    },

    /** Объём подхода в кг с учётом обоих снарядов. */
    volume(s) { return s.weight * s.reps * (this.isPaired(s.exercise) ? 2 : 1); },

    days() { return Object.keys(this.data.workouts).sort().reverse(); },

    previous(ex, before, count = 2) {
      const out = [];
      for (const d of this.days()) {
        if (d >= before) continue;
        const sets = this.sets(d, ex);
        if (sets.length) out.push([d, sets]);
        if (out.length === count) break;
      }
      return out;
    },

    exercises() {
      const all = new Set();
      for (const w of Object.values(this.data.workouts)) for (const ex of this.exercisesOf(w)) all.add(ex);
      for (const t of this.data.templates) for (const ex of t.exercises) all.add(ex);
      return [...all].sort((a, b) => displayName(a).localeCompare(displayName(b), "ru"));
    },

    /** Статистика без разминочных подходов. */
    stats(ex) {
      const history = [];
      let sets = 0, volume = 0, best = 0, bestOrm = 0;
      for (const d of this.days().reverse()) {
        const work = this.sets(d, ex).filter((s) => s.kind !== "warmup");
        if (!work.length) continue;
        const dayBest = Math.max(...work.map((s) => s.weight));
        const dayOrm = Math.max(...work.map(orm));
        history.push([d, dayBest, dayOrm]);
        sets += work.length;
        volume += work.reduce((a, s) => a + this.volume(s), 0);
        best = Math.max(best, dayBest);
        bestOrm = Math.max(bestOrm, dayOrm);
      }
      if (!history.length) return null;
      return { sessions: history.length, sets, volume, best, orm: bestOrm, history };
    },

    exportData() {
      return {
        app: "fitlog",
        version: 2,
        exported: new Date().toISOString(),
        paired: { ...(this.data.paired || {}) },
        groups: { ...(this.data.groups || {}) },
        body: { ...(this.data.body || {}) },
        templates: this.data.templates,
        workouts: this.days().reverse().map((day) => {
          const w = this.data.workouts[day];
          return {
            day,
            name: w.name || "",
            note: w.note || "",
            template: w.template || null,
            exercises: this.exercisesOf(w),
            sets: w.sets.map(({ exercise, weight, reps, kind }) => ({ exercise, weight, reps, kind })),
          };
        }),
      };
    },

    importData(obj) {
      if (!obj || !Array.isArray(obj.workouts)) throw new Error("Это не файл Fitlog");
      const parsed = {};
      for (const w of obj.workouts) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(w.day) || !Array.isArray(w.sets)) throw new Error("Повреждённая запись");
        const sets = w.sets.map((s) => {
          const set = { exercise: norm(s.exercise), weight: Number(s.weight), reps: Number(s.reps),
                        kind: KINDS.includes(s.kind) ? s.kind : "work" };
          if (!set.exercise || !(set.weight >= 0) || !Number.isInteger(set.reps) || set.reps <= 0) {
            throw new Error(`Некорректный подход за ${w.day}`);
          }
          return set;
        });
        const exercises = Array.isArray(w.exercises) ? w.exercises.map(norm).filter(Boolean) : [];
        if (sets.length || exercises.length) {
          parsed[w.day] = { name: String(w.name || ""), note: String(w.note || ""),
                            template: w.template || null, exercises, sets };
        }
      }
      Object.assign(this.data.workouts, parsed);
      if (obj.paired && typeof obj.paired === "object") {
        this.data.paired = { ...(this.data.paired || {}) };
        for (const [ex, v] of Object.entries(obj.paired)) this.data.paired[norm(ex)] = Boolean(v);
      }
      if (obj.groups && typeof obj.groups === "object") {
        this.data.groups = { ...(this.data.groups || {}) };
        for (const [ex, g] of Object.entries(obj.groups)) if (GROUPS.includes(g)) this.data.groups[norm(ex)] = g;
      }
      if (obj.body && typeof obj.body === "object") {
        this.data.body = { ...(this.data.body || {}) };
        for (const [day, kg] of Object.entries(obj.body)) {
          if (/^\d{4}-\d{2}-\d{2}$/.test(day) && Number(kg) > 0) this.data.body[day] = Number(kg);
        }
      }
      if (Array.isArray(obj.templates)) {
        for (const t of obj.templates) {
          if (!t || !t.name || !Array.isArray(t.exercises)) continue;
          this.saveTemplate({ id: t.id, name: String(t.name), exercises: t.exercises.map(norm).filter(Boolean) });
        }
      }
      this.save();
      return Object.keys(parsed).length;
    },
  };

  // ---------- состояние интерфейса ----------

  const ui = {
    tab: "diary",
    day: todayIso(),
    cursor: todayIso(), // какой месяц/неделю показывает календарь
    calOpen: false,
    picker: null,   // выбор упражнений
    editor: null,   // подходы одного упражнения
    list: null,     // редактор тренировки или шаблона (название + список упражнений)
    progressEx: null,
    bodyRange: 90, // дней на графике веса; 0 — всё время
  };

  const view = $("#view");
  const sheet = $("#sheet");

  function render() {
    const views = { diary: diaryView, templates: templatesView, history: historyView,
                    progress: progressView, body: bodyView, more: moreView };
    view.innerHTML = views[ui.tab]();
    document.querySelectorAll(".tabbar button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === ui.tab));
    if (ui.tab === "diary") setupGrids(view);
    if (ui.tab === "progress" || ui.tab === "body") drawCharts();
  }

  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
  }

  function openSheet(html) {
    sheet.innerHTML = html;
    sheet.classList.add("open");
    document.body.classList.add("locked");
  }

  function closeSheet() {
    sheet.classList.remove("open");
    document.body.classList.remove("locked");
    ui.picker = ui.editor = ui.list = null;
  }

  // ---------- таблица подходов (как в Google Таблицах) ----------
  //
  // Слева закреплён номер подхода, дальше столбцы: позапрошлая, прошлая, текущая тренировка.
  // По умолчанию видна текущая; прошлые открываются прокруткой или кнопкой «‹ Прошлые».

  function pastColumns(ex) {
    return [...Store.previous(ex, ui.day), [null, []], [null, []]].slice(0, 2).reverse();
  }

  function gridHeadHTML(past) {
    const current = ui.day === todayIso() ? "Сегодня" : shortDate(ui.day);
    let cells = `<div class="c fz h">#</div>`;
    past.forEach(([d], j) => {
      const jump = j === 1 ? `<button class="jump" data-act="grid-jump" data-to="cur">${current} ›</button>` : "";
      cells += `<div class="c h past-h ${j === 0 ? "snap" : ""}">
        <div><b>${d ? shortDate(d) : "—"}</b><small>${["позапрошлая", "прошлая"][j]}</small></div>${jump}</div>`;
    });
    cells += `<div class="c h cur-h snap-end">
      <div><b>${current}</b><small>текущая</small></div>
      <button class="jump" data-act="grid-jump" data-to="past">‹ Прошлые</button></div>`;
    return cells;
  }

  function pastCellHTML(s, paired) {
    return s
      ? `<div class="c past k-line-${s.kind}"><span class="wt">${weightHTML(s, paired)}</span><span class="rp">× ${s.reps}</span></div>`
      : `<div class="c past none">—</div>`;
  }

  const kindTag = (s) => (s.kind !== "work" ? `<span class="tag k-${s.kind}">${KIND_LABELS[s.kind]}</span>` : "");

  /** Упражнение в карточке тренировки: таблица только для просмотра, нажатие открывает редактор. */
  function exerciseBlockHTML(ex, sets) {
    const paired = Store.isPaired(ex);
    const past = pastColumns(ex);
    const rows = Math.max(sets.length, ...past.map(([, s]) => s.length), 1);
    let cells = gridHeadHTML(past);
    for (let i = 0; i < rows; i++) {
      cells += `<div class="c fz n">${i + 1}</div>`;
      for (const [, ps] of past) cells += pastCellHTML(ps[i], paired);
      const s = sets[i];
      const prev = past[1][1][i];
      if (s) {
        cells += `<div class="c cur ro"><span class="wt cmp-${compare(s, prev, "w")}">${weightHTML(s, paired)}</span>`
          + `<span class="rp cmp-${compare(s, prev, "r")}">× ${s.reps}</span>${kindTag(s)}</div>`;
      } else {
        cells += `<div class="c cur ro empty">${i === 0 && !sets.length ? "Нажми, чтобы записать подходы" : "—"}</div>`;
      }
    }
    return `
      <section class="ex-block" data-act="edit" data-ex="${esc(ex)}">
        <div class="ex-head">
          <div><div class="ex-name">${esc(displayName(ex))}</div><div class="ex-group">${esc(groupOf(ex))}</div></div>
          <span class="chev">${ICONS.right}</span>
        </div>
        <div class="grid-scroll ro"><div class="grid">${cells}</div></div>
      </section>`;
  }

  /** Прокрутка к текущей тренировке и синхронная прокрутка всех таблиц внутри root. */
  function setupGrids(root) {
    const grids = [...root.querySelectorAll(".grid-scroll")];
    for (const g of grids) g.scrollLeft = g.scrollWidth;
    let leader = null;
    for (const g of grids) {
      g.addEventListener("scroll", () => {
        if (leader && leader !== g) return;
        leader = g;
        for (const other of grids) if (other !== g) other.scrollLeft = g.scrollLeft;
        clearTimeout(g._syncTimer);
        g._syncTimer = setTimeout(() => { leader = null; }, 120);
      }, { passive: true });
    }
  }

  // ---------- дневник ----------

  function calendarHTML() {
    const cur = parse(ui.cursor);
    const marked = Store.data.workouts;
    const today = todayIso();
    let start, count;
    if (ui.calOpen) {
      const first = new Date(cur.getFullYear(), cur.getMonth(), 1);
      start = new Date(first);
      start.setDate(1 - ((first.getDay() + 6) % 7));
      const last = new Date(cur.getFullYear(), cur.getMonth() + 1, 0);
      const days = Math.round((last - start) / 86400000) + 1;
      count = Math.ceil(days / 7) * 7;
    } else {
      start = new Date(cur);
      start.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
      count = 7;
    }
    let cells = WD_SHORT.map((w) => `<div class="cal-wd">${w}</div>`).join("");
    let monthCount = 0;
    for (let i = 0; i < count; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const key = iso(d);
      const cls = ["day"];
      if (ui.calOpen && d.getMonth() !== cur.getMonth()) cls.push("out");
      if (marked[key]) cls.push("mark");
      if (key === today) cls.push("today");
      if (key === ui.day) cls.push("sel");
      cells += `<button class="${cls.join(" ")}" data-act="day" data-day="${key}">${d.getDate()}</button>`;
    }
    for (const key of Object.keys(marked)) {
      const d = parse(key);
      if (d.getFullYear() === cur.getFullYear() && d.getMonth() === cur.getMonth()) monthCount++;
    }
    const foot = ui.calOpen
      ? `<div class="cal-foot">${monthCount} ${plural(monthCount, "тренировка", "тренировки", "тренировок")} за месяц</div>`
      : "";
    return `
      <section class="card cal ${ui.calOpen ? "open" : ""}">
        <div class="cal-head">
          <button class="cal-title" data-act="cal-toggle">${MONTHS_NOM[cur.getMonth()]} ${cur.getFullYear()} ${ICONS.chevron}</button>
          <div class="cal-nav">
            <button class="icon-btn" data-act="cal-shift" data-dir="-1" aria-label="Назад">${ICONS.left}</button>
            <button class="icon-btn" data-act="cal-shift" data-dir="1" aria-label="Вперёд">${ICONS.right}</button>
          </div>
        </div>
        <div class="cal-grid">${cells}</div>
        ${foot}
      </section>`;
  }

  function diaryView() {
    const w = Store.get(ui.day);
    const isToday = ui.day === todayIso();
    const wd = isToday ? `Сегодня, ${weekday(ui.day)}` : cap(weekday(ui.day));
    let subtitle = `${wd} · тренировки нет`;
    let body;
    if (w) {
      const exercises = Store.exercisesOf(w);
      const work = w.sets.filter((s) => s.kind !== "warmup").length;
      const volume = w.sets.reduce((a, s) => a + Store.volume(s), 0);
      subtitle = `${wd} · ${exercises.length} ${plural(exercises.length, "упражнение", "упражнения", "упражнений")} · `
        + `${work} ${plural(work, "рабочий подход", "рабочих подхода", "рабочих подходов")} · ${fmt(volume)} кг`;
      body = `
        <section class="card workout">
          <div class="wk-head">
            <div>
              <div class="wk-name">${esc(w.name || "Тренировка")}</div>
            </div>
            <button class="link" data-act="edit-workout">Изменить</button>
          </div>
          ${exercises.map((ex) => exerciseBlockHTML(ex, w.sets.filter((s) => s.exercise === ex))).join("")
            || '<div class="empty muted">В тренировке пока нет упражнений</div>'}
        </section>
        <button class="btn soft" data-act="add">+ Добавить упражнения</button>
        <textarea class="note" id="note" rows="2" placeholder="Заметка: самочувствие, сон…">${esc(w.note || "")}</textarea>`;
    } else {
      body = `
        <div class="card empty"><b>Тренировки нет</b><span class="muted">Выбери шаблон или упражнения</span></div>
        <button class="btn" data-act="start">Начать тренировку</button>`;
    }
    return `
      <header class="page-head">
        <h1>${longDate(ui.day)}${parse(ui.day).getFullYear() !== new Date().getFullYear() ? " " + parse(ui.day).getFullYear() : ""}</h1>
        <p class="muted">${subtitle}</p>
      </header>
      ${calendarHTML()}
      <div class="stack" style="margin-top:12px">${body}</div>`;
  }

  // ---------- выбор упражнений (несколько сразу) ----------
  //
  // mode: "start" — новая тренировка (название, шаблоны, упражнения)
  //       "add"   — добавить в текущую тренировку
  //       "list"  — добавить в редактор тренировки/шаблона (возврат через onDone/onCancel)

  function customExercises() {
    return Store.exercises().filter((e) => !INDEX.has(e));
  }

  function openPicker(mode, opts = {}) {
    ui.picker = { mode, q: "", group: ALL, selected: [], exclude: new Set(opts.exclude || []),
                  onDone: opts.onDone, onCancel: opts.onCancel };
    const titles = { start: "Новая тренировка", add: "Добавить упражнения", list: "Добавить упражнения" };
    const templates = mode === "list" ? [] : Store.templates();
    const templatesHTML = templates.length ? `
      <div class="section-title">Шаблоны</div>
      <div class="pick-list">${templates.map((t) => `
        <button class="pick-item tpl" data-act="use-template" data-id="${t.id}">
          <b>${esc(t.name)}</b><small>${t.exercises.map((e) => esc(displayName(e))).join(" · ")}</small>
        </button>`).join("")}</div>
      <div class="section-title">${mode === "start" ? "Или отметь упражнения" : "Упражнения"}</div>` : "";
    openSheet(`
      <div class="sheet-head">
        <button class="link muted" data-act="picker-cancel">${mode === "list" ? "Назад" : "Отмена"}</button>
        <h2>${titles[mode]}</h2>
        <span></span>
      </div>
      <div class="sheet-body"><div class="sheet-inner">
        ${mode === "start" ? `<input id="wk-name" class="field" placeholder="Название, например «Верх»" autocomplete="off" style="margin-bottom:4px">` : ""}
        ${templatesHTML}
        <input id="pick-q" class="field" type="search" placeholder="Поиск или своё упражнение"
               autocomplete="off" autocorrect="off" enterkeyhint="done" ${templatesHTML ? "" : 'style="margin-top:8px"'}>
        <div class="pills" id="pick-groups"></div>
        <div id="pick-list"></div>
      </div></div>
      <div class="sheet-foot"><button class="btn" id="pick-done" data-act="pick-done"></button></div>`);
    renderPickerList();
  }

  function renderPickerList() {
    const p = ui.picker;
    const custom = customExercises();
    const groups = [ALL, ...GROUPS, ...(custom.some((e) => groupOf(e) === CUSTOM) ? [CUSTOM] : [])];
    if (!groups.includes(p.group)) p.group = ALL;
    $("#pick-groups").innerHTML = groups.map((g) =>
      `<button class="pill ${g === p.group ? "on" : ""}" data-act="pick-group" data-group="${esc(g)}">${esc(g)}</button>`).join("");

    const q = norm(p.q);
    const sections = Object.entries(CATALOG).map(([g, names]) => [g, names.map(norm)]);
    // свои упражнения показываем в их группе, без группы — в «Мои»
    const extra = [...new Set([...custom, ...p.selected.filter((e) => !INDEX.has(e))])];
    for (const section of sections) section[1].push(...extra.filter((e) => groupOf(e) === section[0]));
    const ungrouped = extra.filter((e) => groupOf(e) === CUSTOM);
    if (ungrouped.length) sections.push([CUSTOM, ungrouped]);
    let html = "";
    const known = new Set([...INDEX.keys(), ...extra]);
    if (q && !known.has(q)) {
      html += `
        <div class="card new-ex">
          <b>Новое упражнение «${esc(p.q.trim())}»</b>
          <small>Выбери группу мышц — упражнение появится в ней</small>
          <div class="pills wrap">${[...GROUPS, "Без группы"].map((g) =>
            `<button class="pill" data-act="pick-custom" data-group="${esc(g)}">${esc(g)}</button>`).join("")}</div>
        </div>`;
    }
    for (const [g, list] of sections) {
      if (p.group !== ALL && p.group !== g) continue;
      const shown = list.filter((ex) => ex.includes(q));
      if (!shown.length) continue;
      html += `<div class="section-title">${esc(g)}</div><div class="pick-list">`
        + shown.map((ex) => {
          if (p.exclude.has(ex)) {
            return `<div class="pick-item in">${esc(displayName(ex))}<small>уже добавлено</small></div>`;
          }
          const on = p.selected.includes(ex);
          return `<button class="pick-item ${on ? "on" : ""}" data-act="pick-toggle" data-ex="${esc(ex)}">${esc(displayName(ex))}</button>`;
        }).join("")
        + "</div>";
    }
    $("#pick-list").innerHTML = html || '<div class="empty muted">Ничего не найдено</div>';
    updatePickDone();
  }

  function updatePickDone() {
    const p = ui.picker;
    const n = p.selected.length;
    const btn = $("#pick-done");
    btn.textContent = p.mode === "start"
      ? (n ? `Начать тренировку · ${n} ${plural(n, "упражнение", "упражнения", "упражнений")}` : "Отметь упражнения или выбери шаблон")
      : (n ? `Добавить ${n} ${plural(n, "упражнение", "упражнения", "упражнений")}` : "Отметь упражнения");
    btn.disabled = !n;
  }

  function finishPicker(exercises, template = null) {
    const p = ui.picker;
    if (p.mode === "list") return p.onDone(exercises);
    if (p.mode === "start") {
      const name = ($("#wk-name")?.value || "").trim() || (template ? template.name : "");
      Store.startWorkout(ui.day, name, exercises, template?.id || null);
    } else {
      const w = Store.get(ui.day);
      const keepName = w && w.name;
      Store.startWorkout(ui.day, keepName ? "" : (template?.name || ""), exercises,
                         w?.template ? null : template?.id || null);
    }
    closeSheet();
    render();
  }

  // ---------- редактор тренировки и шаблона ----------

  function openWorkoutEditor() {
    const w = Store.get(ui.day);
    if (!w) return;
    ui.list = { kind: "workout", name: w.name || "", exercises: Store.exercisesOf(w),
                template: w.template && Store.template(w.template) ? w.template : null,
                applyTpl: false, saveAsTpl: false };
    renderListEditor();
  }

  function openTemplateEditor(id) {
    const t = id ? Store.template(id) : null;
    ui.list = { kind: "template", id: t?.id || null, name: t?.name || "", exercises: t ? [...t.exercises] : [] };
    renderListEditor();
  }

  function renderListEditor() {
    const L = ui.list;
    const isWorkout = L.kind === "workout";
    const tpl = isWorkout && L.template ? Store.template(L.template) : null;
    const title = isWorkout ? "Тренировка" : (L.id ? "Шаблон" : "Новый шаблон");
    const rows = L.exercises.map((ex, i) => `
      <div class="list-row">
        <div class="lr-text"><b>${esc(displayName(ex))}</b><small>${esc(groupOf(ex))}</small></div>
        <button class="icon-btn" data-act="list-move" data-i="${i}" data-d="-1" ${i === 0 ? "disabled" : ""} aria-label="Выше">${ICONS.up}</button>
        <button class="icon-btn" data-act="list-move" data-i="${i}" data-d="1" ${i === L.exercises.length - 1 ? "disabled" : ""} aria-label="Ниже">${ICONS.down}</button>
        <button class="icon-btn" data-act="list-del" data-i="${i}" aria-label="Убрать">${ICONS.close}</button>
      </div>`).join("");
    let toggle = "";
    if (isWorkout && tpl) {
      toggle = `
        <label class="card toggle-row">
          <span><b>Применить изменения к шаблону</b><small>Шаблон «${esc(tpl.name)}» получит это название и список упражнений</small></span>
          <input type="checkbox" id="apply-tpl" ${L.applyTpl ? "checked" : ""}><i class="switch"></i>
        </label>`;
    } else if (isWorkout) {
      toggle = `
        <label class="card toggle-row">
          <span><b>Сохранить как шаблон</b><small>Чтобы в следующий раз начать эту тренировку в одно касание</small></span>
          <input type="checkbox" id="save-tpl" ${L.saveAsTpl ? "checked" : ""}><i class="switch"></i>
        </label>`;
    }
    openSheet(`
      <div class="sheet-head">
        <button class="link muted" data-act="close">Отмена</button>
        <h2>${title}</h2>
        <button class="link strong" data-act="list-save">Готово</button>
      </div>
      <div class="sheet-body"><div class="sheet-inner">
        <input id="list-name" class="field" value="${esc(L.name)}" autocomplete="off"
               placeholder="Название, например «Грудь + бицепс»">
        <div class="section-title">Упражнения</div>
        ${rows ? `<div class="pick-list">${rows}</div>` : '<div class="card empty muted">Пока пусто</div>'}
        <div class="stack" style="margin-top:10px">
          <button class="btn soft" data-act="list-add">+ Добавить упражнения</button>
          ${toggle}
          <button class="btn" data-act="list-save">Сохранить</button>
          ${isWorkout ? '<button class="btn danger" data-act="list-delete">Удалить тренировку</button>' : ""}
          ${!isWorkout && L.id ? '<button class="btn danger" data-act="list-delete">Удалить шаблон</button>' : ""}
        </div>
      </div></div>`);
  }

  function saveListEditor() {
    const L = ui.list;
    const name = L.name.trim();
    if (L.kind === "template") {
      if (!name) return toast("Укажи название шаблона");
      if (!L.exercises.length) return toast("Добавь хотя бы одно упражнение");
      Store.saveTemplate({ id: L.id, name, exercises: L.exercises });
      closeSheet();
      render();
      return toast("Шаблон сохранён");
    }
    const w = Store.get(ui.day);
    const dropped = [...new Set(w.sets.map((s) => s.exercise))].filter((ex) => !L.exercises.includes(ex));
    if (dropped.length && !confirm(`Удалить записанные подходы: ${dropped.map(displayName).join(", ")}?`)) return;
    let template = L.template;
    if (L.applyTpl && template) {
      const tpl = Store.template(template);
      Store.saveTemplate({ id: template, name: name || tpl.name, exercises: L.exercises });
    }
    if (L.saveAsTpl) {
      if (!name) return toast("Дай тренировке название, чтобы сохранить шаблон");
      template = Store.saveTemplate({ name, exercises: L.exercises });
    }
    Store.updateWorkout(ui.day, name, L.exercises, template);
    closeSheet();
    render();
    toast(L.applyTpl ? "Тренировка и шаблон обновлены" : L.saveAsTpl ? "Шаблон создан" : "Сохранено");
  }

  // ---------- шаблоны ----------

  function templatesView() {
    const list = Store.templates();
    const cards = list.length
      ? list.map((t) => `
        <button class="card hist-card" data-act="edit-template" data-id="${t.id}">
          <div class="hist-date">${esc(t.name)}</div>
          <div class="hist-meta">${t.exercises.map((e) => esc(displayName(e))).join(" · ")}</div>
        </button>`).join("")
      : '<div class="card empty"><b>Шаблонов пока нет</b><span class="muted">Например, «Верх», «Грудь + бицепс» или «Плечи + ноги»</span></div>';
    return `
      <header class="page-head"><h1>Шаблоны</h1>
        <p class="muted">Готовые наборы упражнений — выбираются при начале тренировки</p></header>
      <div class="stack">${cards}<button class="btn" data-act="new-template">+ Новый шаблон</button></div>`;
  }

  // ---------- редактор подходов ----------

  function openEditor(ex) {
    const existing = Store.sets(ui.day, ex);
    const w = Store.get(ui.day);
    ui.editor = {
      ex,
      inWorkout: !!w && Store.exercisesOf(w).includes(ex),
      rows: existing.length
        ? existing.map((s) => ({ k: s.kind, w: s.weight ? fmt(s.weight) : "", r: String(s.reps) }))
        : [0, 1, 2].map(() => ({ k: "work", w: "", r: "" })),
      past: pastColumns(ex),
      hasPast: Store.previous(ex, ui.day).length > 0,
      paired: Store.isPaired(ex),
      error: "",
    };
    openSheet(`
      <div class="sheet-head">
        <button class="link muted" data-act="close">Отмена</button>
        <h2>${esc(displayName(ex))}</h2>
        <button class="link strong" data-act="save">Готово</button>
      </div>
      <div class="sheet-body"><div class="sheet-inner" id="editor"></div></div>`);
    renderEditor();
  }

  function renderEditor() {
    const e = ui.editor;
    const past = e.past;
    const rowCount = Math.max(e.rows.length, ...past.map(([, sets]) => sets.length));
    let cells = gridHeadHTML(past);
    for (let i = 0; i < rowCount; i++) {
      cells += `<div class="c fz n">${i + 1}</div>`;
      for (const [, sets] of past) cells += pastCellHTML(sets[i], e.paired);
      const row = e.rows[i];
      if (row) {
        const cmp = (f) => compare(rowSet(row), past[1][1][i], f);
        cells += `
          <div class="c cur">
            <select class="kind k-${row.k}" data-i="${i}" data-f="k" aria-label="Тип подхода">
              ${KINDS.map((k) => `<option value="${k}" ${row.k === k ? "selected" : ""}>${KIND_LABELS[k]}</option>`).join("")}
            </select>
            <label class="num"><span>кг${e.paired ? " (×2)" : ""}</span>
              <input class="cmp-${cmp("w")}" data-i="${i}" data-f="w" inputmode="decimal" value="${esc(row.w)}" placeholder="0"></label>
            <label class="num"><span>повт.</span>
              <input class="cmp-${cmp("r")}" data-i="${i}" data-f="r" inputmode="numeric" pattern="[0-9]*" value="${esc(row.r)}" placeholder="0"></label>
            <button class="icon-btn" data-act="del-row" data-i="${i}" aria-label="Удалить подход">${ICONS.close}</button>
          </div>`;
      } else if (i === e.rows.length) {
        cells += `<div class="c cur"><button class="add-cell" data-act="add-row">+ подход</button></div>`;
      } else {
        cells += `<div class="c cur"></div>`;
      }
    }
    const hint = e.hasPast
      ? "Нажми «Прошлые» или проведи по таблице вправо, чтобы сравнить с прошлыми тренировками"
      : "Это упражнение записывается впервые — прошлых результатов пока нет";
    $("#editor").innerHTML = `
      <p class="prev-info">${esc(groupOf(e.ex))} · ${hint}</p>
      ${e.error ? `<p class="error">${esc(e.error)}</p>` : ""}
      <div class="card grid-card">
        <div class="grid-scroll" id="grid-scroll"><div class="grid">${cells}</div></div>
      </div>
      ${INDEX.has(e.ex) ? "" : `
      <div class="card toggle-row">
        <span><b>Группа мышц</b><small>Своё упражнение — можно отнести к любой группе</small></span>
        <div class="select-wrap small-select">
          <select id="ex-group">${[...GROUPS, CUSTOM].map((g) =>
            `<option value="${esc(g)}" ${groupOf(e.ex) === g ? "selected" : ""}>${g === CUSTOM ? "Без группы" : esc(g)}</option>`).join("")}</select>
          ${ICONS.chevron}
        </div>
      </div>`}
      <label class="card toggle-row">
        <span><b>Два снаряда</b><small>Вес одной гантели или стороны тренажёра, рядом пишется ×2</small></span>
        <input type="checkbox" id="paired" ${e.paired ? "checked" : ""}><i class="switch"></i>
      </label>
      <div class="stack" style="margin-top:14px">
        <button class="btn soft" data-act="add-row">+ Добавить подход</button>
        <button class="btn" data-act="save">Сохранить</button>
        ${e.inWorkout ? '<button class="btn danger" data-act="del-ex">Убрать упражнение из тренировки</button>' : ""}
      </div>`;
    const scroller = $("#grid-scroll");
    scroller.scrollLeft = scroller.scrollWidth;
  }

  /** Подход из строки редактора (для сравнения цветом); null, если повторы ещё не введены. */
  function rowSet(row) {
    const reps = Number(row.r.trim());
    if (!row.r.trim() || !Number.isInteger(reps) || reps <= 0) return null;
    return { weight: Number(row.w.trim().replace(",", ".")) || 0, reps };
  }

  function updateRowColors(i) {
    const e = ui.editor;
    const prev = e.past[1][1][i];
    for (const f of ["w", "r"]) {
      const input = $(`#editor input[data-i="${i}"][data-f="${f}"]`);
      if (input) input.className = `cmp-${compare(rowSet(e.rows[i]), prev, f)}`;
    }
  }

  function saveEditor() {
    const e = ui.editor;
    const sets = [];
    for (const [i, row] of e.rows.entries()) {
      const w = row.w.trim().replace(",", ".");
      const r = row.r.trim();
      if (!w && !r) continue;
      const weight = w ? Number(w) : 0;
      const reps = Number(r);
      if (!Number.isFinite(weight) || weight < 0 || !Number.isInteger(reps) || reps <= 0) {
        e.error = `Подход ${i + 1}: проверь вес и повторы`;
        return renderEditor();
      }
      sets.push({ exercise: e.ex, weight, reps, kind: row.k });
    }
    if (e.paired !== Store.isPaired(e.ex)) Store.setPaired(e.ex, e.paired);
    Store.saveExercise(ui.day, e.ex, sets);
    closeSheet();
    render();
    if (sets.length) toast("Сохранено");
  }

  // ---------- история ----------

  function historyView() {
    const days = Store.days();
    const list = days.length ? days.map((day) => {
      const w = Store.get(day);
      const names = Store.exercisesOf(w).map(displayName).join(", ");
      const work = w.sets.filter((s) => s.kind !== "warmup").length;
      const volume = w.sets.reduce((a, s) => a + Store.volume(s), 0);
      const d = parse(day);
      return `
        <button class="card hist-card" data-act="open-day" data-day="${day}">
          <div class="hist-date">${w.name ? `${esc(w.name)} · ` : ""}${longDate(day)} ${d.getFullYear()}, ${weekday(day)}</div>
          <div class="hist-meta">${esc(names)}<br>${work} раб. ${plural(work, "подход", "подхода", "подходов")} · ${fmt(volume)} кг</div>
          ${w.note ? `<div class="hist-note">${esc(w.note)}</div>` : ""}
        </button>`;
    }).join("") : '<div class="card empty"><b>Пока пусто</b><span class="muted">Запиши первую тренировку в «Дневнике»</span></div>';
    return `<header class="page-head"><h1>История</h1>
      <p class="muted">${days.length} ${plural(days.length, "тренировка", "тренировки", "тренировок")}</p></header>
      <div class="stack">${list}</div>`;
  }

  // ---------- прогресс ----------

  function progressView() {
    const names = Store.exercises().filter((e) => Store.stats(e));
    if (!names.length) {
      return `<header class="page-head"><h1>Прогресс</h1></header>
        <div class="card empty"><b>Нет данных</b><span class="muted">Здесь появятся рекорды и графики</span></div>`;
    }
    if (!names.includes(ui.progressEx)) ui.progressEx = names[0];
    const st = Store.stats(ui.progressEx);
    return `
      <header class="page-head"><h1>Прогресс</h1></header>
      <div class="select-wrap">
        <select id="progress-ex">${names.map((e) =>
          `<option value="${esc(e)}" ${e === ui.progressEx ? "selected" : ""}>${esc(displayName(e))}</option>`).join("")}</select>
        ${ICONS.chevron}
      </div>
      <div class="stack" style="margin-top:12px">
        <div class="card hero">
          <div><div class="value">${fmt(Math.round(st.orm * 10) / 10)} <small>кг</small></div>
          <div class="label">расчётный разовый максимум</div></div>
        </div>
        <div class="tiles">
          <div class="card tile"><div class="value">${fmt(st.best)}</div><div class="label">рекорд веса, кг</div></div>
          <div class="card tile"><div class="value">${st.sessions}</div><div class="label">${plural(st.sessions, "тренировка", "тренировки", "тренировок")}</div></div>
          <div class="card tile"><div class="value">${st.sets}</div><div class="label">рабочих подходов</div></div>
          <div class="card tile"><div class="value">${fmt(Math.round(st.volume))}</div><div class="label">общий объём, кг</div></div>
        </div>
        <div class="card chart">
          <div class="legend"><span><i style="background:var(--accent)"></i>Расчётный 1ПМ</span>
            <span><i style="background:var(--trend)"></i>Лучший вес</span></div>
          <div id="chart"></div>
        </div>
      </div>`;
  }

  /** Линейный график по датам. rows = [[day, v1, v2, ...]], series = [[индекс значения, цвет], ...] */
  function lineChart(box, rows, series) {
    if (!box || !rows.length) return;
    const W = Math.max(box.clientWidth, 260), H = 220;
    const L = 38, R = 12, T = 12, B = 26;
    const values = rows.flatMap((row) => series.map(([idx]) => row[idx]));
    let lo = Math.min(...values), hi = Math.max(...values);
    const padV = Math.max((hi - lo) * 0.15, 1);
    lo = Math.max(0, lo - padV); hi += padV;
    const t0 = parse(rows[0][0]).getTime();
    const span = parse(rows[rows.length - 1][0]).getTime() - t0;
    const x = (i) => L + (W - L - R) * (span ? (parse(rows[i][0]).getTime() - t0) / span : 0.5);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    const tick = (v) => (hi - lo < 6 ? fmt(Math.round(v * 10) / 10) : Math.round(v));

    let svg = "";
    for (let k = 0; k <= 3; k++) {
      const v = lo + ((hi - lo) * k) / 3;
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>`
        + `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${tick(v)}</text>`;
    }
    let lastX = -1e9;
    rows.forEach(([d], i) => {
      if (x(i) - lastX < 44) return;
      svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${shortDate(d)}</text>`;
      lastX = x(i);
    });
    for (const [idx, color] of series) {
      const pts = rows.map((row, i) => `${x(i)},${y(row[idx])}`);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      if (rows.length <= 60) {
        svg += rows.map((row, i) =>
          `<circle cx="${x(i)}" cy="${y(row[idx])}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`).join("");
      }
    }
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${svg}</svg>`;
  }

  function drawCharts() {
    if (ui.tab === "progress") {
      lineChart($("#chart"), Store.stats(ui.progressEx)?.history || [], [[1, "var(--trend)"], [2, "var(--accent)"]]);
    } else if (ui.tab === "body") {
      lineChart($("#bw-chart"), bodyRangeEntries(), [[1, "var(--accent)"]]);
    }
  }

  // ---------- вес тела ----------

  function bodyRangeEntries() {
    const all = Store.bodyEntries();
    if (!ui.bodyRange) return all;
    const from = addDays(todayIso(), -ui.bodyRange);
    return all.filter(([d]) => d >= from);
  }

  function signed(x) {
    const v = Math.round(x * 10) / 10;
    return v > 0 ? `+${fmt(v)}` : v < 0 ? `−${fmt(-v)}` : "0";
  }

  function bodyView() {
    const all = Store.bodyEntries();
    const today = todayIso();
    const todayKg = (Store.data.body || {})[today];
    const form = `
      <div class="card bw-form">
        <input id="bw-day" class="field" type="date" value="${today}" max="${today}" aria-label="Дата">
        <input id="bw-kg" class="field" inputmode="decimal" placeholder="Вес, кг" value="${todayKg ? fmt(todayKg) : ""}" aria-label="Вес, кг">
        <button class="btn" data-act="bw-save">Записать</button>
      </div>`;
    if (!all.length) {
      return `<header class="page-head"><h1>Вес тела</h1><p class="muted">Записывай вес, чтобы видеть динамику</p></header>
        <div class="stack">${form}<div class="card empty"><b>Замеров пока нет</b><span class="muted">Удобнее взвешиваться утром натощак</span></div></div>`;
    }
    const [lastDay, last] = all[all.length - 1];
    const prev = all.length > 1 ? all[all.length - 2][1] : null;
    const range = bodyRangeEntries();
    const rangeChange = range.length > 1 ? range[range.length - 1][1] - range[0][1] : null;
    const ranges = [[30, "Месяц"], [90, "3 месяца"], [365, "Год"], [0, "Всё"]];
    const list = [...all].reverse().slice(0, 60).map(([d, kg], i, arr) => {
      const before = arr[i + 1];
      return `
        <div class="list-row">
          <div class="lr-text"><b>${fmt(kg)} кг</b><small>${longDate(d)} ${parse(d).getFullYear()}, ${weekday(d)}</small></div>
          ${before ? `<span class="bw-delta">${signed(kg - before[1])}</span>` : ""}
          <button class="icon-btn" data-act="bw-del" data-day="${d}" aria-label="Удалить">${ICONS.close}</button>
        </div>`;
    }).join("");
    return `
      <header class="page-head"><h1>Вес тела</h1></header>
      <div class="stack">
        <div class="card hero">
          <div><div class="value">${fmt(last)} <small>кг</small></div>
          <div class="label">${lastDay === today ? "сегодня" : longDate(lastDay)}${prev !== null ? ` · ${signed(last - prev)} кг к прошлому замеру` : ""}</div></div>
        </div>
        ${form}
        <div class="pills" style="margin-top:4px">${ranges.map(([days, label]) =>
          `<button class="pill ${ui.bodyRange === days ? "on" : ""}" data-act="bw-range" data-days="${days}">${label}</button>`).join("")}</div>
        <div class="card chart">
          ${rangeChange !== null ? `<div class="legend"><span class="muted">За период: <b style="color:var(--text)">${signed(rangeChange)} кг</b></span></div>` : ""}
          <div id="bw-chart">${range.length ? "" : '<div class="empty muted">Нет замеров за этот период</div>'}</div>
        </div>
        <div class="section-title">Замеры</div>
        <div class="list-card">${list}</div>
      </div>`;
  }

  // ---------- ещё ----------

  const THEME_KEY = "fitlog.theme";

  function getTheme() {
    try { return localStorage.getItem(THEME_KEY) || "auto"; } catch (e) { return "auto"; }
  }

  function applyTheme(theme) {
    if (theme === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", theme);
  }

  function isStandalone() {
    return window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;
  }

  function moreView() {
    const theme = getTheme();
    const n = Store.days().length;
    const install = isStandalone() ? "" : `
      <div class="section-title">Установка на iPhone</div>
      <div class="card">
        <ol class="steps">
          <li>Открой эту страницу в <b>Safari</b></li>
          <li>Нажми «Поделиться» (квадрат со стрелкой)</li>
          <li>Выбери «На экран „Домой“» → «Добавить»</li>
        </ol>
      </div>`;
    return `
      <header class="page-head"><h1>Ещё</h1></header>
      <div class="section-title">Оформление</div>
      <div class="seg theme">${[["auto", "Авто"], ["light", "Светлая"], ["dark", "Тёмная"]].map(([v, l]) =>
        `<button class="${theme === v ? "on" : ""}" data-act="theme" data-v="${v}">${l}</button>`).join("")}</div>
      <div class="section-title">Данные</div>
      <div class="list-card">
        <button class="row-btn" data-act="export"><span>Сохранить копию в файл</span><span>${n} ${plural(n, "тренировка", "тренировки", "тренировок")}</span></button>
        <button class="row-btn" data-act="import"><span>Загрузить из файла</span><span>.json</span></button>
      </div>
      <div class="section-title">Приложение</div>
      <div class="list-card">
        <button class="row-btn" data-act="force-update"><span>Обновить приложение</span><span>тренировки сохранятся</span></button>
      </div>
      <p class="muted small" style="margin:8px 4px 0">Данные хранятся только на этом устройстве. Время от времени сохраняй копию в «Файлы» или iCloud.</p>
      ${install}
      <p class="muted small" style="text-align:center;margin-top:28px">Fitlog · версия 1.5</p>`;
  }

  async function exportData() {
    const json = JSON.stringify(Store.exportData(), null, 2);
    const name = `fitlog-${todayIso()}.json`;
    const file = new File([json], name, { type: "application/json" });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Fitlog" });
        return;
      } catch (e) {
        if (e.name === "AbortError") return;
      }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }

  async function importFile(file) {
    try {
      const obj = JSON.parse(await file.text());
      if (!confirm("Тренировки из файла заменят записи за те же дни. Продолжить?")) return;
      const n = Store.importData(obj);
      toast(`Загружено тренировок: ${n}`);
      render();
    } catch (e) {
      toast(`Не удалось загрузить: ${e.message}`);
    }
  }

  // ---------- события ----------

  const actions = {
    tab: (el) => { ui.tab = el.dataset.tab; render(); window.scrollTo(0, 0); },
    day: (el) => {
      ui.day = el.dataset.day;
      ui.cursor = ui.day;
      render();
    },
    "cal-toggle": () => { ui.calOpen = !ui.calOpen; ui.cursor = ui.day; render(); },
    "cal-shift": (el) => {
      const dir = Number(el.dataset.dir);
      if (ui.calOpen) {
        const d = parse(ui.cursor);
        ui.cursor = iso(new Date(d.getFullYear(), d.getMonth() + dir, 1));
      } else {
        ui.cursor = addDays(ui.cursor, 7 * dir);
      }
      render();
    },
    close: () => closeSheet(),

    // выбор упражнений
    start: () => openPicker("start"),
    add: () => openPicker("add", { exclude: Store.exercisesOf(Store.get(ui.day)) }),
    "picker-cancel": () => {
      if (ui.picker.mode === "list") ui.picker.onCancel();
      else closeSheet();
    },
    "pick-group": (el) => { ui.picker.group = el.dataset.group; renderPickerList(); },
    "pick-toggle": (el) => {
      const sel = ui.picker.selected;
      const ex = el.dataset.ex;
      const i = sel.indexOf(ex);
      if (i >= 0) sel.splice(i, 1); else sel.push(ex);
      el.classList.toggle("on", i < 0);
      updatePickDone();
    },
    "pick-custom": (el) => {
      const ex = norm(ui.picker.q);
      if (ex && !INDEX.has(ex)) Store.setGroup(ex, el.dataset.group === "Без группы" ? CUSTOM : el.dataset.group);
      if (ex && !ui.picker.selected.includes(ex)) ui.picker.selected.push(ex);
      ui.picker.q = "";
      $("#pick-q").value = "";
      renderPickerList();
    },
    "pick-done": () => { if (ui.picker.selected.length) finishPicker(ui.picker.selected); },
    "use-template": (el) => {
      const t = Store.template(el.dataset.id);
      if (t) finishPicker(t.exercises, t);
    },

    // тренировка и шаблоны
    "edit-workout": () => openWorkoutEditor(),
    "new-template": () => openTemplateEditor(null),
    "edit-template": (el) => openTemplateEditor(el.dataset.id),
    "list-move": (el) => {
      const list = ui.list.exercises;
      const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
      renderListEditor();
    },
    "list-del": (el) => { ui.list.exercises.splice(Number(el.dataset.i), 1); renderListEditor(); },
    "list-add": () => {
      const L = ui.list;
      openPicker("list", {
        exclude: L.exercises,
        onDone: (exs) => { ui.picker = null; L.exercises.push(...exs); renderListEditor(); },
        onCancel: () => { ui.picker = null; renderListEditor(); },
      });
    },
    "list-save": () => saveListEditor(),
    "list-delete": () => {
      const L = ui.list;
      if (L.kind === "workout") {
        if (!confirm("Удалить всю тренировку за этот день?")) return;
        Store.deleteDay(ui.day);
      } else {
        if (!confirm(`Удалить шаблон «${L.name}»? Прошлые тренировки останутся.`)) return;
        Store.deleteTemplate(L.id);
      }
      closeSheet();
      render();
    },

    // подходы
    edit: (el) => openEditor(el.dataset.ex),
    "add-row": () => {
      const rows = ui.editor.rows;
      const last = rows[rows.length - 1];
      rows.push(last ? { ...last } : { k: "work", w: "", r: "" });
      renderEditor();
    },
    "grid-jump": (el) => {
      const sc = el.closest(".grid-scroll");
      sc.scrollTo({ left: el.dataset.to === "past" ? 0 : sc.scrollWidth, behavior: "smooth" });
    },
    "del-row": (el) => { ui.editor.rows.splice(Number(el.dataset.i), 1); renderEditor(); },
    save: () => saveEditor(),
    "del-ex": () => {
      if (!confirm(`Убрать «${displayName(ui.editor.ex)}» из тренировки?`)) return;
      Store.removeExercise(ui.day, ui.editor.ex);
      closeSheet();
      render();
    },

    "bw-save": () => {
      const day = $("#bw-day").value;
      const kg = Number($("#bw-kg").value.trim().replace(",", "."));
      if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || day > todayIso()) return toast("Проверь дату");
      if (!(kg >= 20 && kg <= 400)) return toast("Введи вес в килограммах, например 82.5");
      Store.setBody(day, Math.round(kg * 10) / 10);
      render();
      toast("Вес записан");
    },
    "bw-del": (el) => {
      if (!confirm("Удалить этот замер?")) return;
      Store.deleteBody(el.dataset.day);
      render();
    },
    "bw-range": (el) => { ui.bodyRange = Number(el.dataset.days); render(); },
    "open-day": (el) => {
      ui.day = el.dataset.day;
      ui.cursor = ui.day;
      ui.tab = "diary";
      render();
      window.scrollTo(0, 0);
    },
    theme: (el) => {
      try { localStorage.setItem(THEME_KEY, el.dataset.v); } catch (e) { /* без сохранения */ }
      applyTheme(el.dataset.v);
      render();
    },
    export: () => exportData(),
    "force-update": async () => {
      toast("Обновляю…");
      try {
        // данные лежат в localStorage — их это не затрагивает; удаляем только кэш файлов приложения
        const regs = (await navigator.serviceWorker?.getRegistrations?.()) || [];
        await Promise.all(regs.map((r) => r.unregister()));
        const keys = (await window.caches?.keys?.()) || [];
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) { /* всё равно перезагружаемся */ }
      location.replace(location.pathname + "?v=" + Date.now());
    },
    import: () => $("#import-file").click(),
  };

  document.addEventListener("click", (event) => {
    const el = event.target.closest("[data-act]");
    if (el && !el.disabled && actions[el.dataset.act]) actions[el.dataset.act](el);
  });

  document.addEventListener("input", (event) => {
    const t = event.target;
    if (t.id === "pick-q") {
      ui.picker.q = t.value;
      renderPickerList();
    } else if (t.id === "note") {
      Store.setNote(ui.day, t.value.trim());
    } else if (t.id === "list-name" && ui.list) {
      ui.list.name = t.value;
    } else if ((t.dataset.f === "w" || t.dataset.f === "r") && ui.editor) {
      ui.editor.rows[Number(t.dataset.i)][t.dataset.f] = t.value;
      updateRowColors(Number(t.dataset.i));
    }
  });

  document.addEventListener("change", (event) => {
    const t = event.target;
    if (t.id === "paired" && ui.editor) {
      ui.editor.paired = t.checked;
      const scroll = $("#grid-scroll").scrollLeft;
      renderEditor();
      $("#grid-scroll").scrollLeft = scroll;
    } else if (t.dataset.f === "k" && ui.editor) {
      ui.editor.rows[Number(t.dataset.i)].k = t.value;
      t.className = `kind k-${t.value}`;
    } else if (t.id === "ex-group" && ui.editor) {
      Store.setGroup(ui.editor.ex, t.value);
      const scroll = $("#grid-scroll").scrollLeft;
      renderEditor();
      $("#grid-scroll").scrollLeft = scroll;
    } else if (t.id === "bw-day") {
      const kg = (Store.data.body || {})[t.value];
      $("#bw-kg").value = kg ? fmt(kg) : "";
    } else if (t.id === "apply-tpl" && ui.list) {
      ui.list.applyTpl = t.checked;
    } else if (t.id === "save-tpl" && ui.list) {
      ui.list.saveAsTpl = t.checked;
    } else if (t.id === "progress-ex") {
      ui.progressEx = t.value;
      render();
    } else if (t.id === "import-file") {
      const file = t.files[0];
      t.value = "";
      if (file) importFile(file);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const t = event.target;
    if (t.id === "bw-kg") return actions["bw-save"]();
    if (t.id === "pick-q" || t.id === "wk-name" || t.id === "list-name" || t.dataset.f) t.blur();
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 150);
  });

  // при возвращении в приложение на следующий день — показать «сегодня»
  let lastToday = todayIso();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || todayIso() === lastToday) return;
    if (ui.day === lastToday && !sheet.classList.contains("open")) { ui.day = ui.cursor = todayIso(); render(); }
    lastToday = todayIso();
  });

  // ---------- запуск ----------

  Store.load();
  applyTheme(getTheme());
  navigator.storage?.persist?.().catch(() => {});
  render();

  window.Fitlog = { Store }; // для отладки и тестов
})();
