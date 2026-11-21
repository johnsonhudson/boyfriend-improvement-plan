(function () {
  const D = window.CLOSER_DATA;
  const KEY = "closer.v1";
  const $ = sel => document.querySelector(sel);
  const view = $("#view");

  // ---------- utilities ----------
  const uid = () => Math.random().toString(36).slice(2, 10);
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const dateKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const dayNum = (d = new Date()) => Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
  const pickDaily = (arr, salt = 0) => arr.length ? arr[(dayNum() + salt) % arr.length] : "";
  const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const fmtTime = hhmm => {
    const [h, m] = hhmm.split(":").map(Number);
    return `${((h + 11) % 12) + 1}:${pad(m)} ${h < 12 ? "AM" : "PM"}`;
  };

  // ---------- state ----------
  function defaults() {
    return {
      settings: { yourName: "", partnerName: "", partnerPhone: "", startDate: "", displaySeconds: 15, theme: "auto" },
      reminders: D.defaultReminders.map(r => ({ id: uid(), enabled: true, lastFired: "", ...r })),
      favorites: [],
      compliments: [],
      customReassurances: [],
      customTexts: [],
      habits: {},
      planStart: dateKey(),
      planTasks: {},
      seenOnboarding: false
    };
  }
  let state;
  try { state = Object.assign(defaults(), JSON.parse(localStorage.getItem(KEY) || "{}")); }
  catch { state = defaults(); }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
  const pName = () => state.settings.partnerName || "babe";
  const fillName = s => s.replace(/\{name\}/g, pName());

  // ---------- toast / clipboard / sms ----------
  let toastTimer;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); toast("Copied — paste it into your messages 💬"); }
    catch {
      const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select();
      document.execCommand("copy"); ta.remove(); toast("Copied!");
    }
  }
  function smsHref(text) {
    const phone = (state.settings.partnerPhone || "").replace(/[^\d+]/g, "");
    return `sms:${phone}${/iPhone|iPad|Mac/.test(navigator.userAgent) ? "&" : "?"}body=${encodeURIComponent(text)}`;
  }
  function telHref() { return `tel:${(state.settings.partnerPhone || "").replace(/[^\d+]/g, "")}`; }
  function msgActions(text) {
    return `<div class="row">
      <button class="btn sm" data-action="copy" data-text="${esc(text)}">📋 Copy</button>
      <a class="btn sm" href="${esc(smsHref(text))}">📱 Text it</a>
    </div>`;
  }

  // ---------- derived ----------
  function daysTogether() {
    if (!state.settings.startDate) return null;
    const start = new Date(state.settings.startDate + "T00:00:00");
    return Math.max(0, dayNum() - dayNum(start));
  }
  function upcomingReminders(limit = 3) {
    const now = new Date();
    const out = [];
    for (let offset = 0; offset < 8 && out.length < 20; offset++) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
      state.reminders.filter(r => r.enabled && r.days.includes(d.getDay())).forEach(r => {
        const [h, m] = r.time.split(":").map(Number);
        const at = new Date(d.getFullYear(), d.getMonth(), d.getDate(), h, m);
        if (at > now) out.push({ r, at });
      });
    }
    return out.sort((a, b) => a.at - b.at).slice(0, limit);
  }
  function whenLabel(at) {
    const diff = dayNum(at) - dayNum();
    const day = diff === 0 ? "Today" : diff === 1 ? "Tomorrow" : DAYS[at.getDay()];
    return `${day} · ${fmtTime(`${pad(at.getHours())}:${pad(at.getMinutes())}`)}`;
  }
  function planWeek() {
    const start = new Date(state.planStart + "T00:00:00");
    const w = Math.floor((dayNum() - dayNum(start)) / 7);
    return Math.max(0, Math.min(D.plan.length - 1, w));
  }
  function habitStreak() {
    let streak = 0;
    const d = new Date();
    const today = state.habits[dateKey(d)] || {};
    if (!Object.values(today).some(Boolean)) d.setDate(d.getDate() - 1);
    while (true) {
      const h = state.habits[dateKey(d)] || {};
      if (!Object.values(h).some(Boolean)) break;
      streak++; d.setDate(d.getDate() - 1);
    }
    return streak;
  }
  const allReassurances = () => [...state.customReassurances, ...D.reassurances];
  const topCompliments = () => [...state.compliments].sort((a, b) => b.rating - a.rating || b.date.localeCompare(a.date));
  const textsFor = cat => [...state.customTexts.filter(t => t.cat === cat).map(t => t.text), ...(D.dailyTexts[cat] || [])];

  // ---------- views ----------
  const views = {};

  views.home = () => {
    const s = state.settings;
    const hour = new Date().getHours();
    const greet = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
    const days = daysTogether();
    const up = upcomingReminders(4);
    const todayHabits = state.habits[dateKey()] || {};
    const done = D.habits.filter(h => todayHabits[h.id]).length;
    const wk = D.plan[planWeek()];
    const textCat = hour < 12 ? "morning" : hour >= 20 ? "night" : pickDaily(["thinking", "encourage", "thanks", "playful"], 3);
    const todaysText = fillName(pickDaily(textsFor(textCat), 1));
    const reassure = pickDaily(allReassurances(), 2);
    const top = topCompliments()[0];
    const fav = state.favorites.length ? pickDaily(state.favorites, 5) : null;
    const favCat = fav && D.favoriteCategories.find(c => c.id === fav.category);

    return `
      <div class="hero">
        <div>
          <p class="eyebrow">${new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1>${greet}${s.yourName ? ", " + esc(s.yourName) : ""} 👋</h1>
          <p class="muted" style="margin-top:6px">Small things, done often. Here's today's plan for ${esc(pName())}.</p>
        </div>
        ${days !== null ? `<div class="counter"><div class="big">${days.toLocaleString()}</div><div class="muted small">days together</div></div>`
          : `<a class="btn" href="#settings">Add your names & start date →</a>`}
      </div>

      <div class="grid three">
        <div class="card span-2">
          <div class="card-head"><p class="eyebrow">📱 Today's text to send</p><a class="btn ghost sm" href="#texts">More texts</a></div>
          <p class="quote">${esc(todaysText)}</p>
          <div style="margin-top:14px">${msgActions(todaysText)}</div>
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">⏰ Coming up</p><a class="btn ghost sm" href="#reminders">All</a></div>
          ${up.length ? `<div class="list">${up.map(({ r, at }) => `
            <div class="list-item"><div>${catIcon(r.category)}</div><div class="grow"><div class="title">${esc(r.title)}</div><div class="muted small">${whenLabel(at)}</div></div></div>`).join("")}</div>`
          : `<p class="empty">No reminders scheduled.</p>`}
        </div>

        <div class="card">
          <div class="card-head"><p class="eyebrow">✅ Today's habits</p><span class="tag">🔥 ${habitStreak()} day streak</span></div>
          <div class="progress"><div style="width:${(done / D.habits.length) * 100}%"></div></div>
          <p class="muted small" style="margin:8px 0 4px">${done} of ${D.habits.length} done</p>
          ${habitChecklist()}
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">🤍 Reassurance of the day</p></div>
          <p class="quote">${esc(reassure)}</p>
          <div style="margin-top:14px">${msgActions(reassure)}</div>
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">📈 Week ${planWeek() + 1}: ${esc(wk.theme)}</p><a class="btn ghost sm" href="#plan">Plan</a></div>
          <p style="font-weight:600;margin-bottom:8px">${esc(wk.focus)}</p>
          ${wk.tasks.map((t, i) => taskCheck(planWeek(), i, t)).join("")}
        </div>

        <div class="card">
          <div class="card-head"><p class="eyebrow">🫙 Top compliment</p><a class="btn ghost sm" href="#jar">Jar</a></div>
          ${top ? `<p class="quote">“${esc(top.text)}”</p><p class="muted small" style="margin-top:8px">${hearts(top.rating, null)} ${esc(top.reaction || "")}</p>`
            : `<p class="muted">Nothing in the jar yet. When a compliment really lands, save it so you remember what she loves to hear.</p>`}
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">⭐ Remember</p><a class="btn ghost sm" href="#favorites">Favorites</a></div>
          ${fav ? `<p class="muted small">${favCat ? favCat.icon + " " + esc(favCat.label) : ""}</p><p class="quote" style="margin-top:4px">${esc(fav.value)}</p>${fav.note ? `<p class="muted small" style="margin-top:6px">${esc(fav.note)}</p>` : ""}`
            : `<p class="muted">Start your list of ${esc(pName())}'s favorite things — her coffee order, flowers, sizes, dream trips.</p><a class="btn sm" style="margin-top:10px" href="#favorites">Add favorites</a>`}
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">❓ Ask tonight</p><a class="btn ghost sm" href="#connect">More</a></div>
          <p class="quote">${esc(pickDaily(D.questions, 4))}</p>
        </div>
      </div>`;
  };

  function habitChecklist() {
    const today = state.habits[dateKey()] || {};
    return D.habits.map(h => `
      <label class="check ${today[h.id] ? "done" : ""}">
        <input type="checkbox" data-action="habit" data-id="${h.id}" ${today[h.id] ? "checked" : ""}>
        <span>${h.icon} ${esc(h.label)}</span>
      </label>`).join("");
  }
  function taskCheck(week, i, label) {
    const k = `${week}-${i}`;
    const on = !!state.planTasks[k];
    return `<label class="check ${on ? "done" : ""}"><input type="checkbox" data-action="plantask" data-id="${k}" ${on ? "checked" : ""}><span>${esc(label)}</span></label>`;
  }
  const catIcon = id => (D.reminderCategories.find(c => c.id === id) || { icon: "✨" }).icon;

  // ----- Reminders -----
  let reminderDraftDays = [0, 1, 2, 3, 4, 5, 6];
  views.reminders = () => {
    const perm = "Notification" in window ? Notification.permission : "unsupported";
    const sorted = [...state.reminders].sort((a, b) => a.time.localeCompare(b.time));
    return `
      <div class="page-head">
        <div><h1>Reminders</h1><p>Nudges for the little things — texts, check-ins, date planning, important days. They pop up while the app is open on any screen.</p></div>
        ${perm === "default" ? `<button class="btn" data-action="notify-perm">🔔 Enable pop-up notifications</button>`
          : perm === "granted" ? `<span class="tag">🔔 Notifications on</span>` : ""}
      </div>
      <div class="grid two">
        <div class="card">
          <h2 style="margin-bottom:14px">New reminder</h2>
          <form class="stack" data-form="reminder">
            <label class="field">What
              <input type="text" name="title" placeholder="e.g. Bring her favorite coffee" required maxlength="120">
            </label>
            <div class="form-row">
              <label class="field">Time<input type="time" name="time" value="12:00" required></label>
              <label class="field">Type
                <select name="category">${D.reminderCategories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("")}</select>
              </label>
            </div>
            <div class="field" style="font-size:13px;font-weight:600;color:var(--ink-2)">Repeat on
              <div class="chips" style="margin-top:6px">${DAYS.map((d, i) => `<button type="button" class="chip day-chip ${reminderDraftDays.includes(i) ? "on" : ""}" data-action="draft-day" data-day="${i}">${d[0]}</button>`).join("")}</div>
            </div>
            <div class="row"><button class="btn primary" type="submit">Add reminder</button></div>
          </form>
          <p class="eyebrow" style="margin-top:22px">Quick add</p>
          <div class="chips">
            ${[["Ask about her big day", "18:00", "connect"], ["Buy flowers", "17:00", "gift"], ["Plan a date night", "12:00", "date"], ["Send a voice note", "13:00", "connect"], ["Tell her one thing I appreciate", "20:00", "reassure"]]
              .map(([t, tm, c]) => `<button class="chip" data-action="quick-reminder" data-title="${esc(t)}" data-time="${tm}" data-cat="${c}">+ ${esc(t)}</button>`).join("")}
          </div>
        </div>
        <div class="card">
          <h2 style="margin-bottom:6px">Your reminders</h2>
          <div class="list">
            ${sorted.length ? sorted.map(r => `
              <div class="list-item">
                <div style="font-size:20px">${catIcon(r.category)}</div>
                <div class="grow">
                  <div class="title">${esc(r.title)}</div>
                  <div class="muted small">${fmtTime(r.time)} · ${r.days.length === 7 ? "Every day" : r.days.length === 0 ? "Never" : r.days.map(d => DAYS[d]).join(", ")}</div>
                </div>
                <label class="switch"><input type="checkbox" data-action="toggle-reminder" data-id="${r.id}" ${r.enabled ? "checked" : ""}><span></span></label>
                <button class="btn ghost sm danger" data-action="del-reminder" data-id="${r.id}" aria-label="Delete">✕</button>
              </div>`).join("") : `<p class="empty">No reminders yet.</p>`}
          </div>
        </div>
      </div>`;
  };

  // ----- Tone helper -----
  let toneText = "", toneSeed = 0, toneSel = "warm";
  views.tone = () => `
    <div class="page-head">
      <div><h1>Tone Helper</h1><p>Paste a text before you send it. See how it might land, then get a rewrite in a different tone. Everything stays on your device.</p></div>
    </div>
    <div class="grid two">
      <div class="card stack">
        <label class="field">Your message
          <textarea id="tone-input" placeholder="e.g. you never text me back when you're out with your friends" rows="5">${esc(toneText)}</textarea>
        </label>
        <p class="eyebrow" style="margin:6px 0 0">Rewrite it to sound…</p>
        <div class="chips">${Tone.TONES.map(t => `<button class="chip ${t.id === toneSel ? "on" : ""}" data-action="tone" data-tone="${t.id}" title="${esc(t.desc)}">${t.icon} ${t.label}</button>`).join("")}</div>
        <div id="tone-out"></div>
      </div>
      <div class="stack">
        <div class="card"><p class="eyebrow">How it might land</p><div class="flags" id="tone-flags"></div></div>
        <div class="card stack">
          <p class="eyebrow" style="margin:0">I-statement builder</p>
          <p class="muted small">For when something bothers you. Fill it in, then copy.</p>
          <div class="form-row">
            <label class="field">I feel<input type="text" id="is-feel" placeholder="hurt"></label>
            <label class="field">when<input type="text" id="is-when" placeholder="plans change last minute"></label>
          </div>
          <div class="form-row">
            <label class="field">because<input type="text" id="is-because" placeholder="I was looking forward to it"></label>
            <label class="field">Could we<input type="text" id="is-ask" placeholder="give each other a heads-up earlier"></label>
          </div>
          <div class="rewrite" id="is-out" style="min-height:52px"></div>
          <div class="row"><button class="btn sm" data-action="copy-is">📋 Copy</button><button class="btn sm" data-action="is-to-tone">Check tone →</button></div>
        </div>
      </div>
    </div>`;

  function updateTone() {
    const inp = $("#tone-input"); if (!inp) return;
    toneText = inp.value;
    const flags = Tone.analyze(toneText);
    $("#tone-flags").innerHTML = flags.length ? flags.map(f => `<div class="flag ${f.level}"><b>${f.level === "warn" ? "⚠️" : "✓"} ${esc(f.title)}</b><span class="tip">${esc(f.tip)}</span></div>`).join("")
      : `<p class="muted small">Type a message to see feedback.</p>`;
    const out = Tone.rewrite(toneText, toneSel, toneSeed, state.settings.partnerName);
    $("#tone-out").innerHTML = out ? `
      <p class="eyebrow" style="margin:10px 0 8px">${Tone.TONES.find(t => t.id === toneSel).icon} ${Tone.TONES.find(t => t.id === toneSel).label} version</p>
      <div class="rewrite">${esc(out)}</div>
      <div class="row" style="margin-top:10px">${msgActions(out).replace(/^<div class="row">|<\/div>$/g, "")}
        <button class="btn sm" data-action="tone-again">🔄 Another version</button>
        <button class="btn sm ghost" data-action="tone-use">Edit this</button>
      </div>
      <p class="muted small" style="margin-top:10px">Tip: read it out loud once. If you wouldn't say it to her face, tweak it.</p>` : "";
  }
  function updateIS() {
    const v = id => ($(id)?.value || "").trim();
    const parts = [];
    if (v("#is-feel")) parts.push(`I feel ${v("#is-feel")}`);
    if (v("#is-when")) parts.push(`when ${v("#is-when")}`);
    if (v("#is-because")) parts.push(`because ${v("#is-because")}`);
    let s = parts.join(" ");
    if (s) s += ".";
    if (v("#is-ask")) s += ` Could we ${v("#is-ask").replace(/\?$/, "")}?`;
    const out = $("#is-out"); if (out) out.textContent = s.trim();
  }

  // ----- Daily texts -----
  let textCat = "morning";
  views.texts = () => {
    const list = textsFor(textCat).map(fillName);
    const cat = D.textCategories.find(c => c.id === textCat);
    return `
      <div class="page-head">
        <div><h1>Daily Texts</h1><p>Ready-to-send messages for every moment. Tap "Text it" on your phone to open Messages with it filled in${state.settings.partnerPhone ? "" : " — add her number in Settings"}.</p></div>
        ${state.settings.partnerPhone ? `<a class="btn" href="${esc(telHref())}">📞 Call ${esc(pName())}</a>` : ""}
      </div>
      <div class="chips" style="margin-bottom:16px">${D.textCategories.map(c => `<button class="chip ${c.id === textCat ? "on" : ""}" data-action="text-cat" data-cat="${c.id}">${c.icon} ${c.label}</button>`).join("")}</div>
      <div class="grid two">
        <div class="card span-2" style="background:var(--accent-soft);border-color:transparent">
          <p class="eyebrow">${cat.icon} Today's pick</p>
          <p class="quote">${esc(pickDaily(list, 1))}</p>
          <div style="margin-top:12px">${msgActions(pickDaily(list, 1))}</div>
        </div>
        ${list.map(t => `<div class="card"><p style="font-size:16px">${esc(t)}</p><div style="margin-top:12px">${msgActions(t)}</div></div>`).join("")}
        <div class="card">
          <p class="eyebrow">Write your own ${esc(cat.label.toLowerCase())} text</p>
          <form class="stack" data-form="custom-text">
            <textarea name="text" rows="3" placeholder="Save a message that's very you…" required maxlength="400"></textarea>
            <div class="row"><button class="btn primary sm" type="submit">Save to ${esc(cat.label)}</button></div>
          </form>
          ${state.customTexts.filter(t => t.cat === textCat).length ? `<div class="list" style="margin-top:10px">${state.customTexts.filter(t => t.cat === textCat).map(t => `<div class="list-item"><div class="grow small">${esc(t.text)}</div><button class="btn ghost sm danger" data-action="del-custom-text" data-id="${t.id}">✕</button></div>`).join("")}</div>` : ""}
        </div>
      </div>`;
  };

  // ----- Reassurance -----
  views.reassure = () => {
    const all = allReassurances();
    return `
      <div class="page-head">
        <div><h1>Reassurance</h1><p>Feeling secure is built from small, consistent words. Send one of these, or use the right line for the moment.</p></div>
        <button class="btn primary" data-action="random-reassure">🎲 Give me one</button>
      </div>
      <div class="grid two">
        <div class="card span-2" id="reassure-pick" style="background:var(--accent-soft);border-color:transparent">
          <p class="eyebrow">Today's reassurance</p>
          <p class="quote">${esc(pickDaily(all, 2))}</p>
          <div style="margin-top:12px">${msgActions(pickDaily(all, 2))}</div>
        </div>
        <div class="card">
          <h2 style="margin-bottom:6px">For the moment</h2>
          <div class="list">${D.reassuranceMoments.map(m => `
            <div class="list-item"><div class="grow">
              <div class="muted small" style="font-weight:600">${esc(m.when)}</div>
              <div style="margin:4px 0 8px">“${esc(m.say.replace(/\*/g, ""))}”</div>
              ${msgActions(m.say.replace(/\*/g, ""))}
            </div></div>`).join("")}</div>
        </div>
        <div class="card">
          <h2 style="margin-bottom:6px">Reassurance library</h2>
          <form class="row" data-form="reassure" style="margin:10px 0">
            <input type="text" name="text" placeholder="Add your own…" required maxlength="300" style="flex:1;min-width:160px">
            <button class="btn primary" type="submit">Add</button>
          </form>
          <div class="list">${all.map((r, i) => `
            <div class="list-item"><div class="grow">${esc(r)}</div>
              <button class="btn ghost sm" data-action="copy" data-text="${esc(r)}">📋</button>
              ${i < state.customReassurances.length ? `<button class="btn ghost sm danger" data-action="del-reassure" data-i="${i}">✕</button>` : ""}
            </div>`).join("")}</div>
        </div>
      </div>`;
  };

  // ----- Compliment jar -----
  let jarSort = "top", jarPulled = null, draftRating = 4;
  function hearts(n, id) {
    return `<span class="hearts">${[1, 2, 3, 4, 5].map(i => id === null
      ? `<span style="${i <= n ? "" : "filter:grayscale(1);opacity:.3"}">❤️</span>`
      : `<button type="button" class="${i <= n ? "on" : ""}" data-action="${id === "draft" ? "draft-rate" : "rate"}" data-id="${id}" data-n="${i}" aria-label="${i} hearts">❤️</button>`).join("")}</span>`;
  }
  views.jar = () => {
    const list = jarSort === "top" ? topCompliments() : [...state.compliments].sort((a, b) => b.date.localeCompare(a.date));
    const pulled = jarPulled && state.compliments.find(c => c.id === jarPulled);
    return `
      <div class="page-head">
        <div><h1>Compliment Jar</h1><p>Save the compliments that really landed — and rate how much she loved it — so you learn what makes her light up.</p></div>
      </div>
      <div class="grid two">
        <div class="card">
          <h2 style="margin-bottom:12px">Drop one in</h2>
          <form class="stack" data-form="compliment">
            <textarea name="text" rows="3" placeholder="${esc(pickDaily(D.complimentStarters))}" required maxlength="400"></textarea>
            <label class="field">How did she react? (optional)<input type="text" name="reaction" placeholder="She blushed and said 'stop it' 😂" maxlength="160"></label>
            <div class="row"><span class="muted small" style="font-weight:600">Approval:</span>${hearts(draftRating, "draft")}<span class="spacer"></span><button class="btn primary" type="submit">Add to jar</button></div>
          </form>
          <p class="eyebrow" style="margin-top:20px">Starters</p>
          <div class="chips">${D.complimentStarters.map(s => `<button class="chip" data-action="starter" data-text="${esc(s)}">${esc(s)}</button>`).join("")}</div>
        </div>
        <div class="card jar-pull">
          <div class="jar-emoji">🫙</div>
          <p class="muted" style="margin:6px 0 14px">${state.compliments.length} compliment${state.compliments.length === 1 ? "" : "s"} in the jar</p>
          ${pulled ? `<p class="quote">“${esc(pulled.text)}”</p><p style="margin-top:8px">${hearts(pulled.rating, null)}</p>${pulled.reaction ? `<p class="muted small" style="margin-top:4px">${esc(pulled.reaction)}</p>` : ""}<div class="row" style="justify-content:center;margin-top:14px">${msgActions(pulled.text).replace(/^<div class="row">|<\/div>$/g, "")}</div>` : ""}
          <button class="btn ${pulled ? "" : "primary"}" style="margin-top:14px" data-action="pull" ${state.compliments.length ? "" : "disabled"}>✨ Pull one from the jar</button>
          <p class="muted small" style="margin-top:8px">Favors the ones she loved most.</p>
        </div>
        <div class="card span-2">
          <div class="card-head"><h2>Everything in the jar</h2>
            <div class="chips"><button class="chip ${jarSort === "top" ? "on" : ""}" data-action="jar-sort" data-sort="top">Most loved</button><button class="chip ${jarSort === "new" ? "on" : ""}" data-action="jar-sort" data-sort="new">Newest</button></div>
          </div>
          <div class="list">${list.length ? list.map(c => `
            <div class="list-item">
              <div class="grow"><div style="font-size:16px">“${esc(c.text)}”</div>
                <div class="muted small" style="margin-top:4px">${new Date(c.date + "T00:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}${c.reaction ? " · " + esc(c.reaction) : ""}</div></div>
              ${hearts(c.rating, c.id)}
              <button class="btn ghost sm danger" data-action="del-compliment" data-id="${c.id}" aria-label="Delete">✕</button>
            </div>`).join("") : `<p class="empty">The jar is empty. Next time she smiles at something you said, write it down.</p>`}</div>
        </div>
      </div>`;
  };

  // ----- Favorites -----
  views.favorites = () => `
    <div class="page-head">
      <div><h1>${esc(state.settings.partnerName ? state.settings.partnerName + "'s" : "Her")} Favorite Things</h1><p>The moment she mentions something she loves, write it down here. Future-you (and every birthday) will thank you.</p></div>
    </div>
    <div class="card" style="margin-bottom:16px">
      <form class="form-row" data-form="favorite">
        <label class="field">Category<select name="category">${D.favoriteCategories.map(c => `<option value="${c.id}">${c.icon} ${c.label}</option>`).join("")}</select></label>
        <label class="field" style="grid-column:span 2">Favorite<input type="text" name="value" placeholder="Iced oat-milk vanilla latte" required maxlength="160"></label>
        <label class="field">Note (optional)<input type="text" name="note" placeholder="from the place on 5th" maxlength="160"></label>
        <button class="btn primary" type="submit">Add</button>
      </form>
    </div>
    <div class="fav-grid">
      ${D.favoriteCategories.map(c => {
        const items = state.favorites.filter(f => f.category === c.id);
        return `<div class="card">
          <div class="card-head"><h3>${c.icon} ${esc(c.label)}</h3><span class="tag">${items.length}</span></div>
          ${items.length ? items.map(f => `<div class="fav-item"><div class="grow"><div>${esc(f.value)}</div>${f.note ? `<div class="note">${esc(f.note)}</div>` : ""}</div><button class="btn ghost sm danger" data-action="del-fav" data-id="${f.id}" aria-label="Delete">✕</button></div>`).join("")
            : `<p class="muted small">${esc(c.hint)}</p>`}
        </div>`;
      }).join("")}
    </div>`;

  // ----- Connect -----
  let qIndex = dayNum() % D.questions.length;
  views.connect = () => `
    <div class="page-head">
      <div><h1>Connect</h1><p>Ways to feel close over the phone — calls, voice notes, questions, and phone dates.</p></div>
      ${state.settings.partnerPhone ? `<div class="row"><a class="btn primary" href="${esc(telHref())}">📞 Call</a><a class="btn" href="facetime:${esc((state.settings.partnerPhone || "").replace(/[^\d+]/g, ""))}">🎥 FaceTime</a><a class="btn" href="${esc(smsHref(""))}">💬 Message</a></div>` : `<a class="btn" href="#settings">Add her number for one-tap calling</a>`}
    </div>
    <div class="grid two">
      <div class="card" style="background:var(--accent-soft);border-color:transparent">
        <p class="eyebrow">❓ Question deck · ${qIndex + 1} / ${D.questions.length}</p>
        <p class="quote" style="min-height:58px">${esc(D.questions[qIndex])}</p>
        <div class="row" style="margin-top:14px">
          <button class="btn" data-action="q-prev">←</button><button class="btn primary" data-action="q-next">Next question →</button>
          <button class="btn ghost sm" data-action="copy" data-text="${esc(D.questions[qIndex])}">📋 Copy</button>
        </div>
      </div>
      <div class="card">
        <p class="eyebrow">🎙️ Voice-note prompts</p>
        <div class="list">${D.voiceNotes.map(v => `<div class="list-item"><div class="grow">${esc(v)}</div></div>`).join("")}</div>
      </div>
      <div class="card span-2">
        <h2 style="margin-bottom:14px">Phone date ideas</h2>
        <div class="grid three">${D.callIdeas.map(c => `<div style="padding:14px;border:1px solid var(--line);border-radius:12px"><div style="font-size:22px">${c.icon}</div><h3 style="margin:6px 0 4px">${esc(c.title)}</h3><p class="muted small">${esc(c.text)}</p></div>`).join("")}</div>
      </div>
    </div>`;

  // ----- Plan -----
  views.plan = () => {
    const cur = planWeek();
    const wk = D.plan[cur];
    const strip = [...Array(7)].map((_, i) => {
      const d = new Date(); d.setDate(d.getDate() - (6 - i));
      const h = state.habits[dateKey(d)] || {};
      const n = D.habits.filter(x => h[x.id]).length;
      const pct = n / D.habits.length;
      return `<div><i style="background:${n ? `color-mix(in srgb, var(--accent) ${20 + pct * 80}%, var(--surface-2))` : "var(--surface-2)"}"></i>${DAYS[d.getDay()][0]}</div>`;
    }).join("");
    const totalTasks = D.plan.length * 3;
    const doneTasks = Object.values(state.planTasks).filter(Boolean).length;
    return `
      <div class="page-head">
        <div><h1>Growth Plan</h1><p>A 12-week boyfriend improvement plan. One theme a week, three challenges, and a daily habit checklist. Progress, not perfection.</p></div>
        <div style="min-width:220px"><p class="muted small" style="margin-bottom:6px">${doneTasks} / ${totalTasks} challenges complete</p><div class="progress"><div style="width:${(doneTasks / totalTasks) * 100}%"></div></div></div>
      </div>
      <div class="grid two">
        <div class="card" style="background:var(--accent-soft);border-color:transparent">
          <p class="eyebrow">This week · Week ${cur + 1} of ${D.plan.length}</p>
          <h2 style="font-size:26px">${esc(wk.theme)}</h2>
          <p style="font-weight:600;margin:6px 0 10px">${esc(wk.focus)}</p>
          ${wk.tasks.map((t, i) => taskCheck(cur, i, t)).join("")}
          <p class="muted small" style="margin-top:12px">💡 ${esc(wk.tip)}</p>
        </div>
        <div class="card">
          <div class="card-head"><p class="eyebrow">Daily habits — today</p><span class="tag">🔥 ${habitStreak()} day streak</span></div>
          ${habitChecklist()}
          <p class="eyebrow" style="margin-top:14px">Last 7 days</p>
          <div class="week-strip">${strip}</div>
        </div>
        <div class="card span-2">
          <div class="card-head"><h2>All 12 weeks</h2><button class="btn ghost sm" data-action="restart-plan">Restart from week 1</button></div>
          <div class="weeks">${D.plan.map((w, i) => {
            const n = [0, 1, 2].filter(j => state.planTasks[`${i}-${j}`]).length;
            return `<div class="week ${i === cur ? "now" : i < cur ? "past" : ""}"><div class="muted small">Week ${i + 1} ${n === 3 ? "✅" : n ? `· ${n}/3` : ""}</div><div style="font-weight:600">${esc(w.theme)}</div><div class="muted small">${esc(w.focus)}</div></div>`;
          }).join("")}</div>
        </div>
      </div>`;
  };

  // ----- Settings -----
  views.settings = () => {
    const s = state.settings;
    return `
      <div class="page-head"><div><h1>Settings</h1><p>Your data is saved in this browser only. Use export/import to move it to your display screen or another device.</p></div></div>
      <div class="grid two">
        <div class="card">
          <form class="stack" data-form="settings">
            <div class="form-row">
              <label class="field">Your name<input type="text" name="yourName" value="${esc(s.yourName)}" maxlength="40"></label>
              <label class="field">Partner's name<input type="text" name="partnerName" value="${esc(s.partnerName)}" maxlength="40"></label>
            </div>
            <div class="form-row">
              <label class="field">Partner's phone<input type="tel" name="partnerPhone" value="${esc(s.partnerPhone)}" placeholder="+1 555 123 4567" maxlength="30"></label>
              <label class="field">Together since<input type="date" name="startDate" value="${esc(s.startDate)}"></label>
            </div>
            <div class="form-row">
              <label class="field">Display mode: seconds per slide<input type="number" name="displaySeconds" min="5" max="120" value="${esc(s.displaySeconds)}"></label>
              <label class="field">Theme<select name="theme">${["auto", "light", "dark"].map(t => `<option ${s.theme === t ? "selected" : ""}>${t}</option>`).join("")}</select></label>
            </div>
            <div class="row"><button class="btn primary" type="submit">Save</button></div>
          </form>
        </div>
        <div class="card stack">
          <h2>Digital screen</h2>
          <p class="muted small">Open the app on your screen and press <b>Display mode</b>, or add <code>?display</code> to the URL so it boots straight into the rotating dashboard.</p>
          <div class="row"><button class="btn" data-action="display-on">🖥️ Start display mode</button></div>
          <h2 style="margin-top:10px">Backup</h2>
          <div class="row">
            <button class="btn" data-action="export">⬇️ Export data</button>
            <label class="btn">⬆️ Import data<input type="file" accept="application/json" data-action="import" hidden></label>
          </div>
          <button class="btn ghost sm danger" style="align-self:flex-start;margin-top:10px" data-action="reset">Reset everything</button>
        </div>
      </div>`;
  };

  // ---------- router ----------
  function current() { const h = location.hash.slice(1); return views[h] ? h : "home"; }
  function render() {
    const v = current();
    view.innerHTML = views[v]();
    document.querySelectorAll("#nav a").forEach(a => a.classList.toggle("active", a.dataset.view === v));
    if (v === "tone") updateTone();
  }
  function navigate() { render(); view.focus({ preventScroll: true }); window.scrollTo(0, 0); }
  window.addEventListener("hashchange", navigate);

  function applyTheme() {
    const t = state.settings.theme;
    if (t === "auto") document.documentElement.removeAttribute("data-theme");
    else document.documentElement.setAttribute("data-theme", t);
  }

  // ---------- events ----------
  document.addEventListener("click", e => {
    const el = e.target.closest("[data-action]");
    if (!el || el.tagName === "INPUT") return;
    const a = el.dataset.action, id = el.dataset.id;
    const rerender = () => { save(); render(); };

    switch (a) {
      case "copy": copy(el.dataset.text); break;
      case "display-on": startDisplay(); break;
      case "display-off": stopDisplay(); break;

      case "notify-perm": Notification.requestPermission().then(render); break;
      case "draft-day": {
        const d = +el.dataset.day;
        reminderDraftDays = reminderDraftDays.includes(d) ? reminderDraftDays.filter(x => x !== d) : [...reminderDraftDays, d].sort();
        el.classList.toggle("on"); break;
      }
      case "quick-reminder":
        state.reminders.push({ id: uid(), title: el.dataset.title, time: el.dataset.time, category: el.dataset.cat, days: [0, 1, 2, 3, 4, 5, 6], enabled: true, lastFired: "" });
        toast("Reminder added — edit the days by re-adding if needed"); rerender(); break;
      case "del-reminder": state.reminders = state.reminders.filter(r => r.id !== id); rerender(); break;

      case "tone": toneSel = el.dataset.tone; toneSeed = 0; document.querySelectorAll('[data-action="tone"]').forEach(c => c.classList.toggle("on", c === el)); updateTone(); break;
      case "tone-again": toneSeed++; updateTone(); break;
      case "tone-use": {
        const out = Tone.rewrite(toneText, toneSel, toneSeed, state.settings.partnerName);
        $("#tone-input").value = out; updateTone(); $("#tone-input").focus(); break;
      }
      case "copy-is": copy($("#is-out").textContent || ""); break;
      case "is-to-tone": $("#tone-input").value = $("#is-out").textContent; updateTone(); break;

      case "text-cat": textCat = el.dataset.cat; render(); break;
      case "del-custom-text": state.customTexts = state.customTexts.filter(t => t.id !== id); rerender(); break;

      case "random-reassure": {
        const r = allReassurances()[Math.floor(Math.random() * allReassurances().length)];
        $("#reassure-pick").innerHTML = `<p class="eyebrow">Here's one</p><p class="quote">${esc(r)}</p><div style="margin-top:12px">${msgActions(r)}</div>`;
        break;
      }
      case "del-reassure": state.customReassurances.splice(+el.dataset.i, 1); rerender(); break;

      case "draft-rate": draftRating = +el.dataset.n; el.parentElement.querySelectorAll("button").forEach((b, i) => b.classList.toggle("on", i < draftRating)); break;
      case "rate": { const c = state.compliments.find(x => x.id === id); if (c) c.rating = +el.dataset.n; rerender(); break; }
      case "del-compliment": state.compliments = state.compliments.filter(c => c.id !== id); if (jarPulled === id) jarPulled = null; rerender(); break;
      case "jar-sort": jarSort = el.dataset.sort; render(); break;
      case "pull": {
        // weighted by rating (rating² so the 5-heart ones show up most)
        const pool = state.compliments.flatMap(c => Array(c.rating * c.rating).fill(c.id));
        let next = pool[Math.floor(Math.random() * pool.length)];
        if (state.compliments.length > 1) while (next === jarPulled) next = pool[Math.floor(Math.random() * pool.length)];
        jarPulled = next; render(); break;
      }
      case "starter": { const ta = document.querySelector('[data-form="compliment"] textarea'); ta.value = el.dataset.text.replace("…", " "); ta.focus(); break; }

      case "del-fav": state.favorites = state.favorites.filter(f => f.id !== id); rerender(); break;

      case "q-next": qIndex = (qIndex + 1) % D.questions.length; render(); break;
      case "q-prev": qIndex = (qIndex - 1 + D.questions.length) % D.questions.length; render(); break;

      case "restart-plan": if (confirm("Restart the plan from week 1 and clear challenge checkmarks?")) { state.planStart = dateKey(); state.planTasks = {}; rerender(); } break;

      case "export": {
        const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
        const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `boyfriend-plan-backup-${dateKey()}.json`; link.click();
        URL.revokeObjectURL(link.href); break;
      }
      case "reset": if (confirm("Erase all your data on this device? This can't be undone.")) { state = defaults(); save(); applyTheme(); location.hash = "#home"; render(); } break;
    }
  });

  document.addEventListener("change", e => {
    const el = e.target;
    const a = el.dataset.action;
    if (a === "habit") {
      const k = dateKey();
      state.habits[k] = state.habits[k] || {};
      state.habits[k][el.dataset.id] = el.checked;
      save(); render();
      if (el.checked && D.habits.every(h => state.habits[k][h.id])) toast("All habits done today! 🔥 She's lucky — and so are you.");
    } else if (a === "plantask") {
      state.planTasks[el.dataset.id] = el.checked; save(); render();
    } else if (a === "toggle-reminder") {
      const r = state.reminders.find(x => x.id === el.dataset.id); if (r) r.enabled = el.checked; save();
    } else if (a === "import") {
      const f = el.files[0]; if (!f) return;
      f.text().then(txt => {
        try { state = Object.assign(defaults(), JSON.parse(txt)); save(); applyTheme(); render(); toast("Data imported ✓"); }
        catch { toast("That file couldn't be read."); }
      });
    }
  });

  document.addEventListener("input", e => {
    if (e.target.id === "tone-input") updateTone();
    if (e.target.id?.startsWith("is-")) updateIS();
  });

  document.addEventListener("submit", e => {
    const form = e.target.closest("[data-form]");
    if (!form) return;
    e.preventDefault();
    const f = Object.fromEntries(new FormData(form));
    switch (form.dataset.form) {
      case "reminder":
        if (!reminderDraftDays.length) { toast("Pick at least one day"); return; }
        state.reminders.push({ id: uid(), title: f.title.trim(), time: f.time, category: f.category, days: [...reminderDraftDays], enabled: true, lastFired: "" });
        toast("Reminder added ⏰"); break;
      case "custom-text": state.customTexts.unshift({ id: uid(), cat: textCat, text: f.text.trim() }); toast("Saved"); break;
      case "reassure": state.customReassurances.unshift(f.text.trim()); break;
      case "compliment":
        state.compliments.unshift({ id: uid(), text: f.text.trim(), reaction: (f.reaction || "").trim(), rating: draftRating, date: dateKey() });
        draftRating = 4; toast("Into the jar 🫙"); break;
      case "favorite": state.favorites.push({ id: uid(), category: f.category, value: f.value.trim(), note: (f.note || "").trim() }); toast("Saved ⭐"); break;
      case "settings":
        state.settings = { ...state.settings, ...f, displaySeconds: Math.max(5, Math.min(120, +f.displaySeconds || 15)) };
        applyTheme(); toast("Settings saved"); break;
    }
    save(); render();
  });

  // ---------- reminder engine ----------
  function checkReminders() {
    const now = new Date();
    const hhmm = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
    const today = dateKey(now);
    let fired = false;
    state.reminders.forEach(r => {
      if (!r.enabled || !r.days.includes(now.getDay()) || r.time !== hhmm || r.lastFired === today) return;
      r.lastFired = today; fired = true;
      const msg = `${catIcon(r.category)} ${r.title}`;
      toast(msg);
      if ("Notification" in window && Notification.permission === "granted") {
        try { new Notification("Boyfriend Improvement Plan", { body: r.title }); } catch {}
      }
      if (!$("#display").hidden) showReminderSlide(r);
    });
    if (fired) save();
  }
  setInterval(checkReminders, 15000);

  // ---------- display mode (for the digital screen) ----------
  let slideIdx = 0, slideTimer = null, clockTimer = null, overrideSlide = null;
  function slides() {
    const s = state.settings;
    const hour = new Date().getHours();
    const out = [];
    out.push(() => {
      const now = new Date();
      const days = daysTogether();
      return `<div class="d-clock">${now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</div>
        <div class="d-sub">${now.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${days !== null ? ` · ${days.toLocaleString()} days with ${esc(pName())} 💞` : ""}</div>`;
    });
    const textCat = hour < 12 ? "morning" : hour >= 20 ? "night" : "thinking";
    out.push(() => `<div class="d-eyebrow">📱 Text ${esc(pName())}</div><div class="d-main">${esc(fillName(pickDaily(textsFor(textCat), 1)))}</div>`);
    const up = upcomingReminders(4);
    if (up.length) out.push(() => `<div class="d-eyebrow">⏰ Coming up</div><ul class="d-list">${upcomingReminders(4).map(({ r, at }) => `<li>${catIcon(r.category)} <b>${esc(r.title)}</b> <span style="opacity:.6">— ${whenLabel(at)}</span></li>`).join("")}</ul>`);
    out.push(() => `<div class="d-eyebrow">🤍 Reassurance</div><div class="d-main">${esc(pickDaily(allReassurances(), 2))}</div>`);
    out.push(() => {
      const wk = D.plan[planWeek()];
      return `<div class="d-eyebrow">📈 Week ${planWeek() + 1} · ${esc(wk.theme)}</div><div class="d-main">${esc(wk.focus)}</div>
        <ul class="d-list">${wk.tasks.map((t, i) => `<li>${state.planTasks[`${planWeek()}-${i}`] ? "✅" : "⬜️"} ${esc(t)}</li>`).join("")}</ul>`;
    });
    if (state.compliments.length) out.push(() => {
      const c = topCompliments()[dayNum() % Math.min(5, state.compliments.length)];
      return `<div class="d-eyebrow">🫙 From the compliment jar</div><div class="d-main">“${esc(c.text)}”</div><div class="d-sub">${"❤️".repeat(c.rating)}</div>`;
    });
    if (state.favorites.length) out.push(() => {
      const f = pickDaily(state.favorites, 5);
      const c = D.favoriteCategories.find(x => x.id === f.category);
      return `<div class="d-eyebrow">⭐ Remember · ${c ? esc(c.label) : ""}</div><div class="d-main">${esc(f.value)}</div>${f.note ? `<div class="d-sub">${esc(f.note)}</div>` : ""}`;
    });
    out.push(() => {
      const h = state.habits[dateKey()] || {};
      return `<div class="d-eyebrow">✅ Today's habits · 🔥 ${habitStreak()} day streak</div>
        <ul class="d-list">${D.habits.map(x => `<li style="${h[x.id] ? "opacity:.5;text-decoration:line-through" : ""}">${h[x.id] ? "✅" : x.icon} ${esc(x.label)}</li>`).join("")}</ul>`;
    });
    out.push(() => `<div class="d-eyebrow">❓ Ask ${esc(pName())} tonight</div><div class="d-main">${esc(pickDaily(D.questions, 4))}</div>`);
    return out;
  }
  function showSlide() {
    const list = slides();
    slideIdx = slideIdx % list.length;
    const inner = $("#display-inner");
    inner.style.animation = "none"; void inner.offsetWidth; inner.style.animation = "";
    inner.innerHTML = overrideSlide || list[slideIdx]();
    $("#display-dots").innerHTML = list.map((_, i) => `<i class="${i === slideIdx && !overrideSlide ? "on" : ""}"></i>`).join("");
  }
  function showReminderSlide(r) {
    overrideSlide = `<div class="d-eyebrow">⏰ Reminder</div><div class="d-main">${catIcon(r.category)} ${esc(r.title)}</div><div class="d-sub">${fmtTime(r.time)}</div>`;
    showSlide();
    setTimeout(() => { overrideSlide = null; showSlide(); }, 60000);
  }
  function startDisplay() {
    $("#display").hidden = false;
    slideIdx = 0; showSlide();
    clearInterval(slideTimer); clearInterval(clockTimer);
    slideTimer = setInterval(() => { if (!overrideSlide) { slideIdx++; showSlide(); } }, (state.settings.displaySeconds || 15) * 1000);
    clockTimer = setInterval(() => { if (slideIdx === 0 && !overrideSlide) $("#display-inner .d-clock") && ($("#display-inner .d-clock").textContent = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })); }, 10000);
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) document.documentElement.requestFullscreen().catch(() => {});
  }
  function stopDisplay() {
    $("#display").hidden = true;
    clearInterval(slideTimer); clearInterval(clockTimer);
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    if (new URLSearchParams(location.search).has("display")) history.replaceState(null, "", location.pathname + location.hash);
    render();
  }
  document.addEventListener("keydown", e => {
    if ($("#display").hidden) return;
    if (e.key === "Escape") stopDisplay();
    if (e.key === "ArrowRight") { overrideSlide = null; slideIdx++; showSlide(); }
    if (e.key === "ArrowLeft") { overrideSlide = null; slideIdx = (slideIdx - 1 + slides().length) % slides().length; showSlide(); }
  });

  // ---------- boot ----------
  applyTheme();
  render();
  checkReminders();
  if (new URLSearchParams(location.search).has("display")) startDisplay();
})();
