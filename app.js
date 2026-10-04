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
  const groupOf = (ex) => INDEX.get(ex)?.group ?? CUSTOM;

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
  };

  // ---------- хранилище ----------

  const STORE_KEY = "fitlog.data.v1";

  const Store = {
    data: { workouts: {} },

    load() {
      try {
        const d = JSON.parse(localStorage.getItem(STORE_KEY));
        if (d && typeof d.workouts === "object") this.data = d;
      } catch (e) { /* пустое хранилище */ }
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

    /** Заменяет подходы упражнения за день, оставляя упражнение на прежнем месте. */
    saveExercise(day, ex, sets) {
      const w = this.data.workouts[day] || { note: "", sets: [] };
      const out = [];
      let placed = false;
      for (const s of w.sets) {
        if (s.exercise !== ex) out.push(s);
        else if (!placed) { out.push(...sets); placed = true; }
      }
      if (!placed) out.push(...sets);
      w.sets = out;
      if (out.length) this.data.workouts[day] = w;
      else delete this.data.workouts[day];
      this.save();
    },

    setNote(day, note) {
      const w = this.get(day);
      if (w) { w.note = note; this.save(); }
    },

    deleteDay(day) { delete this.data.workouts[day]; this.save(); },

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
      for (const w of Object.values(this.data.workouts)) for (const s of w.sets) all.add(s.exercise);
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
        version: 1,
        exported: new Date().toISOString(),
        paired: { ...(this.data.paired || {}) },
        workouts: this.days().reverse().map((day) => {
          const w = this.data.workouts[day];
          return {
            day,
            note: w.note || "",
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
        if (sets.length) parsed[w.day] = { note: String(w.note || ""), sets };
      }
      Object.assign(this.data.workouts, parsed);
      if (obj.paired && typeof obj.paired === "object") {
        this.data.paired = { ...(this.data.paired || {}) };
        for (const [ex, v] of Object.entries(obj.paired)) this.data.paired[norm(ex)] = Boolean(v);
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
    picker: null,
    editor: null,
    progressEx: null,
  };

  const view = $("#view");
  const sheet = $("#sheet");

  function render() {
    const views = { diary: diaryView, history: historyView, progress: progressView, more: moreView };
    view.innerHTML = views[ui.tab]();
    document.querySelectorAll(".tabbar button").forEach((b) =>
      b.classList.toggle("active", b.dataset.tab === ui.tab));
    if (ui.tab === "progress") drawChart();
  }

  let toastTimer;
  function toast(text) {
    const t = $("#toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2400);
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
      const groups = new Map();
      for (const s of w.sets) {
        if (!groups.has(s.exercise)) groups.set(s.exercise, []);
        groups.get(s.exercise).push(s);
      }
      const work = w.sets.filter((s) => s.kind !== "warmup").length;
      const volume = w.sets.reduce((a, s) => a + Store.volume(s), 0);
      subtitle = `${wd} · ${groups.size} ${plural(groups.size, "упражнение", "упражнения", "упражнений")} · `
        + `${work} ${plural(work, "рабочий подход", "рабочих подхода", "рабочих подходов")} · ${fmt(volume)} кг`;
      body = [...groups].map(([ex, sets]) => `
        <button class="card ex-card" data-act="edit" data-ex="${esc(ex)}">
          <div class="ex-name">${esc(displayName(ex))}</div>
          <div class="ex-group">${esc(groupOf(ex))}</div>
          <div class="set-list">${sets.map((s, i) => `
            <div class="set-line">
              <span class="n">${i + 1}</span>
              <span class="wt">${weightHTML(s)}</span>
              <span class="rp">× ${s.reps}</span>
              ${s.kind !== "work" ? `<span class="tag k-${s.kind}">${KIND_LABELS[s.kind]}</span>` : ""}
            </div>`).join("")}</div>
        </button>`).join("");
      body += `<button class="btn" data-act="add">+ Добавить упражнение</button>
        <textarea class="note" id="note" rows="2" placeholder="Заметка: самочувствие, сон…">${esc(w.note || "")}</textarea>`;
    } else {
      body = `
        <div class="card empty"><b>Тренировки нет</b><span class="muted">Добавь первое упражнение</span></div>
        <button class="btn" data-act="add">+ Добавить упражнение</button>`;
    }
    return `
      <header class="page-head">
        <h1>${longDate(ui.day)}${parse(ui.day).getFullYear() !== new Date().getFullYear() ? " " + parse(ui.day).getFullYear() : ""}</h1>
        <p class="muted">${subtitle}</p>
      </header>
      ${calendarHTML()}
      <div class="stack" style="margin-top:12px">${body}</div>`;
  }

  // ---------- выбор упражнения ----------

  function openSheet(html) {
    sheet.innerHTML = html;
    sheet.classList.add("open");
    document.body.classList.add("locked");
  }

  function closeSheet() {
    sheet.classList.remove("open");
    document.body.classList.remove("locked");
    ui.picker = null;
    ui.editor = null;
  }

  function customExercises() {
    return Store.exercises().filter((e) => !INDEX.has(e));
  }

  function openPicker() {
    ui.picker = { q: "", group: ui.picker?.group || ALL };
    openSheet(`
      <div class="sheet-head">
        <button class="link muted" data-act="close">Отмена</button>
        <h2>Упражнение</h2>
        <span></span>
      </div>
      <div class="sheet-body"><div class="sheet-inner">
        <input id="pick-q" class="field" type="search" placeholder="Поиск или своё упражнение"
               autocomplete="off" autocorrect="off" enterkeyhint="done">
        <div class="pills" id="pick-groups"></div>
        <div id="pick-list"></div>
      </div></div>`);
    renderPickerList();
  }

  function renderPickerList() {
    const p = ui.picker;
    const custom = customExercises();
    const groups = [ALL, ...Object.keys(CATALOG), ...(custom.length ? [CUSTOM] : [])];
    if (!groups.includes(p.group)) p.group = ALL;
    $("#pick-groups").innerHTML = groups.map((g) =>
      `<button class="pill ${g === p.group ? "on" : ""}" data-act="pick-group" data-group="${esc(g)}">${esc(g)}</button>`).join("");

    const q = norm(p.q);
    const sections = Object.entries(CATALOG).map(([g, names]) => [g, names.map(norm)]);
    if (custom.length) sections.push([CUSTOM, custom]);
    let html = "";
    const known = new Set([...INDEX.keys(), ...custom]);
    if (q && !known.has(q)) {
      html += `<div class="pick-list" style="margin:10px 0"><button class="pick-item add" data-act="pick" data-ex="${esc(q)}">+ Добавить «${esc(p.q.trim())}»</button></div>`;
    }
    for (const [g, list] of sections) {
      if (p.group !== ALL && p.group !== g) continue;
      const shown = list.filter((ex) => ex.includes(q));
      if (!shown.length) continue;
      html += `<div class="section-title">${esc(g)}</div><div class="pick-list">`
        + shown.map((ex) => `<button class="pick-item" data-act="pick" data-ex="${esc(ex)}">${esc(displayName(ex))}</button>`).join("")
        + "</div>";
    }
    $("#pick-list").innerHTML = html || '<div class="empty muted">Ничего не найдено</div>';
  }

  // ---------- редактор подходов ----------

  function openEditor(ex) {
    const existing = Store.sets(ui.day, ex);
    ui.picker = null;
    ui.editor = {
      ex,
      existed: existing.length > 0,
      rows: existing.length
        ? existing.map((s) => ({ k: s.kind, w: s.weight ? fmt(s.weight) : "", r: String(s.reps) }))
        : [0, 1, 2].map(() => ({ k: "work", w: "", r: "" })),
      prev: Store.previous(ex, ui.day),
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
    // столбцы слева направо: позапрошлая, прошлая, текущая — как даты в таблице
    // прошлых столбцов всегда два: если данных нет, показываем пустые — так видно, где они будут
    const past = [...e.prev, [null, []], [null, []]].slice(0, 2).reverse();
    const rowCount = Math.max(e.rows.length, ...past.map(([, sets]) => sets.length));
    const isToday = ui.day === todayIso();
    const current = isToday ? "Сегодня" : shortDate(ui.day);

    let cells = `<div class="c fz h">#</div>`;
    past.forEach(([d], j) => {
      const jump = j === 1 ? `<button class="jump" data-act="grid-jump" data-to="cur">${current} ›</button>` : "";
      cells += `<div class="c h past-h ${j === 0 ? "snap" : ""}">
        <div><b>${d ? shortDate(d) : "—"}</b><small>${["позапрошлая", "прошлая"][j]}</small></div>${jump}</div>`;
    });
    cells += `<div class="c h cur-h snap-end">
      <div><b>${current}</b><small>текущая</small></div>
      <button class="jump" data-act="grid-jump" data-to="past">‹ Прошлые</button></div>`;

    for (let i = 0; i < rowCount; i++) {
      cells += `<div class="c fz n">${i + 1}</div>`;
      for (const [, sets] of past) {
        const s = sets[i];
        cells += s
          ? `<div class="c past k-line-${s.kind}"><span class="wt">${weightHTML(s, e.paired)}</span><span class="rp">× ${s.reps}</span></div>`
          : `<div class="c past none">—</div>`;
      }
      const row = e.rows[i];
      if (row) {
        cells += `
          <div class="c cur">
            <select class="kind k-${row.k}" data-i="${i}" data-f="k" aria-label="Тип подхода">
              ${KINDS.map((k) => `<option value="${k}" ${row.k === k ? "selected" : ""}>${KIND_LABELS[k]}</option>`).join("")}
            </select>
            <label class="num"><span>кг${e.paired ? " (×2)" : ""}</span>
              <input data-i="${i}" data-f="w" inputmode="decimal" value="${esc(row.w)}" placeholder="0"></label>
            <label class="num"><span>повт.</span>
              <input data-i="${i}" data-f="r" inputmode="numeric" pattern="[0-9]*" value="${esc(row.r)}" placeholder="0"></label>
            <button class="icon-btn" data-act="del-row" data-i="${i}" aria-label="Удалить подход">${ICONS.close}</button>
          </div>`;
      } else if (i === e.rows.length) {
        cells += `<div class="c cur"><button class="add-cell" data-act="add-row">+ подход</button></div>`;
      } else {
        cells += `<div class="c cur"></div>`;
      }
    }

    const hint = e.prev.length
      ? "Нажми «Прошлые» или проведи по таблице вправо, чтобы сравнить с прошлыми тренировками"
      : "Это упражнение записывается впервые — прошлых результатов пока нет";
    $("#editor").innerHTML = `
      <p class="prev-info">${esc(groupOf(e.ex))} · ${hint}</p>
      ${e.error ? `<p class="error">${esc(e.error)}</p>` : ""}
      <div class="card grid-card">
        <div class="grid-scroll" id="grid-scroll">
          <div class="grid">${cells}</div>
        </div>
      </div>
      <label class="card toggle-row">
        <span><b>Два снаряда</b><small>Вес одной гантели или стороны тренажёра, рядом пишется ×2</small></span>
        <input type="checkbox" id="paired" ${e.paired ? "checked" : ""}><i class="switch"></i>
      </label>
      <div class="stack" style="margin-top:14px">
        <button class="btn soft" data-act="add-row">+ Добавить подход</button>
        <button class="btn" data-act="save">Сохранить</button>
        ${e.existed ? '<button class="btn danger" data-act="del-ex">Удалить упражнение из тренировки</button>' : ""}
      </div>`;
    // по умолчанию видна текущая тренировка (крайний правый столбец)
    const scroller = $("#grid-scroll");
    scroller.scrollLeft = scroller.scrollWidth;
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
    if (!sets.length && e.rows.length) {
      e.error = "Заполни хотя бы один подход";
      return renderEditor();
    }
    if (e.paired !== Store.isPaired(e.ex)) Store.setPaired(e.ex, e.paired);
    if (sets.length || e.existed) Store.saveExercise(ui.day, e.ex, sets);
    closeSheet();
    render();
    if (sets.length) toast("Сохранено");
  }

  // ---------- история ----------

  function historyView() {
    const days = Store.days();
    const list = days.length ? days.map((day) => {
      const w = Store.get(day);
      const names = [...new Set(w.sets.map((s) => s.exercise))].map(displayName).join(", ");
      const work = w.sets.filter((s) => s.kind !== "warmup").length;
      const volume = w.sets.reduce((a, s) => a + Store.volume(s), 0);
      const d = parse(day);
      return `
        <button class="card hist-card" data-act="open-day" data-day="${day}">
          <div class="hist-date">${longDate(day)} ${d.getFullYear()}, ${weekday(day)}</div>
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

  function drawChart() {
    const box = $("#chart");
    if (!box) return;
    const data = Store.stats(ui.progressEx)?.history || [];
    const W = Math.max(box.clientWidth, 260), H = 220;
    const L = 34, R = 12, T = 12, B = 26;
    const values = data.flatMap(([, b, o]) => [b, o]);
    let lo = Math.min(...values), hi = Math.max(...values);
    const padV = Math.max((hi - lo) * 0.15, 2.5);
    lo = Math.max(0, lo - padV); hi += padV;
    const t0 = parse(data[0][0]).getTime();
    const span = parse(data[data.length - 1][0]).getTime() - t0;
    const x = (i) => L + (W - L - R) * (span ? (parse(data[i][0]).getTime() - t0) / span : 0.5);
    const y = (v) => T + (H - T - B) * (1 - (v - lo) / (hi - lo));

    let svg = "";
    for (let k = 0; k <= 3; k++) {
      const v = lo + ((hi - lo) * k) / 3;
      svg += `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--line)"/>`
        + `<text x="${L - 6}" y="${y(v) + 4}" text-anchor="end" font-size="10" fill="var(--muted)">${Math.round(v)}</text>`;
    }
    let lastX = -1e9;
    data.forEach(([d], i) => {
      if (x(i) - lastX < 44) return;
      svg += `<text x="${x(i)}" y="${H - 6}" text-anchor="middle" font-size="10" fill="var(--muted)">${shortDate(d)}</text>`;
      lastX = x(i);
    });
    for (const [idx, color] of [[1, "var(--trend)"], [2, "var(--accent)"]]) {
      const pts = data.map((row, i) => `${x(i)},${y(row[idx])}`);
      if (pts.length > 1) {
        svg += `<polyline points="${pts.join(" ")}" fill="none" stroke="${color}" stroke-width="2.5" stroke-linejoin="round" stroke-linecap="round"/>`;
      }
      svg += data.map((row, i) =>
        `<circle cx="${x(i)}" cy="${y(row[idx])}" r="4" fill="${color}" stroke="var(--surface)" stroke-width="2"/>`).join("");
    }
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}">${svg}</svg>`;
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
      <p class="muted small" style="text-align:center;margin-top:28px">Fitlog · версия 1.3</p>`;
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
    add: () => openPicker(),
    edit: (el) => openEditor(el.dataset.ex),
    close: () => closeSheet(),
    "pick-group": (el) => { ui.picker.group = el.dataset.group; renderPickerList(); },
    pick: (el) => openEditor(el.dataset.ex),
    "add-row": () => {
      const rows = ui.editor.rows;
      const last = rows[rows.length - 1];
      rows.push(last ? { ...last } : { k: "work", w: "", r: "" });
      renderEditor();
    },
    "grid-jump": (el) => {
      const sc = $("#grid-scroll");
      sc.scrollTo({ left: el.dataset.to === "past" ? 0 : sc.scrollWidth, behavior: "smooth" });
    },
    "del-row": (el) => { ui.editor.rows.splice(Number(el.dataset.i), 1); renderEditor(); },
    save: () => saveEditor(),
    "del-ex": () => {
      if (!confirm(`Удалить «${displayName(ui.editor.ex)}» из тренировки?`)) return;
      Store.saveExercise(ui.day, ui.editor.ex, []);
      closeSheet();
      render();
    },
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
    if (el && actions[el.dataset.act]) actions[el.dataset.act](el);
  });

  document.addEventListener("input", (event) => {
    const t = event.target;
    if (t.id === "pick-q") {
      ui.picker.q = t.value;
      renderPickerList();
    } else if (t.id === "note") {
      Store.setNote(ui.day, t.value.trim());
    } else if ((t.dataset.f === "w" || t.dataset.f === "r") && ui.editor) {
      ui.editor.rows[Number(t.dataset.i)][t.dataset.f] = t.value;
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
    } else if (event.target.id === "progress-ex") {
      ui.progressEx = event.target.value;
      render();
    } else if (event.target.id === "import-file") {
      const file = event.target.files[0];
      event.target.value = "";
      if (file) importFile(file);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    if (event.target.id === "pick-q") {
      const first = document.querySelector("#pick-list [data-act=pick]");
      if (first) openEditor(first.dataset.ex);
    } else if (event.target.dataset.f) {
      event.target.blur();
    }
  });

  let resizeTimer;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawChart, 150);
  });

  // при возвращении в приложение на следующий день — показать «сегодня»
  let lastToday = todayIso();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState !== "visible" || todayIso() === lastToday) return;
    if (ui.day === lastToday && !ui.editor) { ui.day = ui.cursor = todayIso(); render(); }
    lastToday = todayIso();
  });

  // ---------- запуск ----------

  Store.load();
  applyTheme(getTheme());
  navigator.storage?.persist?.().catch(() => {});
  render();

  window.Fitlog = { Store }; // для отладки и тестов
})();
