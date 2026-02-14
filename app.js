const LS = {
  entries: "dpj_entries_v2",
  streak: "dpj_streak_v2",
  promptSeed: "dpj_prompt_seed_v2",
  promptOffset: "dpj_prompt_offset_v2",
};

const PROMPTS = [
  { text: "Name one thing you’re thankful for — even if it’s tiny.", tags: ["gratitude", "perspective"] },
  { text: "What’s weighing on you right now? Say it plainly.", tags: ["honesty", "clarity"] },
  { text: "Where do you need guidance today?", tags: ["guidance", "wisdom"] },
  { text: "What do you need strength for today?", tags: ["strength", "endurance"] },
  { text: "Who do you need to forgive — including yourself?", tags: ["forgiveness", "healing"] },
  { text: "What fear has been driving you lately?", tags: ["fear", "courage"] },
  { text: "What would a faithful action look like today?", tags: ["faith", "action"] },
  { text: "What do you want to release and stop carrying?", tags: ["release", "peace"] },
  { text: "What’s one thing you can do to be kinder today?", tags: ["kindness", "growth"] },
  { text: "If God already understands you, what do you still want to say?", tags: ["prayer", "connection"] },
];

const $ = (id) => document.getElementById(id);

const todayLabel = $("todayLabel");
const promptText = $("promptText");
const promptTags = $("promptTags");
const streakPill = $("streakPill");
const shufflePromptBtn = $("shufflePromptBtn");

const titleInput = $("titleInput");
const entryInput = $("entryInput");
const saveBtn = $("saveBtn");
const clearBtn = $("clearBtn");
const saveHint = $("saveHint");
const autosaveStatus = $("autosaveStatus");

const entriesList = $("entriesList");
const emptyState = $("emptyState");
const searchInput = $("searchInput");

const exportBtn = $("exportBtn");
const importFile = $("importFile");
const wipeBtn = $("wipeBtn");
const toolsHint = $("toolsHint");

const installBtn = $("installBtn");
let deferredPrompt = null;

// --------- utils ----------
function pad(n){ return String(n).padStart(2,"0"); }

function todayKey(){
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function friendlyDate(ts){
  const d = new Date(ts);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function loadJSON(key, fallback){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return fallback;
    return JSON.parse(raw);
  }catch{ return fallback; }
}
function saveJSON(key, value){
  localStorage.setItem(key, JSON.stringify(value));
}

function setHint(el, msg){
  el.textContent = msg;
  if(!msg) return;
  clearTimeout(setHint._t);
  setHint._t = setTimeout(()=>{ el.textContent = ""; }, 2600);
}

// --------- prompt logic ----------
function ensureSeed(){
  let seed = loadJSON(LS.promptSeed, null);
  if(seed === null){
    seed = Math.floor(Math.random()*1e9);
    saveJSON(LS.promptSeed, seed);
  }
  return seed;
}
function computePromptIndex(){
  const seed = ensureSeed();
  const offset = loadJSON(LS.promptOffset, 0);
  const key = todayKey();
  let h = (seed + offset) >>> 0;
  for(let i=0;i<key.length;i++){
    h = ((h * 31) + key.charCodeAt(i)) >>> 0;
  }
  return h % PROMPTS.length;
}
function renderPrompt(){
  const idx = computePromptIndex();
  const p = PROMPTS[idx];
  promptText.textContent = p.text;
  promptTags.innerHTML = "";
  p.tags.forEach(t=>{
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = t;
    promptTags.appendChild(chip);
  });
}
shufflePromptBtn.addEventListener("click", ()=>{
  const cur = loadJSON(LS.promptOffset, 0);
  saveJSON(LS.promptOffset, cur + 1);
  renderPrompt();
});

// --------- streak ----------
function getStreak(){
  return loadJSON(LS.streak, { count: 0, lastDay: null });
}
function setStreak(s){ saveJSON(LS.streak, s); }

function updateStreakOnSave(){
  const s = getStreak();
  const today = todayKey();

  if(s.lastDay === today){
    return s;
  }
  if(!s.lastDay){
    s.count = 1;
    s.lastDay = today;
    setStreak(s);
    return s;
  }
  const last = new Date(s.lastDay + "T00:00:00");
  const now = new Date(today + "T00:00:00");
  const diffDays = Math.round((now - last) / (1000*60*60*24));

  if(diffDays === 1){
    s.count += 1;
  }else{
    s.count = 1;
  }
  s.lastDay = today;
  setStreak(s);
  return s;
}
function renderStreak(){
  const s = getStreak();
  streakPill.textContent = `🔥 ${s.count}`;
}

// --------- entries ----------
function getEntries(){
  return loadJSON(LS.entries, []);
}
function setEntries(e){ saveJSON(LS.entries, e); }

function makeEntryCard(entry){
  const wrap = document.createElement("div");
  wrap.className = "entry";

  const top = document.createElement("div");
  top.className = "entry__top";

  const left = document.createElement("div");
  const title = document.createElement("div");
  title.className = "entry__title";
  title.textContent = entry.title || "Untitled";

  const meta = document.createElement("div");
  meta.className = "entry__meta";
  meta.textContent = `${friendlyDate(entry.ts)} • ${entry.day}`;

  left.appendChild(title);
  left.appendChild(meta);

  const btns = document.createElement("div");
  btns.className = "entry__btns";

  const copyBtn = document.createElement("button");
  copyBtn.className = "btn mini btn--ghost";
  copyBtn.textContent = "Copy";
  copyBtn.addEventListener("click", async ()=>{
    try{
      await navigator.clipboard.writeText(entry.text);
      setHint(saveHint, "Copied.");
    }catch{
      setHint(saveHint, "Copy blocked by browser.");
    }
  });

  const delBtn = document.createElement("button");
  delBtn.className = "btn mini btn--danger";
  delBtn.textContent = "Delete";
  delBtn.addEventListener("click", ()=>{
    const entries = getEntries().filter(e=>e.id !== entry.id);
    setEntries(entries);
    renderEntries();
    setHint(saveHint, "Deleted.");
  });

  btns.appendChild(copyBtn);
  btns.appendChild(delBtn);

  top.appendChild(left);
  top.appendChild(btns);

  const text = document.createElement("div");
  text.className = "entry__text";
  text.textContent = entry.text;

  wrap.appendChild(top);
  wrap.appendChild(text);

  return wrap;
}

function renderEntries(){
  const q = (searchInput.value || "").trim().toLowerCase();
  const entries = getEntries()
    .slice()
    .sort((a,b)=>b.ts - a.ts)
    .filter(e=>{
      if(!q) return true;
      return (e.title||"").toLowerCase().includes(q) || (e.text||"").toLowerCase().includes(q);
    });

  entriesList.innerHTML = "";
  entries.forEach(e=>entriesList.appendChild(makeEntryCard(e)));

  emptyState.style.display = entries.length ? "none" : "block";
}
searchInput.addEventListener("input", renderEntries);

// save/clear
saveBtn.addEventListener("click", ()=>{
  const text = entryInput.value.trim();
  if(!text){
    setHint(saveHint, "Write something first.");
    return;
  }
  const title = titleInput.value.trim();
  const entry = {
    id: crypto.randomUUID(),
    title,
    text,
    ts: Date.now(),
    day: todayKey(),
    prompt: promptText.textContent || ""
  };
  const entries = getEntries();
  entries.push(entry);
  setEntries(entries);

  updateStreakOnSave();
  renderStreak();
  renderEntries();

  setHint(saveHint, "Saved.");
});
clearBtn.addEventListener("click", ()=>{
  titleInput.value = "";
  entryInput.value = "";
  setHint(saveHint, "Cleared.");
});

// Autosave draft (not counted as streak)
let draftTimer = null;
function saveDraft(){
  const draft = {
    title: titleInput.value || "",
    text: entryInput.value || "",
    ts: Date.now()
  };
  localStorage.setItem("dpj_draft_v2", JSON.stringify(draft));
  autosaveStatus.textContent = "Draft saved";
  clearTimeout(draftTimer);
  draftTimer = setTimeout(()=> autosaveStatus.textContent = "", 1400);
}
["input","change"].forEach(ev=>{
  titleInput.addEventListener(ev, ()=>{ clearTimeout(draftTimer); draftTimer=setTimeout(saveDraft, 600); });
  entryInput.addEventListener(ev, ()=>{ clearTimeout(draftTimer); draftTimer=setTimeout(saveDraft, 600); });
});
function loadDraft(){
  try{
    const raw = localStorage.getItem("dpj_draft_v2");
    if(!raw) return;
    const d = JSON.parse(raw);
    if(d && (d.title || d.text)){
      titleInput.value = d.title || "";
      entryInput.value = d.text || "";
    }
  }catch{}
}

// Export/Import/Wipe
exportBtn.addEventListener("click", ()=>{
  const payload = {
    version: 2,
    exportedAt: new Date().toISOString(),
    entries: getEntries(),
    streak: getStreak()
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `prayer-journal-backup-${todayKey()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toolsHint.textContent = "Exported backup.";
  setTimeout(()=> toolsHint.textContent="", 2200);
});

importFile.addEventListener("change", async ()=>{
  const f = importFile.files && importFile.files[0];
  if(!f) return;
  try{
    const txt = await f.text();
    const data = JSON.parse(txt);
    if(!data || !Array.isArray(data.entries)){
      toolsHint.textContent = "Invalid backup file.";
      return;
    }
    setEntries(data.entries);
    if(data.streak) setStreak(data.streak);
    renderEntries();
    renderStreak();
    toolsHint.textContent = "Imported backup.";
  }catch{
    toolsHint.textContent = "Couldn’t import that file.";
  }finally{
    setTimeout(()=> toolsHint.textContent="", 2400);
    importFile.value = "";
  }
});

wipeBtn.addEventListener("click", ()=>{
  const ok = confirm("Wipe all entries, streak, and drafts from this device?");
  if(!ok) return;
  localStorage.removeItem(LS.entries);
  localStorage.removeItem(LS.streak);
  localStorage.removeItem("dpj_draft_v2");
  renderEntries();
  renderStreak();
  toolsHint.textContent = "Wiped.";
  setTimeout(()=> toolsHint.textContent="", 2000);
});

// Tabs
const tabButtons = document.querySelectorAll(".tab");
const tabs = {
  write: $("tab-write"),
  library: $("tab-library"),
  tools: $("tab-tools")
};
function setTab(name){
  Object.entries(tabs).forEach(([k,el])=>{
    el.hidden = (k !== name);
  });
  tabButtons.forEach(btn=>{
    const active = btn.dataset.tab === name;
    btn.classList.toggle("is-active", active);
    btn.setAttribute("aria-selected", active ? "true" : "false");
  });
}
tabButtons.forEach(btn=>{
  btn.addEventListener("click", ()=> setTab(btn.dataset.tab));
});

// PWA install
window.addEventListener("beforeinstallprompt", (e)=>{
  e.preventDefault();
  deferredPrompt = e;
  installBtn.hidden = false;
});
installBtn.addEventListener("click", async ()=>{
  if(!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});

// Service worker
if("serviceWorker" in navigator){
  window.addEventListener("load", ()=>{
    navigator.serviceWorker.register("sw.js").catch(()=>{});
  });
}

// Init
(function init(){
  todayLabel.textContent = new Date().toLocaleDateString(undefined, { weekday:"long", month:"long", day:"numeric" });
  renderPrompt();
  renderStreak();
  loadDraft();
  renderEntries();
  setTab("write");
})();
