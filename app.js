/* My Journal — local-first premium PWA (no server)
   Tabs:
   - Home: daily prompt, streak, prayer, devotional, recent
   - Write: journal editor
   - Entries: search, view, delete, export/import
   - Companion: local guided chat
   - Settings: accent, wipe
*/

const LS = {
  entries: "mj_entries_v2",
  streak: "mj_streak_v2",
  promptSeed: "mj_prompt_seed_v2",
  prayerSeed: "mj_prayer_seed_v2",
  devoSeed: "mj_devo_seed_v2",
  chat: "mj_chat_v2",
  accent: "mj_accent_v2",
};

const $ = (id) => document.getElementById(id);
const tabs = Array.from(document.querySelectorAll(".tab"));
const screens = Array.from(document.querySelectorAll("[data-screen]"));

/* Content banks (original) */
const PROMPTS = [
  { text: "What’s heavy on your mind right now? Say it plainly.", tags: ["honesty","clarity"] },
  { text: "What am I grateful for today — even if it’s small?", tags: ["gratitude","perspective"] },
  { text: "Where do I need guidance today?", tags: ["guidance","wisdom"] },
  { text: "What fear is running the show lately?", tags: ["fear","calm"] },
  { text: "What would peace look like today — practically?", tags: ["peace","action"] },
  { text: "What do I need strength for today?", tags: ["strength","discipline"] },
  { text: "What’s one thing I can do to be kinder (to me or others)?", tags: ["kindness","growth"] },
];

const PRAYER_TEMPLATES = [
  (c)=>`God, I’m here.\nI’m feeling ${c.feel}.\nGive me clarity for ${c.focus}.\nHelp me take the next right step, even if it’s small.\nAmen.`,
  (c)=>`God, steady me.\nQuiet the noise in my head.\nTeach me patience.\nGuide me toward peace and good habits.\nAmen.`,
  (c)=>`God, I need strength.\nI don’t want to pretend I’m fine.\nHelp me face ${c.focus} with courage.\nReplace fear with wisdom.\nAmen.`,
  (c)=>`God, thank you for today.\nFor one good thing: ${c.grat}.\nHelp me notice what matters.\nKeep my heart soft and my mind focused.\nAmen.`,
];

const DEVOTIONALS = [
  { title: "Small Steps, Real Change", body: "You don’t need a perfect day — you need a true one.\nPick one habit, one decision, one moment of honesty.\nGrowth is usually quiet." },
  { title: "Peace Is a Practice", body: "Peace isn’t the absence of pressure.\nIt’s choosing your response while pressure exists.\nBreathe. Slow down. Then act." },
  { title: "Integrity Over Mood", body: "Motivation comes and goes.\nIntegrity stays.\nDo the right thing even when you don’t feel like it — that’s where strength is built." },
  { title: "Grace for the Process", body: "Be serious about change, but gentle with yourself.\nYou can be disciplined without being cruel.\nStart again — as many times as it takes." },
];

/* Utilities */
function load(key, fallback){
  try{ const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
  catch{ return fallback; }
}
function save(key, val){ localStorage.setItem(key, JSON.stringify(val)); }
function pad(n){ return String(n).padStart(2,"0"); }
function todayKey(d=new Date()){ return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
function niceDate(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function rand(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function stableIndex(dateStr, seedKey, mod, offset=0){
  let seed = load(seedKey, null);
  if(seed === null){ seed = Math.floor(Math.random()*1e9); save(seedKey, seed); }
  let h = (seed + offset) >>> 0;
  for(const ch of dateStr){ h = (h * 31 + ch.charCodeAt(0)) >>> 0; }
  return h % mod;
}

/* State */
let entries = load(LS.entries, []);
let chat = load(LS.chat, []);
let promptOffset = 0;
let prayerOffset = 0;
let devoOffset = 0;

/* Elements */
const todayLine = $("todayLine");
const todayLabel = $("todayLabel");
const streakStat = $("streakStat");

const promptText = $("promptText");
const promptTags = $("promptTags");
const shufflePromptBtn = $("shufflePromptBtn");
const writeBtn = $("writeBtn");
const quickBtn = $("quickBtn");

const prayerText = $("prayerText");
const regenPrayerBtn = $("regenPrayerBtn");
const copyPrayerBtn = $("copyPrayerBtn");
const savePrayerBtn = $("savePrayerBtn");

const devoTitle = $("devoTitle");
const devoBody = $("devoBody");
const regenDevoBtn = $("regenDevoBtn");
const reflectBtn = $("reflectBtn");
const talkBtn = $("talkBtn");

const recentList = $("recentList");
const recentEmpty = $("recentEmpty");
const viewAllBtn = $("viewAllBtn");

const titleInput = $("titleInput");
const entryInput = $("entryInput");
const saveEntryBtn = $("saveEntryBtn");
const clearEntryBtn = $("clearEntryBtn");
const saveHint = $("saveHint");
const draftBadge = $("draftBadge");

const entriesList = $("entriesList");
const entriesEmpty = $("entriesEmpty");
const searchInput = $("searchInput");
const exportBtn = $("exportBtn");
const importFile = $("importFile");

const chatLog = $("chatLog");
const chatInput = $("chatInput");
const sendChatBtn = $("sendChatBtn");
const clearChatBtn = $("clearChatBtn");

const accentSelect = $("accentSelect");
const wipeAllBtn = $("wipeAllBtn");

/* Navigation */
function showScreen(name){
  screens.forEach(s => s.hidden = (s.id !== `screen-${name}`));
  tabs.forEach(t => t.classList.toggle("active", t.dataset.nav === name));
  if(name === "home") renderHome();
  if(name === "entries") renderEntries();
  if(name === "companion") renderChat();
}
tabs.forEach(t => t.addEventListener("click", ()=> showScreen(t.dataset.nav)));

/* Streak */
function updateStreak(dateStr){
  const streak = load(LS.streak, { count:0, last:null });
  if(streak.last === dateStr){
    // no change
  } else if(!streak.last){
    streak.count = 1; streak.last = dateStr;
  } else {
    const last = new Date(streak.last + "T00:00:00");
    const cur = new Date(dateStr + "T00:00:00");
    const diff = Math.round((cur - last) / (24*3600*1000));
    streak.count = (diff === 1) ? (streak.count + 1) : 1;
    streak.last = dateStr;
  }
  save(LS.streak, streak);
}
function getStreak(){ return load(LS.streak, { count:0, last:null }); }

/* Prompt/prayer/devo render */
function renderPrompt(){
  const idx = stableIndex(todayKey(), LS.promptSeed, PROMPTS.length, promptOffset);
  const p = PROMPTS[idx];
  promptText.textContent = p.text;
  promptTags.innerHTML = "";
  p.tags.forEach(t=>{
    const s = document.createElement("span");
    s.className = "chip";
    s.textContent = t;
    promptTags.appendChild(s);
  });
}

function renderPrayer(){
  const idx = stableIndex(todayKey(), LS.prayerSeed, PRAYER_TEMPLATES.length, prayerOffset);
  const ctx = {
    feel: rand(["tired","hopeful","anxious","restless","thankful","conflicted","focused"]),
    focus: rand(["my habits","my thoughts","my decisions","my family","my future","my work","my discipline"]),
    grat: rand(["my breath","a second chance","a friend","a quiet moment","a lesson learned","food and shelter"]),
  };
  prayerText.textContent = PRAYER_TEMPLATES[idx](ctx);
}

function renderDevo(){
  const idx = stableIndex(todayKey(), LS.devoSeed, DEVOTIONALS.length, devoOffset);
  devoTitle.textContent = DEVOTIONALS[idx].title;
  devoBody.textContent = DEVOTIONALS[idx].body;
}

/* Entries */
function addEntry({title, text, source}){
  const t = (text || "").trim();
  if(!t) return { ok:false };
  const now = Date.now();
  const entry = {
    id: `${now}_${Math.random().toString(16).slice(2)}`,
    ts: now,
    date: todayKey(),
    title: (title || "").trim() || (source === "prayer" ? "Prayer of the Day" : source === "devotional" ? "Devotional Reflection" : "Journal Entry"),
    text: t,
    source: source || "journal",
  };
  entries.unshift(entry);
  save(LS.entries, entries);
  updateStreak(entry.date);
  return { ok:true, entry };
}

function deleteEntry(id){
  entries = entries.filter(e => e.id !== id);
  save(LS.entries, entries);
}

function entryCard(e){
  const div = document.createElement("div");
  div.className = "item";

  const top = document.createElement("div");
  top.className = "itemTop";

  const left = document.createElement("div");
  const title = document.createElement("div");
  title.className = "itemTitle";
  title.textContent = e.title || "Entry";
  const meta = document.createElement("div");
  meta.className = "itemMeta";
  meta.textContent = `${niceDate(e.ts)} • ${e.source}`;
  left.appendChild(title);
  left.appendChild(meta);

  const actions = document.createElement("div");
  actions.className = "itemActions";

  const openBtn = document.createElement("button");
  openBtn.className = "pill ghost";
  openBtn.textContent = "Open";
  openBtn.addEventListener("click", ()=>{
    titleInput.value = e.title || "";
    entryInput.value = e.text || "";
    draftBadge.textContent = "Loaded";
    saveHint.textContent = `Loaded • If you save now, it creates a new entry.`;
    showScreen("journal");
    entryInput.focus();
  });

  const delBtn = document.createElement("button");
  delBtn.className = "pill danger";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", ()=>{
    if(confirm("Delete this entry?")){
      deleteEntry(e.id);
      renderHome();
      renderEntries();
    }
  });

  actions.appendChild(openBtn);
  actions.appendChild(delBtn);

  top.appendChild(left);
  top.appendChild(actions);

  const body = document.createElement("div");
  body.className = "itemBody";
  body.textContent = (e.text.length > 220) ? (e.text.slice(0,220) + "…") : e.text;

  div.appendChild(top);
  div.appendChild(body);
  return div;
}

function renderRecent(){
  recentList.innerHTML = "";
  const recent = entries.slice(0,3);
  if(recent.length === 0){ recentEmpty.style.display = "block"; return; }
  recentEmpty.style.display = "none";
  recent.forEach(e => recentList.appendChild(entryCard(e)));
}

function renderEntries(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const list = q
    ? entries.filter(e => (e.title||"").toLowerCase().includes(q) || (e.text||"").toLowerCase().includes(q))
    : entries;

  entriesList.innerHTML = "";
  if(list.length === 0){ entriesEmpty.style.display = "block"; return; }
  entriesEmpty.style.display = "none";
  list.slice(0,80).forEach(e => entriesList.appendChild(entryCard(e)));
}

/* Companion chat */
function addChat(role, text){
  chat.push({ role, text, ts: Date.now() });
  save(LS.chat, chat);
}
function companionReply(userText){
  const t = userText.toLowerCase();
  if(t.includes("pray")) return "Alright. Give me the main thing in one sentence. Then we’ll turn it into a short prayer you can actually say.";
  if(t.includes("stress") || t.includes("anx") || t.includes("panic")) return "Okay. Inhale 4, hold 2, exhale 6 — twice. Then tell me: what’s the one thing you can control right now?";
  if(t.includes("prompt")) return "Three prompts:\n• " + [rand(PROMPTS).text, rand(PROMPTS).text, rand(PROMPTS).text].join("\n• ");
  if(t.includes("devotional") || t.includes("reflection")){
    const d = rand(DEVOTIONALS);
    return `${d.title}\n${d.body}\n\nWant a one-sentence action for today?`;
  }
  return "Say it straight: what are you feeling, and what do you need most — peace, direction, strength, or forgiveness?";
}
function renderChat(){
  chatLog.innerHTML = "";
  if(chat.length === 0){
    addChat("bot", "I’m here. What’s going on tonight?");
  }
  chat.forEach(m=>{
    const div = document.createElement("div");
    div.className = "msg " + (m.role === "me" ? "me" : "bot");
    div.textContent = m.text;
    chatLog.appendChild(div);
  });
  chatLog.scrollTop = chatLog.scrollHeight;
}

/* Home */
function renderHome(){
  const d = new Date();
  const days = ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"];
  const months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
  todayLine.textContent = "Daily Journal • Local-only • Offline";
  todayLabel.textContent = `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;

  renderPrompt();
  renderPrayer();
  renderDevo();
  renderRecent();

  const s = getStreak();
  streakStat.textContent = `🔥 ${s.count || 0}`;
}

/* Events */
shufflePromptBtn.addEventListener("click", ()=>{ promptOffset++; renderPrompt(); });
writeBtn.addEventListener("click", ()=>{ showScreen("journal"); entryInput.focus(); });
quickBtn.addEventListener("click", ()=>{
  showScreen("journal");
  titleInput.value = "Quick Check‑In";
  entryInput.value = "Mood:\nWins:\nWhat I need help with:\nOne next step:";
  draftBadge.textContent = "Draft";
  saveHint.textContent = "";
  entryInput.focus();
});

regenPrayerBtn.addEventListener("click", ()=>{ prayerOffset++; renderPrayer(); });
copyPrayerBtn.addEventListener("click", async ()=>{
  try{ await navigator.clipboard.writeText(prayerText.textContent || ""); alert("Copied."); }
  catch{ alert("Copy failed."); }
});
savePrayerBtn.addEventListener("click", ()=>{
  const res = addEntry({ title: "Prayer of the Day", text: prayerText.textContent, source: "prayer" });
  if(res.ok){ alert("Saved."); renderHome(); }
});

regenDevoBtn.addEventListener("click", ()=>{ devoOffset++; renderDevo(); });
reflectBtn.addEventListener("click", ()=>{
  showScreen("journal");
  titleInput.value = "Devotional Reflection";
  entryInput.value = `Devotional: ${devoTitle.textContent}\n\nReflection:\n`;
  draftBadge.textContent = "Draft";
  saveHint.textContent = "";
  entryInput.focus();
});
talkBtn.addEventListener("click", ()=>{
  showScreen("companion");
  addChat("me", `Let’s talk about: ${devoTitle.textContent}`);
  addChat("bot", companionReply("devotional reflection"));
  renderChat();
});

viewAllBtn.addEventListener("click", ()=> showScreen("entries"));

saveEntryBtn.addEventListener("click", ()=>{
  const res = addEntry({ title: titleInput.value, text: entryInput.value, source: "journal" });
  if(!res.ok){ saveHint.textContent = "Nothing to save."; return; }
  saveHint.textContent = `Saved • ${niceDate(res.entry.ts)}`;
  draftBadge.textContent = "Saved";
  titleInput.value = "";
  entryInput.value = "";
  renderHome();
});

clearEntryBtn.addEventListener("click", ()=>{
  titleInput.value = "";
  entryInput.value = "";
  draftBadge.textContent = "Draft";
  saveHint.textContent = "";
});

searchInput.addEventListener("input", ()=> renderEntries());

exportBtn.addEventListener("click", ()=>{
  const payload = { version:2, exportedAt: new Date().toISOString(), entries, chat, accent: load(LS.accent,"gold") };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `my-journal-backup-${todayKey()}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

importFile.addEventListener("change", async (ev)=>{
  const f = ev.target.files?.[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const data = JSON.parse(txt);
    if(!data || !data.entries) throw new Error("Bad file");
    if(confirm("Import will replace your current local data. Continue?")){
      entries = data.entries || [];
      chat = data.chat || [];
      save(LS.entries, entries);
      save(LS.chat, chat);
      if(data.accent){ save(LS.accent, data.accent); applyAccent(data.accent); }
      renderHome();
      renderEntries();
      alert("Imported.");
    }
  }catch{
    alert("Import failed.");
  }finally{
    ev.target.value = "";
  }
});

sendChatBtn.addEventListener("click", ()=>{
  const text = (chatInput.value || "").trim();
  if(!text) return;
  addChat("me", text);
  addChat("bot", companionReply(text));
  chatInput.value = "";
  renderChat();
});
chatInput.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){ e.preventDefault(); sendChatBtn.click(); }
});
clearChatBtn.addEventListener("click", ()=>{
  if(confirm("Clear chat?")){
    chat = [];
    save(LS.chat, chat);
    renderChat();
  }
});
document.querySelectorAll("[data-quick]").forEach(btn=>{
  btn.addEventListener("click", ()=>{
    const text = btn.getAttribute("data-quick");
    chatInput.value = text;
    sendChatBtn.click();
  });
});

function applyAccent(val){
  document.documentElement.setAttribute("data-accent", val);
  accentSelect.value = val;
}
accentSelect.addEventListener("change", ()=>{
  const v = accentSelect.value;
  save(LS.accent, v);
  applyAccent(v);
});

wipeAllBtn.addEventListener("click", ()=>{
  if(!confirm("Wipe ALL data from this device?")) return;
  Object.values(LS).forEach(k => localStorage.removeItem(k));
  entries = [];
  chat = [];
  applyAccent("gold");
  renderHome();
  renderEntries();
  alert("Wiped.");
});

/* Init */
(function init(){
  // Accent
  applyAccent(load(LS.accent, "gold"));

  // Service worker
  if("serviceWorker" in navigator){
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  }

  // Initial render
  renderHome();
  renderEntries();

  // Default screen
  showScreen("home");
})();
