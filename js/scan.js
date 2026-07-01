/* Scan tab: camera → Tesseract OCR (Japanese) → English translation */

const TESSERACT_BASE = "js/tesseract/";

document.addEventListener("DOMContentLoaded", initScan);

function initScan() {
  const video        = document.getElementById("scan-video");
  const canvas       = document.getElementById("scan-canvas");
  const placeholder  = document.getElementById("camera-placeholder");
  const cameraBtn    = document.getElementById("camera-btn");
  const captureBtn   = document.getElementById("capture-btn");
  const statusEl     = document.getElementById("scan-status");
  const resultsEl    = document.getElementById("scan-results");
  const japaneseEl   = document.getElementById("scan-japanese");
  const englishEl    = document.getElementById("scan-english");
  const romajiEl     = document.getElementById("scan-romaji");
  const sourceEl     = document.getElementById("scan-source");
  const speakBtn     = document.getElementById("scan-speak-btn");

  let stream = null;
  let worker = null;
  let workerReady = false;

  /* ---- Camera ---- */
  cameraBtn.addEventListener("click", () => {
    if (stream) stopCamera();
    else startCamera();
  });

  async function startCamera() {
    setStatus("Starting camera…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 1280 } },
        audio: false,
      });
      video.srcObject = stream;
      video.classList.add("active");
      placeholder.classList.add("hidden");
      cameraBtn.textContent = "Stop Camera";
      captureBtn.disabled = false;
      clearStatus();
    } catch (err) {
      stream = null;
      setStatus(
        err.name === "NotAllowedError"
          ? "Camera permission denied."
          : "Could not access camera: " + err.message,
        true
      );
    }
  }

  function stopCamera() {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = null;
    video.srcObject = null;
    video.classList.remove("active");
    placeholder.classList.remove("hidden");
    cameraBtn.textContent = "Start Camera";
    captureBtn.disabled = true;
    clearStatus();
  }

  /* ---- Tesseract worker (lazy init) ---- */
  async function getWorker() {
    if (worker && workerReady) return worker;
    setStatus("⏳ Loading OCR model (first time only, ~16 MB)…");
    worker = await Tesseract.createWorker("jpn", 1, {
      workerPath: TESSERACT_BASE + "worker.min.js",
      corePath:   TESSERACT_BASE,
      langPath:   TESSERACT_BASE,
      logger: (m) => {
        if (m.status === "loading tesseract core" || m.status === "initializing tesseract") {
          setStatus("⏳ Loading OCR engine…");
        } else if (m.status === "loading language traineddata") {
          const pct = m.progress ? Math.round(m.progress * 100) : 0;
          setStatus(`⏳ Loading Japanese language model… ${pct}%`);
        } else if (m.status === "initializing api") {
          setStatus("⏳ Initializing…");
        }
      },
    });
    await worker.setParameters({ tessedit_pageseg_mode: "6" });
    workerReady = true;
    return worker;
  }

  /* ---- Capture & OCR ---- */
  captureBtn.addEventListener("click", captureAndTranslate);

  async function captureAndTranslate() {
    if (!stream) return;
    captureBtn.disabled = true;

    // Draw current video frame to canvas.
    const vw = video.videoWidth  || 640;
    const vh = video.videoHeight || 480;
    canvas.width  = vw;
    canvas.height = vh;
    canvas.getContext("2d").drawImage(video, 0, 0, vw, vh);

    try {
      const ocr = await getWorker();
      setStatus("🔍 Reading text…");
      const { data } = await ocr.recognize(canvas);
      const japanese = data.text.trim().replace(/\s+/g, " ");

      if (!japanese) {
        setStatus("No Japanese text detected. Try moving closer or improving lighting.", true);
        captureBtn.disabled = false;
        return;
      }

      japaneseEl.textContent = japanese;
      clearStatus();

      setStatus("🌐 Translating…");
      const english = await translateToEnglish(japanese);
      englishEl.textContent = english || "Translation not found.";

      if (romajiEl && window.wanakana) {
        const r = wanakana.toRomaji(english || "");
        romajiEl.textContent = (r && r !== english) ? r : "";
      }

      sourceEl.textContent = english ? "Via MyMemory API" : "";
      resultsEl.hidden = false;

      if (speakBtn) {
        speakBtn.hidden = !english;
        if (english) speakEnglish(english);
      }

      clearStatus();
    } catch (err) {
      setStatus("Error: " + err.message, true);
    } finally {
      captureBtn.disabled = false;
    }
  }

  /* ---- Translation (Japanese → English via MyMemory) ---- */
  async function translateToEnglish(text) {
    try {
      const url =
        "https://api.mymemory.translated.net/get?q=" +
        encodeURIComponent(text) + "&langpair=ja%7Cen";
      const res  = await fetch(url);
      if (!res.ok) throw new Error("Network error");
      const data = await res.json();
      const translated = data?.responseData?.translatedText;
      const ok =
        data.responseStatus === 200 &&
        translated &&
        !translated.toLowerCase().includes("please, specify");
      return ok ? translated : null;
    } catch (_) {
      return null;
    }
  }

  /* ---- TTS (read English aloud) ---- */
  function speakEnglish(text) {
    if (!window.speechSynthesis || !text) return;
    speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "en-US";
    utt.onstart = () => speakBtn.classList.add("speaking");
    utt.onend = utt.onerror = () => speakBtn.classList.remove("speaking");
    speechSynthesis.speak(utt);
  }

  if (speakBtn) {
    speakBtn.addEventListener("click", () => {
      const text = englishEl.textContent;
      if (text) speakEnglish(text);
    });
  }

  /* ---- Helpers ---- */
  function setStatus(msg, isError = false) {
    statusEl.textContent = msg;
    statusEl.classList.toggle("error", isError);
    statusEl.hidden = false;
  }

  function clearStatus() {
    statusEl.hidden = true;
    statusEl.textContent = "";
    statusEl.classList.remove("error");
  }

  // Stop camera when navigating away from the Scan tab.
  document.querySelectorAll(".nav-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.view !== "scan" && stream) stopCamera();
    });
  });
}
