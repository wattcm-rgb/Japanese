# 日本語 — Japanese Learning App

A clean, modern, responsive dark-mode web app for learning Japanese. No build
step, no framework, no dependencies — just open it in a browser.

## Features

- **Hiragana** and **Katakana** — full syllabaries (base, dakuten/handakuten, and
  yōon combinations) as scrollable card grids showing each character with its
  romaji.
- **Kanji** — a curated set of ~75 everyday characters (numbers, days of the
  week, common nouns, verbs, and adjectives) with reading and English meaning.
- **Live search** on each character page — type a Japanese character, romaji, or
  English meaning to instantly filter the grid.
- **Translate** — English → Japanese. Checks a built-in offline dictionary first
  for instant results, then falls back to the free
  [MyMemory API](https://mymemory.translated.net/) for anything not covered.
- **Voice input** — click the 🎤 button to speak English (via the browser's Web
  Speech API); the transcript fills the box and auto-translates. Degrades
  gracefully where unsupported.
- **Dark theme**, responsive layout: fixed sidebar on desktop that becomes a top
  bar on mobile, with independently scrolling content.

## Usage

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

> The Translate API fallback and voice input require an internet connection and
> a supporting browser (Chrome/Edge recommended for voice). The dictionary,
> character grids, and search all work fully offline.

## File structure

```
index.html        App shell: sidebar nav + four section views
css/styles.css    Dark theme, layout, card grids, responsive rules
js/data.js        Datasets: hiragana, katakana, kanji, dictionary
js/app.js         Navigation, grid rendering, search, translate, voice input
```
