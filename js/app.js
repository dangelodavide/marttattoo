// app.js (ES module)

// ===== Config opzionale Supabase =====
let supabase, SUPABASE_BUCKET, SUPABASE_FOLDER;
try {
  const env = await import("../config/env.js");
  ({ SUPABASE_BUCKET, SUPABASE_FOLDER } = env);
  ({ supabase } = await import("./supabase.js"));
} catch (e) {
  console.info("Supabase non configurato. Portfolio statico ok.");
}

// === Portfolio via Supabase Storage ===
const SB_PORTFOLIO_BUCKET = "martart-portfolio"; // nome bucket
const SB_PORTFOLIO_PREFIX = "";                  // cartella entro il bucket ("" = root)

/* ========== Helpers ========== */
const $  = (s, p = document) => p.querySelector(s);
const $$ = (s, p = document) => [...p.querySelectorAll(s)];
const pad = (n) => String(n).padStart(2, "0");

/* ========== NAV MOBILE ========== */
(function navMobile() {
  const btn = $(".nav__burger");
  const menu = $(".mobile-menu");
  if (!btn || !menu) return;
  btn.addEventListener("click", () => {
    const open = !menu.hasAttribute("hidden");
    menu.toggleAttribute("hidden");
    btn.setAttribute("aria-expanded", String(!open));
  });
  $$(".mobile-menu a").forEach((a) =>
    a.addEventListener("click", () => {
      menu.setAttribute("hidden", "");
      btn.setAttribute("aria-expanded", "false");
    })
  );
})();

/* ========== MEDIA (Supabase Storage con fallback statico) ========== */
// le regex non vengono più usate per filtrare lo storage, restano utili per i fallback locali
const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif|heic|heif)$/i;
const VIDEO_EXT = /\.(mp4|webm|ogg|mov|m4v)$/i;

// fallback locale (rimane se storage non disponibile/vuoto)
const mediaFilesFallback = [
  "../media/1.jpg",
  "../media/2.jpg",
  "../media/3.jpg",
  "../media/4.jpg",
  "../media/5.jpg",
  "../media/6.jpg",
];

function fileToNiceName(path) {
  const clean = path.split("?")[0];
  return clean.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}

// Crea una slide: prova come immagine; se fallisce, sostituisce con <video>
function createSlideNode(fileUrl) {
  const wrap = document.createElement("div");
  wrap.className = "slide";
  wrap.setAttribute("role", "group");
  wrap.dataset.caption = fileToNiceName(fileUrl);

  const img = document.createElement("img");
  img.src = fileUrl;
  img.alt = fileToNiceName(fileUrl);
  img.loading = "lazy";

  img.addEventListener("error", () => {
    wrap.innerHTML = "";
    const v = document.createElement("video");
    v.src = fileUrl;
    v.preload = "metadata";
    v.playsInline = true;
    v.muted = true;
    v.setAttribute("muted", "");
    v.controls = true;
    wrap.appendChild(v);
  });

  wrap.appendChild(img);
  return wrap;
}

// Prende TUTTI i file dal bucket (root o prefisso) e restituisce URL pronti
async function fetchPortfolioFromSupabase() {
  if (!supabase) return [];

  const prefix = SB_PORTFOLIO_PREFIX; // "" = root
  const { data, error } = await supabase.storage
    .from(SB_PORTFOLIO_BUCKET)
    .list(prefix, { limit: 200, sortBy: { column: "name", order: "asc" } });

  if (error) {
    console.warn("[SB] storage.list error:", error.message);
    return [];
  }

  const paths = (data || [])
    .filter((item) => !item.name.startsWith(".")) // es. .DS_Store
    .map((item) => (prefix ? `${prefix}/${item.name}` : item.name));

  if (paths.length === 0) return [];

  // Prova URL firmati (funziona anche su bucket Public)
  const { data: signed, error: signErr } = await supabase.storage
    .from(SB_PORTFOLIO_BUCKET)
    .createSignedUrls(paths, 60 * 60); // 1h

  if (!signErr && signed) {
    return signed.map((s) => s.signedUrl).filter(Boolean);
  }

  // Fallback: URL pubblici (solo se bucket è Public)
  return paths
    .map((p) => supabase.storage.from(SB_PORTFOLIO_BUCKET).getPublicUrl(p).data.publicUrl)
    .filter(Boolean);
}

// Popola il carosello (Storage → fallback ai file locali)
async function populateCarousel(track) {
  if (!track) return [];
  track.innerHTML = "";

  let sources = [];
  try {
    sources = await fetchPortfolioFromSupabase();
  } catch (e) {
    console.warn("[SB] portfolio fetch failed, using fallback:", e);
  }
  if (!sources || sources.length === 0) sources = mediaFilesFallback;

  // niente filtro per estensione: lascia decidere a createSlideNode
  const slides = (sources || []).map(createSlideNode).filter(Boolean);
  slides.forEach((s) => track.appendChild(s));
  return slides;
}

/* ========== LIGHTBOX ========== */
function ensureLightbox() {
  let lb = document.getElementById("lightbox");
  if (lb) return lb;
  lb = document.createElement("div");
  lb.id = "lightbox";
  lb.className = "lightbox";
  lb.setAttribute("aria-hidden", "true");
  lb.innerHTML = `<div class="lightbox__inner" role="dialog" aria-modal="true"></div>`;
  document.body.appendChild(lb);

  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeLightbox(); });

  return lb;
}
function openLightbox(node) {
  const lb = ensureLightbox();
  const inner = lb.querySelector(".lightbox__inner");
  inner.innerHTML = "";

  const clone = node.cloneNode(true);
  if (clone.tagName.toLowerCase() === "video") {
    clone.controls = true;
    clone.muted = false;
    clone.autoplay = true;
    clone.playsInline = true;
  }
  inner.appendChild(clone);

  lb.setAttribute("aria-hidden", "false");
  document.body.classList.add("lb-open");
}
function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  const v = lb.querySelector("video");
  if (v) { v.pause(); v.currentTime = 0; }
  lb.setAttribute("aria-hidden", "true");
  document.body.classList.remove("lb-open");
}

/* ========== CAROUSEL (1 card per volta) ========== */
(async function carousel() {
  const track   = $("#carouselTrack");
  const prev    = $("#prevBtn");
  const next    = $("#nextBtn");
  const caption = $("#caption");
  const count   = $("#count");
  if (!track) return;

  // Storage (bucket) → fallback ai media locali
  let slides = await populateCarousel(track);

  const getPer = () => {
    const v = getComputedStyle(track).getPropertyValue("--per").trim();
    const n = parseInt(v || "1", 10);
    return isNaN(n) || n < 1 ? 1 : n;
  };

  let index = 0;
  let per   = getPer();
  const totalPositions = () => Math.max(1, slides.length - per + 1);
  const stepPercent = () => 100 / Math.max(1, per);

  function clamp(i){ const max = totalPositions() - 1; if(i<0) return max; if(i>max) return 0; return i; }
  function applyTransform(px=0){ const pct = -(index * stepPercent()); track.style.transform = `translateX(calc(${pct}% + ${px}px))`; }

  function updateUI(){
    if (caption) caption.textContent = "";
    per = getPer();
    index = Math.min(index, totalPositions() - 1);
    applyTransform(0);

    const start = index + 1;
    const end   = Math.min(index + per, slides.length);
    if (count) count.textContent = `${start}–${end} / ${slides.length}`;

    slides.forEach((s, idx) => {
      const v = s.querySelector("video");
      if (!v) return;
      const inView = idx >= index && idx < index + per;
      if (inView) { v.muted = true; v.autoplay = true; v.loop = true; v.play().catch(()=>{}); }
      else { v.pause(); v.currentTime = 0; }
    });
  }

  function go(to){ index = clamp(to); updateUI(); }

  prev?.addEventListener("click", () => go(index - 1));
  next?.addEventListener("click", () => go(index + 1));

  track.addEventListener("click", (e) => {
    const media = e.target.closest(".slide img, .slide video");
    if (!media) return;
    openLightbox(media);
  });

  let x0=null, dragging=false, pid=null;
  track.addEventListener("pointerdown",(e)=>{ x0=e.clientX; dragging=true; pid=e.pointerId; track.setPointerCapture(pid); });
  track.addEventListener("pointermove",(e)=>{ if(!dragging) return; applyTransform(e.clientX - x0); });
  track.addEventListener("pointerup",(e)=>{ if(!dragging) return; const dx=e.clientX-x0; const thr=track.clientWidth/6; if(dx>thr) go(index-1); else if(dx<-thr) go(index+1); else applyTransform(0); dragging=false; x0=null; pid=null; });
  track.addEventListener("pointercancel",()=>{ dragging=false; x0=null; pid=null; applyTransform(0); });

  let rAF=null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rAF);
    rAF = requestAnimationFrame(() => { slides = $$(".slide", track); updateUI(); });
  });

  updateUI();

  // debug helper
  window.__refreshCarousel = async () => { slides = await populateCarousel(track); updateUI(); };
})();

/* ========== CALENDARIO + SLOTS (Supabase + fallback, cap=5) ========== */
(function booking() {
  const slotsTitle   = $(".slots__title");
  if (slotsTitle) slotsTitle.hidden = true; // nascosto all’avvio

  const monthLabel   = $("#monthLabel");
  const daysGrid     = $("#days");
  const slotList     = $("#slotList");
  const summaryDate  = $("#summaryDate");
  const summaryTime  = $("#summaryTime");
  const prevMonth    = $("#prevMonth");
  const nextMonth    = $("#nextMonth");
  const form         = $("#bookingForm");
  const formMsg      = $("#formMsg");
  const yearSpan     = $("#year");

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  if (!monthLabel || !daysGrid || !slotList) return;

  const MAX_PER_SLOT = 5;
  const defaultSlots = ["10:30 - 12:30", "14:30 - 16:30", "16:30 - 19:30"];

  let view = new Date(); view.setDate(1);
  let selectedDate = null;
  let selectedTime = null;

  const _pad = (n) => String(n).padStart(2, "0");
  const dateKey = (d) => `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;

  // ===== Fallback locale (se Supabase non c'è) =====
  function lsGetCounts() {
    try { return JSON.parse(localStorage.getItem("mart_booking_counts") || "{}"); }
    catch { return {}; }
  }
  function lsSetCounts(obj) { localStorage.setItem("mart_booking_counts", JSON.stringify(obj)); }
  function lsCountFor(dayKey, slotStr) {
    const store = lsGetCounts();
    return store?.[dayKey]?.[slotStr] ?? 0;
  }
  function lsInc(dayKey, slotStr) {
    const store = lsGetCounts();
    store[dayKey] = store[dayKey] || {};
    store[dayKey][slotStr] = (store[dayKey][slotStr] || 0) + 1;
    lsSetCounts(store);
  }

  // ====== QUERY AIUTANTI ======
  async function fetchDayCounts(dateObj) {
    const day = dateKey(dateObj);

    if (!supabase) {
      const out = {};
      for (const s of defaultSlots) out[s] = lsCountFor(day, s);
      return out;
    }

    const { data, error } = await supabase
      .from("appointments")
      .select("slot")
      .eq("date", day);

    if (error) {
      console.warn("[SB] fetchDayCounts error, fallback:", error);
      const out = {};
      for (const s of defaultSlots) out[s] = lsCountFor(day, s);
      return out;
    }

    const counts = {};
    for (const s of defaultSlots) counts[s] = 0;
    for (const row of (data || [])) {
      if (counts[row.slot] !== undefined) counts[row.slot] += 1;
    }
    return counts;
  }

  async function fetchMonthFullDays(viewDate) {
    if (!supabase) return new Set();

    const y = viewDate.getFullYear();
    const m = viewDate.getMonth();
    const first = new Date(y, m, 1);
    const last  = new Date(y, m+1, 0);

    const { data, error } = await supabase
      .from("day_full")
      .select("day, is_full")
      .gte("day", dateKey(first))
      .lte("day", dateKey(last));

    if (error) {
      console.warn("[SB] day_full error:", error);
      return new Set();
    }
    return new Set((data || []).filter(r => r.is_full).map(r => r.day));
  }

  // ===== API astratte: contatore + insert =====
  async function countSlot(dateObj, slotStr) {
    const day = dateKey(dateObj);
    if (supabase) {
      const { count, error } = await supabase
        .from("appointments")
        .select("id", { count: "exact", head: true })
        .eq("date", day)
        .eq("slot", slotStr);
      if (error) { console.warn("[SB] count error, fallback:", error); return lsCountFor(day, slotStr); }
      return count ?? 0;
    } else {
      return lsCountFor(day, slotStr);
    }
  }

  async function createAppointment({ name, phone, style, notes, dateObj, slotStr }) {
    const day = dateKey(dateObj);

    const current = await countSlot(dateObj, slotStr);
    if (current >= MAX_PER_SLOT) return { ok:false, reason:"full" };

    if (supabase) {
      const { error } = await supabase.from("appointments").insert({
        name,
        phone,
        style: style || "surrealista",
        notes: notes || null,
        date: day,
        slot: slotStr
      }).single();

      if (error) {
        if (/Slot pieno/i.test(error.message)) return { ok:false, reason:"full", error };
        if (error.code === "23505")           return { ok:false, reason:"duplicate", error };
        console.error("[SB] insert error:", error);
        return { ok:false, reason:"error", error };
      }
      return { ok:true };
    } else {
      lsInc(day, slotStr);
      return { ok:true };
    }
  }

  // ===== UI =====
  function capitalizeFirst(str) { return str.charAt(0).toUpperCase() + str.slice(1); }

  async function renderMonth() {
    const y = view.getFullYear();
    const m = view.getMonth();
    monthLabel.textContent = capitalizeFirst(new Intl.DateTimeFormat("it-IT", {
      month:"long", year:"numeric"
    }).format(view));

    daysGrid.innerHTML = "";
    const first = new Date(y, m, 1);
    let start = (first.getDay() + 6) % 7; // lun=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    const today = new Date(); today.setHours(0,0,0,0);

    const fullDays = await fetchMonthFullDays(view);

    for (let i = 0; i < start; i++) {
      const d = document.createElement("div");
      d.className = "day";
      d.setAttribute("aria-disabled", "true");
      d.tabIndex = -1;
      daysGrid.appendChild(d);
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const key  = dateKey(date);
      const el = document.createElement("button");
      el.className = "day";
      el.textContent = d;

      const disabled =
        date < today ||            // passato
        date.getDay() === 0 ||     // domenica chiuso
        fullDays.has(key);         // tutte le fasce piene

      if (disabled) el.setAttribute("aria-disabled", "true");
      el.addEventListener("click", async () => {
        if (disabled) return;
        selectedDate = date;
        $$(".day", daysGrid).forEach((b) => b.removeAttribute("aria-selected"));
        el.setAttribute("aria-selected", "true");
        await renderSlots();
      });
      daysGrid.appendChild(el);
    }
  }

  async function renderSlots() {
    slotList.innerHTML = "";
    selectedTime = null;

    let counts = {};
    try {
      counts = await fetchDayCounts(selectedDate);
    } catch (e) {
      console.warn("renderSlots fallback:", e);
      counts = {};
      for (const s of defaultSlots) counts[s] = lsCountFor(dateKey(selectedDate), s);
    }

    let anyVisible = false;

    for (const t of defaultSlots) {
      const b = document.createElement("button");
      b.className = "chip";

      const used = counts[t] || 0;
      const remaining = Math.max(0, MAX_PER_SLOT - used);
      b.textContent = remaining > 0 ? `${t} — ${remaining} posti` : `${t} — pieno`;

      if (remaining <= 0) {
        b.setAttribute("aria-disabled", "true");
        b.title = "Orario non disponibile";
      } else {
        anyVisible = true;
      }

      b.addEventListener("click", (e) => {
        e.preventDefault();
        if (b.hasAttribute("aria-disabled")) return;
        $$(".chip", slotList).forEach((c) => c.removeAttribute("aria-selected"));
        b.setAttribute("aria-selected", "true");
        selectedTime = t;
        updateSummary();
      });

      slotList.appendChild(b);
    }

    // mostra il titolo SOLO se esiste almeno uno slot con posti
    if (slotsTitle) {
      slotsTitle.hidden = !anyVisible;
    }

    updateSummary();
  }

  function updateSummary() {
    summaryDate.textContent = selectedDate
      ? new Intl.DateTimeFormat("it-IT", {
          weekday:"long", day:"2-digit", month:"2-digit", year:"numeric",
        }).format(selectedDate)
      : "—";
    summaryTime.textContent = selectedTime || "—";
  }

  prevMonth?.addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderMonth(); });
  nextMonth?.addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderMonth(); });

  renderMonth();
  setTimeout(async () => {
    const clickable = $$(".day", daysGrid).filter((d) => !d.hasAttribute("aria-disabled"));
    if (clickable[0]) clickable[0].click();
  }, 0);

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    formMsg.textContent = "";

    const name   = $("#name").value.trim();
    const phone  = $("#phone").value.trim();
    const style  = $("#style")?.value || "surrealista";
    const notes  = $("#notes")?.value?.trim() || "";

    const phoneInput = $("#phone");
    const phoneValid = phoneInput.checkValidity();

    if (!name || !phone)      { formMsg.textContent = "Metti nome e numero di telefono."; return; }
    if (!phoneValid)          { formMsg.textContent = "Numero non valido. Controlla il formato."; return; }
    if (!selectedDate || !selectedTime) { formMsg.textContent = "Scegli giorno e ora."; return; }

    const res = await createAppointment({
      name, phone, style, notes,
      dateObj: selectedDate,
      slotStr: selectedTime
    });

    if (!res.ok) {
      if (res.reason === "full" || /Slot pieno/i.test(res.error?.message || "")) {
        formMsg.textContent = "💥 Peccato, qualcuno ti ha preceduto: orario appena esaurito.";
        await renderSlots();
        return;
      }
      if (res.reason === "duplicate") { formMsg.textContent = "Hai già inviato una richiesta per questo slot."; return; }
      formMsg.textContent = "Si è verificato un errore, riprova più tardi.";
      return;
    }

    const when = `${pad(selectedDate.getDate())}/${pad(selectedDate.getMonth()+1)}/${selectedDate.getFullYear()} ${selectedTime}`;
    formMsg.textContent = `Richiesta inviata! Ti contatto per confermare ${when}.`;
    form.reset();
    selectedTime = null;
    updateSummary();
    $$(".chip", slotList).forEach((c) => c.removeAttribute("aria-selected"));
    await renderSlots();
  });
})();

// ==== TEST CONSOLE SUPABASE (dev helpers) ====
if (supabase) {

  const _pad = (n) => String(n).padStart(2, "0");
  const todayKey = () => {
    const d = new Date();
    return `${d.getFullYear()}-${_pad(d.getMonth()+1)}-${_pad(d.getDate())}`;
  };

  async function sbPing() {
    console.log("[SB] ping…");
    const { data, error } = await supabase.from("appointments").select("id").limit(1);
    if (error && /relation.*does not exist/i.test(error.message)) {
      console.error("❌ Tabella 'appointments' mancante. Esegui lo script SQL.");
      return { ok: false, error };
    }
    if (error) { console.error("❌ Errore select:", error); return { ok:false, error }; }
    console.log("✅ ping ok (appointments accessibile).");
    return { ok:true, data };
  }

  async function sbCount(dateStr = todayKey(), slot = "14:30 - 16:30") {
    const { count, error } = await supabase
      .from("appointments")
      .select("id", { count: "exact", head: true })
      .eq("date", dateStr)
      .eq("slot", slot);
    if (error) { console.error("❌ count error:", error); return { ok:false, error }; }
    console.log(`📊 count ${dateStr} / ${slot} =`, count);
    return { ok:true, count };
  }

  async function sbInsert(name = "Test User", phone = `+39 33${Math.floor(Math.random()*1e7)}`, dateStr = todayKey(), slot = "14:30 - 16:30") {
    const { error } = await supabase
      .from("appointments")
      .insert({ name, phone, date: dateStr, slot })
      .single();
    if (error) { console.error("❌ insert error:", error.message); return { ok:false, error }; }
    console.log("✅ insert ok →", { name, phone, dateStr, slot });
    return { ok:true };
  }

  async function sbFillTo5(dateStr = todayKey(), slot = "14:30 - 16:30") {
    let { count } = await sbCount(dateStr, slot);
    while (count < 5) {
      const res = await sbInsert(`Auto${count+1}`, `+39 333 000 00${count}`, dateStr, slot);
      if (!res.ok) break;
      ({ count } = await sbCount(dateStr, slot));
    }
    const extra = await sbInsert("ShouldFail", `+39 333 999 9999`, dateStr, slot);
    if (extra.ok) console.warn("⚠️ La 6ª insert non doveva riuscire: controlla il trigger SQL.");
    else console.log("🧱 Trigger OK: 6ª prenotazione bloccata →", extra.error?.message);
  }

  async function sbListRecent(limit = 10) {
    const { data, error } = await supabase
      .from("appointments")
      .select("*")
      .order("created_at", { ascending:false })
      .limit(limit);
    if (error) { console.error("❌ list error:", error); return { ok:false, error }; }
    console.table(data);
    return { ok:true, data };
  }

  async function sbReset(dateStr = todayKey(), slot = "14:30 - 16:30") {
    const { error } = await supabase
      .from("appointments")
      .delete()
      .eq("date", dateStr)
      .eq("slot", slot);
    if (error) { console.error("❌ reset error:", error); return { ok:false, error }; }
    console.log(`🗑️ reset ok per ${dateStr} / ${slot}`);
    return { ok:true };
  }

  window.__sb = { ping: sbPing, count: sbCount, insert: sbInsert, fillTo5: sbFillTo5, list: sbListRecent, reset: sbReset };
}
