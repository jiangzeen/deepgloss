# DeepGloss

AI-powered text selection translation extension for Chrome. Select text on any webpage or PDF, get instant translation with streaming LLM support.

## Features

- **Text Selection Translation** — Select any text on a webpage, click the floating icon, get translation in a popup card
- **Multiple Translation Providers**
  - Google Translate (free, no API key required)
  - OpenAI-compatible API (GPT, DeepSeek, Moonshot, etc.) with streaming output
  - Extensible provider interface — easy to add new providers
- **PDF Translation** — Seamlessly replaces Chrome's built-in PDF viewer with a full-featured PDF.js viewer that supports text selection and translation
- **Streaming Output** — LLM translations render token-by-token in real time
- **Translation Cache** — LRU cache (IndexedDB) avoids redundant API calls
- **Translation History** — Browse and search past translations
- **20 Languages Supported** — Auto-detect source language, translate to any supported target

## Installation

### From Source

```bash
git clone https://github.com/user/deepgloss.git
cd deepgloss
npm install
npm run build
```

1. Open `chrome://extensions` in Chrome
2. Enable **Developer mode** (top right)
3. Click **Load unpacked** and select the `dist/` directory

### Development

```bash
npm run dev        # Start Vite dev server with HMR
npm run build      # TypeScript check + production build
npm run typecheck  # TypeScript type check only
```

After `npm run dev`, load the `dist/` folder as an unpacked extension. Changes will hot-reload automatically.

## Usage

### Text Translation

1. Select text on any webpage
2. Click the floating translate icon that appears above the selection
3. View the translation result in the popup card
4. Click **Copy** to copy the translation to clipboard

You can also right-click selected text and choose **"Translate with DeepGloss"** from the context menu.

### PDF Translation

DeepGloss automatically intercepts PDF files opened in Chrome and renders them with a built-in PDF.js viewer. The viewer provides:

- Full text layer for selection and translation
- Document outline / table of contents
- Zoom controls and keyboard shortcuts (`Ctrl+/- ` to zoom, `Ctrl+0` to reset)
- Page navigation

This can be toggled off in Settings to restore Chrome's default PDF viewer.

### Configuring Providers

Click the extension icon → **Settings** to open the options page:

- **Google Translate** — Works out of the box, no configuration needed
- **OpenAI-compatible** — Enter your API endpoint and API key. Supports any OpenAI-compatible service (OpenAI, DeepSeek, Moonshot, etc.)

## Architecture

```
src/
├── background/       # Service worker: message routing, API orchestration
├── content/          # Content script (Vanilla JS, zero framework overhead)
│   ├── card/         # Translation card (Shadow DOM, closed mode)
│   ├── selection-detector.ts
│   └── trigger-icon.ts
├── pdfviewer/        # Sandbox PDF.js viewer + bridge page
├── providers/        # Translation provider implementations
├── popup/            # Browser action popup (Preact)
├── options/          # Extension settings page (Preact)
├── storage/          # chrome.storage + IndexedDB (cache, history)
├── messaging/        # Type-safe message passing (content ↔ background)
└── shared/           # Constants, language list, utilities
```

**Hybrid framework approach** — Content script uses pure Vanilla JS + Shadow DOM for zero overhead on every page. Options and Popup pages use Preact for component-based UI.

### Performance

| Technique | Effect |
|-----------|--------|
| Pre-created DOM | Zero DOM creation cost on user interaction |
| Selection rect pre-warming | Near-zero latency on mouseup |
| LRU cache-first lookup | Sub-millisecond response for repeated queries |
| Streaming via Port | Token-by-token rendering without per-message overhead |
| Shadow DOM (closed) | Zero CSS conflicts with host page |
| Inline CSS injection | No external requests, no FOUC |
| No framework in content script | Zero parse/execute overhead per page |

### PDF Viewer

Chrome's built-in PDF viewer renders content inside an `<embed>` element that content scripts cannot access. DeepGloss uses a **sandbox + bridge** architecture:

- `webRequest.onHeadersReceived` intercepts PDF navigations
- **Bridge page** (extension context) fetches the PDF, sends ArrayBuffer to sandbox via `postMessage`
- **Sandbox viewer** (isolated origin) renders with PDF.js official components (`PDFViewer`, `PDFLinkService`, `EventBus`)
- Translation requests flow: sandbox → bridge → service worker → provider → back

## Tech Stack

- **TypeScript** (strict mode)
- **Vite** + **CRXJS** — Chrome extension build pipeline with HMR
- **Preact** — Lightweight UI for options/popup pages
- **pdfjs-dist** — PDF rendering with text layer support
- **idb** — Promise-based IndexedDB wrapper
- **Chrome Extension Manifest V3**

## License

MIT
