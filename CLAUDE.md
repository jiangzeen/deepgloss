# DeepGloss

AI-powered Chrome extension for text selection translation. Supports Google Translate and OpenAI-compatible LLM APIs with streaming.

## Commands

```bash
npm run dev        # Start Vite dev server with HMR (load dist/ in chrome://extensions)
npm run build      # TypeScript check + production build
npm run typecheck  # TypeScript type check only
```

To test in Chrome: chrome://extensions → Developer mode → Load unpacked → select `dist/`

## Architecture

**Hybrid framework approach — performance is the #1 priority.**

- **Content Script** (`src/content/`): Pure Vanilla JS + Shadow DOM. Zero framework overhead on every page. Handles selection detection, trigger icon, and translation card.
- **Options/Popup** (`src/popup/`, `src/options/`): Preact for component-based UI. Not injected into pages, so bundle size is less critical.
- **Service Worker** (`src/background/`): Message routing hub. Handles translation API calls, caching, and history via long-lived ports (streaming) and one-shot messages.

### Key design decisions

- Shadow DOM (`closed` mode) isolates all injected UI from host page CSS/JS
- DOM elements are pre-created at content script load, toggled via `display` for instant show/hide
- Selection rect is pre-warmed during `selectionchange` events so `mouseup` is near-zero cost
- LLM streaming uses `chrome.runtime.connect` (Port) for efficient chunk delivery, not per-message `sendMessage`
- Translation cache is checked before any API call (IndexedDB, LRU eviction)

## Project structure

```
src/
├── manifest.ts              # Chrome Extension Manifest V3 definition
├── background/              # Service worker: message routing, API orchestration
├── content/                 # Content script (Vanilla JS, NO framework)
│   ├── index.ts             # Entry: wires selection → trigger → card → translation
│   ├── selection-detector.ts
│   ├── trigger-icon.ts
│   └── card/                # Translation card (Shadow DOM)
├── popup/                   # Browser action popup (Preact)
├── options/                 # Extension settings page (Preact)
├── providers/               # Translation provider implementations
│   ├── types.ts             # TranslationProvider interface
│   ├── google-translate.ts  # Free Google Translate
│   ├── openai-compatible.ts # OpenAI-compatible API (streaming)
│   └── provider-registry.ts
├── pdfviewer/               # Sandbox PDF.js viewer + bridge page
├── storage/                 # chrome.storage (settings) + IndexedDB (cache/history)
├── messaging/               # Type-safe message passing (content ↔ background)
└── shared/                  # Constants, language list, utilities
```

## Code conventions

- TypeScript strict mode throughout
- Path alias: `@/*` maps to `src/*`
- CSS for content script components: import with `?inline` suffix (e.g., `import styles from './card.css?inline'`), then inject into Shadow DOM via `<style>` element
- Preact JSX uses `react-jsx` transform with `jsxImportSource: "preact"`
- No `preact/compat` — use Preact APIs directly

## Adding a new translation provider

1. Create `src/providers/my-provider.ts` implementing `TranslationProvider` from `src/providers/types.ts`
2. Register it in `src/providers/provider-registry.ts` constructor
3. Add UI config in `src/options/components/ProviderConfig.tsx`
4. Add host permission in `src/manifest.ts` if the provider calls an external API

## Storage

- **Settings**: `chrome.storage.sync` — syncs across devices, typed via `DeepGlossSettings` in `src/storage/settings.ts`
- **Cache**: IndexedDB `cache` store — LRU eviction, keyed by text+lang+provider hash
- **History**: IndexedDB `history` store — auto-increment, indexed by `createdAt`
- Both IndexedDB stores share a single `deepgloss` database (schema in `src/storage/idb-schema.ts`)

## PDF translation support

Chrome's built-in PDF viewer renders content inside an `<embed>` plugin element that content scripts cannot access. DeepGloss uses a sandbox + PDF.js approach (similar to Google Scholar PDF Reader):

**Architecture:**
- `chrome.webRequest.onHeadersReceived` intercepts PDF navigations and redirects to the bridge page
- **Bridge page** (`src/pdfviewer/bridge.html`): runs in extension context, has `chrome.*` API access. Embeds the sandbox viewer in an iframe and bridges translation via `postMessage`
- **Sandbox viewer** (`src/pdfviewer/index.html`): runs in isolated origin with relaxed CSP. Uses official pdf.js components (`PDFViewer`, `PDFLinkService`, `EventBus`) for rendering with full features (outline/TOC, zoom, text layer, search)
- Translation flow: sandbox detects selection → `postMessage` to bridge → bridge uses `chrome.runtime.connect` to stream translation from service worker → `postMessage` result back to sandbox
- The replacement is seamless — user sees PDF rendered with full translation support without extra clicks
- Can be toggled off in Settings (`pdfViewerEnabled`) to restore Chrome's default PDF viewer

**Why sandbox:**
1. Relaxed CSP — PDF.js font rendering needs features blocked by extension CSP
2. Security isolation — untrusted PDF content can't access `chrome.*` APIs
3. Seamless UX — URL interception at the browser level, no manual redirection needed

## Message passing

All messages between content script and service worker use discriminated unions defined in `src/messaging/types.ts`:
- One-shot: `chrome.runtime.sendMessage` / `onMessage` — for settings, cache lookup, one-shot translation
- Streaming: `chrome.runtime.connect` (port name `translate-stream`) — for LLM streaming translation
