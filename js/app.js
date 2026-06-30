/* App logic: navigation, grid rendering, search, translate, voice input.
   Relies on `hiragana`, `katakana`, `kanji`, and `dictionary` from data.js. */

document.addEventListener("DOMContentLoaded", () => {
  initNavigation();
  renderGrids();
  initSearch();
  initTranslate();
  initTTS();
});

/* ---------- Navigation (tabbed SPA + hash sync) ---------- */
function initNavigation() {
  const buttons = document.querySelectorAll(".nav-btn");
  const views = document.querySelectorAll(".view");

  function show(viewId) {
    if (!document.getElementById(viewId)) return;
    buttons.forEach((b) => b.classList.toggle("active", b.dataset.view === viewId));
    views.forEach((v) => v.classList.toggle("active", v.id === viewId));
    // Reset internal scroll so each view starts at the top.
    const active = document.getElementById(viewId);
    if (active) active.scrollTop = 0;
  }

  buttons.forEach((btn) => {
    btn.addEventListener("click", () => {
      const view = btn.dataset.view;
      if (location.hash !== "#" + view) location.hash = view; // triggers hashchange
      else show(view);
    });
  });

  window.addEventListener("hashchange", () => show(location.hash.slice(1)));

  // Honour an initial hash (e.g. shared link), default to hiragana.
  const initial = location.hash.slice(1);
  show(document.getElementById(initial) ? initial : "hiragana");
}

/* ---------- Grid rendering ---------- */
function renderGrids() {
  renderKanaGrid(document.getElementById("hiragana-grid"), hiragana);
  renderKanaGrid(document.getElementById("katakana-grid"), katakana);
  renderKanjiGrid(document.getElementById("kanji-grid"), kanji);
}

function renderKanaGrid(container, items) {
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card";
    // Searchable text stored on the element for fast filtering.
    card.dataset.search = (item.kana + " " + item.romaji).toLowerCase();
    card.innerHTML =
      `<span class="char">${item.kana}</span>` +
      `<span class="romaji">${item.romaji}</span>`;
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

function renderKanjiGrid(container, items) {
  const frag = document.createDocumentFragment();
  items.forEach((item) => {
    const card = document.createElement("div");
    card.className = "card card-kanji";
    card.dataset.search =
      (item.kanji + " " + item.reading + " " + item.romaji + " " + item.meaning).toLowerCase();
    card.innerHTML =
      `<span class="char">${item.kanji}</span>` +
      `<span class="reading">${item.reading}</span>` +
      `<span class="meaning">${item.meaning}</span>`;
    frag.appendChild(card);
  });
  container.appendChild(frag);
}

/* ---------- Live search ---------- */
function initSearch() {
  document.querySelectorAll(".search").forEach((input) => {
    const grid = document.getElementById(input.dataset.target);
    const empty = grid.parentElement.querySelector(".no-results");
    input.addEventListener("input", () => {
      const q = input.value.trim().toLowerCase();
      let visible = 0;
      grid.querySelectorAll(".card").forEach((card) => {
        const match = !q || card.dataset.search.includes(q);
        card.hidden = !match;
        if (match) visible++;
      });
      if (empty) empty.hidden = visible !== 0;
    });
  });
}

/* ---------- Translate (dictionary first, API fallback) ---------- */
function initTranslate() {
  const input = document.getElementById("translate-input");
  const btn = document.getElementById("translate-btn");
  const result = document.getElementById("translate-result");
  const source = document.getElementById("translate-source");
  const speakBtn = document.getElementById("speak-btn");

  function setResult(text, sourceLabel, dim = false) {
    result.textContent = text;
    result.classList.toggle("dim", dim);
    source.textContent = sourceLabel || "";
    // Show speak button only when there's a real Japanese result.
    if (speakBtn) {
      speakBtn.hidden = dim;
      if (!dim) speakJapanese(text);
    }
  }

  async function doTranslate() {
    const raw = input.value.trim();
    if (!raw) {
      setResult("Type something to translate.", "", true);
      return;
    }

    // 1) Instant local dictionary lookup.
    const local = dictionary[raw.toLowerCase()];
    if (local) {
      setResult(local, "From built-in dictionary");
      return;
    }

    // 2) Fall back to the free MyMemory API.
    setResult("Translating…", "", true);
    btn.disabled = true;
    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(raw) + "&langpair=en%7Cja";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Network response was not ok");
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      const ok = data.responseStatus === 200 &&
                 translated &&
                 !translated.toLowerCase().includes("please, specify");
      if (ok) {
        setResult(translated, "Via MyMemory API");
      } else {
        setResult("No translation found.", "", true);
      }
    } catch (err) {
      setResult("Translation unavailable (offline or not found).", "", true);
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", doTranslate);
  // Ctrl/Cmd+Enter to translate from the textarea.
  input.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") doTranslate();
  });

  initVoiceInput(input, doTranslate);
}

/* ---------- Text-to-speech for Japanese output ---------- */
let ttsVoices = [];

function loadVoices() {
  ttsVoices = speechSynthesis.getVoices();
}

function pickJapaneseVoice() {
  const ja = ttsVoices.filter((v) => v.lang === "ja-JP" || v.lang.startsWith("ja"));
  if (!ja.length) return null;
  // Prefer a voice whose name hints at male (varies by OS/browser).
  const male = ja.find((v) => /male|otoko|男/i.test(v.name));
  return male || ja[0];
}

function speakJapanese(text) {
  if (!window.speechSynthesis || !text) return;
  speechSynthesis.cancel(); // stop any ongoing speech
  const utt = new SpeechSynthesisUtterance(text);
  utt.lang = "ja-JP";
  utt.rate = 0.9;
  utt.pitch = 0.8; // slightly lower pitch — closer to male delivery

  const voice = pickJapaneseVoice();
  if (voice) utt.voice = voice;

  const speakBtn = document.getElementById("speak-btn");
  if (speakBtn) {
    utt.onstart = () => speakBtn.classList.add("speaking");
    utt.onend = utt.onerror = () => speakBtn.classList.remove("speaking");
  }

  speechSynthesis.speak(utt);
}

function initTTS() {
  if (!window.speechSynthesis) return;

  // Voices load asynchronously; populate on the event if not immediately available.
  loadVoices();
  speechSynthesis.addEventListener("voiceschanged", loadVoices);

  const speakBtn = document.getElementById("speak-btn");
  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      const text = document.getElementById("translate-result").textContent;
      if (text && text !== "—") speakJapanese(text);
    });
  }
}

/* ---------- Voice input (Web Speech API) ---------- */
function initVoiceInput(input, onResult) {
  const micBtn = document.getElementById("mic-btn");
  const status = document.getElementById("mic-status");
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    micBtn.disabled = true;
    micBtn.title = "Voice input not supported in this browser";
    micBtn.style.opacity = "0.45";
    micBtn.style.cursor = "not-allowed";
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  let listening = false;

  micBtn.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }
    try {
      recognition.start();
    } catch (_) { /* start() can throw if called twice quickly; ignore */ }
  });

  recognition.addEventListener("start", () => {
    listening = true;
    micBtn.classList.add("listening");
    status.textContent = "Listening… speak in English";
  });

  recognition.addEventListener("result", (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = transcript;
    status.textContent = "";
    onResult(); // auto-translate the captured speech
  });

  recognition.addEventListener("error", (event) => {
    status.textContent =
      event.error === "not-allowed"
        ? "Microphone access denied."
        : "Voice input error.";
  });

  recognition.addEventListener("end", () => {
    listening = false;
    micBtn.classList.remove("listening");
    if (status.textContent === "Listening… speak in English") status.textContent = "";
  });
}
