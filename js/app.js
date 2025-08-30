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

/* ========== Helpers ========== */
const $ = (s, p = document) => p.querySelector(s);
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

/* ========== MEDIA STATICI ========== */
const mediaFiles = [
  "../media/1.jpg",
  "../media/2.jpg",
  "../media/3.jpg",
  "../media/4.jpg",
  "../media/5.jpg",
  "../media/6.jpg",
];

const IMAGE_EXT = /\.(jpe?g|png|gif|webp|avif)$/i;
const VIDEO_EXT = /\.(mp4|webm|ogg)$/i;

function fileToNiceName(path) {
  return path.split("/").pop().replace(/\.[^.]+$/, "").replace(/[-_]/g, " ");
}
function createSlideNode(file) {
  const wrap = document.createElement("div");
  wrap.className = "slide";
  wrap.setAttribute("role", "group");

  if (VIDEO_EXT.test(file)) {
    const v = document.createElement("video");
    v.src = file;
    v.preload = "metadata";
    v.playsInline = true;
    v.muted = true;
    v.controls = true;
    wrap.appendChild(v);
  } else if (IMAGE_EXT.test(file)) {
    const img = document.createElement("img");
    img.src = file;
    img.alt = fileToNiceName(file);
    img.loading = "lazy";
    wrap.appendChild(img);
  } else {
    return null;
  }
  wrap.dataset.caption = fileToNiceName(file);
  return wrap;
}
function populateStaticCarousel(track) {
  if (!track) return [];
  track.innerHTML = "";
  const slides = mediaFiles
    .filter((f) => IMAGE_EXT.test(f) || VIDEO_EXT.test(f))
    .map(createSlideNode)
    .filter(Boolean);
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

  // chiusura click fuori
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLightbox(); });
  // chiusura ESC
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

/* ========== CAROUSEL (multi-card, pagine a gruppi) ========== */
(function carousel() {
  const track   = $("#carouselTrack");
  const prev    = $("#prevBtn");
  const next    = $("#nextBtn");
  const caption = $("#caption"); // la svuotiamo (tu non vuoi testo a sx)
  const count   = $("#count");
  if (!track) return;

  // Popola PRIMA le slide
  populateStaticCarousel(track);

  let slides = $$(".slide", track);

  const getPer = () => {
    const v = getComputedStyle(track).getPropertyValue("--per").trim();
    const n = parseInt(v || "1", 10);
    return isNaN(n) || n < 1 ? 1 : n;
  };

  let page = 0;
  let per  = getPer();
  let totalPages = Math.max(1, Math.ceil(slides.length / per));

  function updateUI() {
    // niente caption a sinistra
    if (caption) caption.textContent = "";

    per = getPer();
    totalPages = Math.max(1, Math.ceil(slides.length / per));
    if (page > totalPages - 1) page = totalPages - 1;
    if (page < 0) page = 0;

    track.style.setProperty("--page", page);

    // contatore: range es. 1–3 / 6
    const start = page * per + 1;
    const end   = Math.min((page + 1) * per, slides.length);
    if (count) count.textContent = `${start}–${end} / ${slides.length}`;

    // play/pause video solo in pagina
    slides.forEach((s, idx) => {
      const v = s.querySelector("video");
      if (!v) return;
      const inPage = idx >= page * per && idx < (page + 1) * per;
      if (inPage) { v.muted = true; v.loop = true; v.play().catch(()=>{}); }
      else { v.pause(); v.currentTime = 0; }
    });
  }

  function go(n) { page = (n + totalPages) % totalPages; updateUI(); }

  prev?.addEventListener("click", () => go(page - 1));
  next?.addEventListener("click", () => go(page + 1));

  // click -> lightbox
  track.addEventListener("click", (e) => {
    const media = e.target.closest(".slide img, .slide video");
    if (!media) return;
    openLightbox(media);
  });

  // swipe a gruppi (con cleanup transform inline)
  let x0 = null, dragging = false;
  track.addEventListener("pointerdown", (e) => {
    x0 = e.clientX; dragging = true; track.setPointerCapture(e.pointerId);
  });
  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - x0;
    track.style.transform = `translateX(calc(${page * -100}% + ${dx}px))`; // anteprima
  });
  track.addEventListener("pointerup", (e) => {
    if (!dragging) return;
    const dx = e.clientX - x0;
    const th = track.clientWidth / 6;
    if (dx >  th) page = (page - 1 + totalPages) % totalPages;
    else if (dx < -th) page = (page + 1) % totalPages;

    // pulizia fondamentale
    track.style.transform = "";
    updateUI();

    dragging = false; x0 = null;
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft")  go(page - 1);
    if (e.key === "ArrowRight") go(page + 1);
  });

  // responsive
  let rAF = null;
  window.addEventListener("resize", () => {
    cancelAnimationFrame(rAF);
    rAF = requestAnimationFrame(() => {
      slides = $$(".slide", track);
      updateUI();
    });
  });

  updateUI();

  // util
  window.__goPage = go;
  window.__refreshCarousel = () => {
    slides = $$(".slide", track);
    updateUI();
  };
})();

/* ========== CALENDARIO + SLOTS ========== */
(function booking() {
  const monthLabel = $("#monthLabel");
  const daysGrid = $("#days");
  const slotList = $("#slotList");
  const summaryDate = $("#summaryDate");
  const summaryTime = $("#summaryTime");
  const prevMonth = $("#prevMonth");
  const nextMonth = $("#nextMonth");
  const form = $("#bookingForm");
  const formMsg = $("#formMsg");
  const yearSpan = $("#year");

  if (yearSpan) yearSpan.textContent = new Date().getFullYear();
  if (!monthLabel || !daysGrid || !slotList) return;

  let view = new Date();
  view.setDate(1);
  let selectedDate = null;
  let selectedTime = null;

  const defaultSlots = ["10:30 - 12:30", "14:30 - 16:30", "16:30 - 19:30"];

  function renderMonth() {
    const y = view.getFullYear();
    const m = view.getMonth();
    monthLabel.textContent = new Intl.DateTimeFormat("it-IT", {
      month: "long",
      year: "numeric",
    }).format(view);

    daysGrid.innerHTML = "";
    const first = new Date(y, m, 1);
    let start = (first.getDay() + 6) % 7; // lun=0
    const daysInMonth = new Date(y, m + 1, 0).getDate();

    // placeholder iniziali
    for (let i = 0; i < start; i++) {
      const d = document.createElement("div");
      d.className = "day";
      d.setAttribute("aria-disabled", "true");
      d.tabIndex = -1;
      daysGrid.appendChild(d);
    }

    const today = new Date(); today.setHours(0,0,0,0);

    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(y, m, d);
      const el = document.createElement("button");
      el.className = "day";
      el.textContent = d;
      const disabled = date < today || date.getDay() === 0; // domenica chiuso
      if (disabled) el.setAttribute("aria-disabled", "true");
      el.addEventListener("click", () => {
        if (disabled) return;
        selectedDate = date;
        $$(".day", daysGrid).forEach((b) => b.removeAttribute("aria-selected"));
        el.setAttribute("aria-selected", "true");
        renderSlots();
      });
      daysGrid.appendChild(el);
    }
  }

  function renderSlots() {
    slotList.innerHTML = "";
    selectedTime = null;
    defaultSlots.forEach((t) => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = t;
      b.addEventListener("click", (e) => {
        e.preventDefault();
        $$(".chip", slotList).forEach((c) => c.removeAttribute("aria-selected"));
        b.setAttribute("aria-selected", "true");
        selectedTime = t;
        updateSummary();
      });
      slotList.appendChild(b);
    });
    updateSummary();
  }

  function updateSummary() {
    summaryDate.textContent = selectedDate
      ? new Intl.DateTimeFormat("it-IT", {
          weekday: "long", day: "2-digit", month: "2-digit", year: "numeric",
        }).format(selectedDate)
      : "—";
    summaryTime.textContent = selectedTime || "—";
  }

  prevMonth?.addEventListener("click", () => { view.setMonth(view.getMonth() - 1); renderMonth(); });
  nextMonth?.addEventListener("click", () => { view.setMonth(view.getMonth() + 1); renderMonth(); });

  renderMonth();
  setTimeout(() => {
    const clickable = $$(".day", daysGrid).filter((d) => !d.hasAttribute("aria-disabled"));
    if (clickable[0]) clickable[0].click();
  }, 0);

  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    formMsg.textContent = "";
    const name = $("#name").value.trim();
    const email = $("#email").value.trim();
    if (!name || !email) { formMsg.textContent = "Metti nome ed email."; return; }
    if (!selectedDate || !selectedTime) { formMsg.textContent = "Scegli giorno e ora."; return; }
    const when = `${pad(selectedDate.getDate())}/${pad(selectedDate.getMonth()+1)}/${selectedDate.getFullYear()} ${selectedTime}`;
    formMsg.textContent = `Richiesta inviata. Ti contatto per confermare ${when}.`;
    form.reset();
    selectedTime = null;
    updateSummary();
    $$(".chip", slotList).forEach((c) => c.removeAttribute("aria-selected"));
  });
})();
