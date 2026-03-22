import * as pdfjsLib from 'pdfjs-dist';
import {
  EventBus,
  PDFLinkService,
  PDFViewer,
} from 'pdfjs-dist/web/pdf_viewer.mjs';
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api';

// ---- PDF.js worker setup ----
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ---- State ----
let pdfDoc: PDFDocumentProxy | null = null;

// ---- DOM refs ----
const viewerContainer = document.getElementById('viewer-container') as HTMLDivElement;
const loadingOverlay = document.getElementById('loading-overlay')!;
const loadingText = document.getElementById('loading-text')!;
const sidebarEl = document.getElementById('sidebar')!;
const outlineContainer = document.getElementById('outline-container')!;
const pageInput = document.getElementById('page-input') as HTMLInputElement;
const pageCountEl = document.getElementById('page-count')!;
const zoomSelect = document.getElementById('zoom-select') as HTMLSelectElement;

// ---- PDF.js components ----
const eventBus = new EventBus();

const linkService = new PDFLinkService({
  eventBus,
});

const pdfViewer = new PDFViewer({
  container: viewerContainer,
  eventBus,
  linkService,
  textLayerMode: 2, // Enable text layer for selection
  removePageBorders: false,
});

linkService.setViewer(pdfViewer);

// ---- PDF data received from bridge via postMessage ----
let pdfDataResolve: ((data: ArrayBuffer) => void) | null = null;
let pdfDataReject: ((err: Error) => void) | null = null;
const pdfDataPromise = new Promise<ArrayBuffer>((resolve, reject) => {
  pdfDataResolve = resolve;
  pdfDataReject = reject;
});

window.addEventListener('message', (evt) => {
  const { type } = evt.data || {};

  if (type === 'DEEPGLOSS_PDF_DATA') {
    pdfDataResolve?.(evt.data.payload as ArrayBuffer);
  } else if (type === 'DEEPGLOSS_PDF_INFO') {
    const { fileName } = evt.data.payload;
    document.title = `${fileName} - DeepGloss`;
  } else if (type === 'DEEPGLOSS_PDF_ERROR') {
    pdfDataReject?.(new Error(evt.data.payload.message));
  } else if (type === 'DEEPGLOSS_TRANSLATE_RESULT') {
    handleTranslationResponse(evt.data.payload);
  }
});

// ---- Outline / TOC ----
async function renderOutline(doc: PDFDocumentProxy): Promise<void> {
  const outline = await doc.getOutline();
  outlineContainer.innerHTML = '';

  if (!outline || outline.length === 0) {
    outlineContainer.innerHTML = '<div class="outline-empty">No outline available</div>';
    return;
  }

  function buildTree(items: typeof outline, container: HTMLElement): void {
    for (const item of items) {
      const div = document.createElement('div');
      div.className = 'outline-item';
      div.textContent = item.title;
      div.title = item.title;
      div.addEventListener('click', () => {
        if (item.dest) {
          linkService.goToDestination(item.dest);
        }
      });
      container.appendChild(div);

      if (item.items && item.items.length > 0) {
        const children = document.createElement('div');
        children.className = 'outline-children';
        buildTree(item.items, children);
        container.appendChild(children);
      }
    }
  }

  buildTree(outline, outlineContainer);
}

// ---- Zoom ----
function applyZoom(value: string): void {
  if (value === 'auto' || value === 'page-fit' || value === 'page-width') {
    pdfViewer.currentScaleValue = value;
  } else {
    pdfViewer.currentScaleValue = value;
  }
}

// ---- Toolbar events ----
document.getElementById('sidebar-toggle')!.addEventListener('click', () => {
  sidebarEl.classList.toggle('sidebar-open');
  // Trigger resize so pdf.js recalculates
  setTimeout(() => eventBus.dispatch('resize', { source: window }), 250);
});

document.getElementById('prev-page')!.addEventListener('click', () => {
  if (pdfViewer.currentPageNumber > 1) {
    pdfViewer.currentPageNumber--;
  }
});

document.getElementById('next-page')!.addEventListener('click', () => {
  if (pdfDoc && pdfViewer.currentPageNumber < pdfDoc.numPages) {
    pdfViewer.currentPageNumber++;
  }
});

pageInput.addEventListener('change', () => {
  const num = Number(pageInput.value);
  if (pdfDoc && num >= 1 && num <= pdfDoc.numPages) {
    pdfViewer.currentPageNumber = num;
  }
});

zoomSelect.addEventListener('change', () => {
  applyZoom(zoomSelect.value);
});

document.getElementById('zoom-in')!.addEventListener('click', () => {
  const newScale = Math.min(5, (pdfViewer.currentScale || 1) + 0.15);
  pdfViewer.currentScale = newScale;
  updateZoomSelect();
});

document.getElementById('zoom-out')!.addEventListener('click', () => {
  const newScale = Math.max(0.25, (pdfViewer.currentScale || 1) - 0.15);
  pdfViewer.currentScale = newScale;
  updateZoomSelect();
});

function updateZoomSelect(): void {
  const scale = pdfViewer.currentScale;
  const pct = Math.round(scale * 100);
  // Check if matches a preset
  const match = Array.from(zoomSelect.options).find(
    (o) => !isNaN(Number(o.value)) && Math.round(Number(o.value) * 100) === pct,
  );
  if (match) {
    zoomSelect.value = match.value;
  } else {
    // Add temporary option
    const opt = document.createElement('option');
    opt.value = String(scale);
    opt.textContent = `${pct}%`;
    opt.selected = true;
    // Remove previous temporary options
    Array.from(zoomSelect.options)
      .filter((o) => !['auto', 'page-fit', 'page-width', '0.5', '0.75', '1', '1.25', '1.5', '2'].includes(o.value))
      .forEach((o) => o.remove());
    zoomSelect.appendChild(opt);
  }
}

// ---- Keyboard shortcuts ----
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      document.getElementById('zoom-in')!.click();
    } else if (e.key === '-') {
      e.preventDefault();
      document.getElementById('zoom-out')!.click();
    } else if (e.key === '0') {
      e.preventDefault();
      zoomSelect.value = '1';
      applyZoom('1');
    }
  }
});

// ---- PDF.js events ----
eventBus.on('pagechanging', (evt: { pageNumber: number }) => {
  pageInput.value = String(evt.pageNumber);
});

eventBus.on('scalechanging', () => {
  updateZoomSelect();
});

// ---- Translation integration via postMessage ----
// Sandbox pages can't use chrome.* APIs, so we communicate via postMessage
// with a bridge script in the parent/extension context.

const TRANSLATE_ICON_SVG = `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12.87 15.07l-2.54-2.51.03-.03A17.52 17.52 0 0014.07 6H17V4h-7V2H8v2H1v2h11.17C11.5 7.92 10.44 9.75 9 11.35 8.07 10.32 7.3 9.19 6.69 8h-2c.73 1.63 1.73 3.17 2.98 4.56l-5.09 5.02L4 19l5-5 3.11 3.11.76-2.04zM18.5 10h-2L12 22h2l1.12-3h4.75L21 22h2l-4.5-12zm-2.62 7l1.62-4.33L19.12 17h-3.24z"/></svg>`;

// Translation UI elements (directly in page, not shadow DOM — we're in sandbox)
let triggerEl: HTMLDivElement | null = null;
let cardEl: HTMLDivElement | null = null;
let currentSelectionText = '';

function createTranslationUI(): void {
  // Trigger icon
  triggerEl = document.createElement('div');
  triggerEl.className = 'dg-trigger';
  triggerEl.innerHTML = TRANSLATE_ICON_SVG;
  triggerEl.addEventListener('click', (e) => {
    e.stopPropagation();
    e.preventDefault();
    triggerEl!.classList.remove('visible');
    requestTranslation(currentSelectionText);
  });
  triggerEl.addEventListener('mousedown', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });
  document.body.appendChild(triggerEl);

  // Card container
  cardEl = document.createElement('div');
  cardEl.style.cssText = 'position:fixed;z-index:10001;display:none;';
  document.body.appendChild(cardEl);

  // Selection listener
  let debounceTimer = 0;
  document.addEventListener('mouseup', () => {
    clearTimeout(debounceTimer);
    debounceTimer = window.setTimeout(() => {
      const sel = document.getSelection();
      if (!sel || sel.isCollapsed || !sel.toString().trim()) {
        triggerEl!.classList.remove('visible');
        return;
      }
      currentSelectionText = sel.toString().trim();
      const range = sel.getRangeAt(0);
      const rect = range.getBoundingClientRect();

      // Position trigger icon
      let left = rect.left + rect.width / 2 - 14;
      let top = rect.top - 36;
      left = Math.max(4, Math.min(left, window.innerWidth - 32));
      if (top < 4) top = rect.bottom + 8;
      triggerEl!.style.left = `${left}px`;
      triggerEl!.style.top = `${top}px`;
      triggerEl!.classList.add('visible');
    }, 50);
  });

  document.addEventListener('mousedown', (e) => {
    if (triggerEl?.contains(e.target as Node)) return;
    if (cardEl?.contains(e.target as Node)) return;
    triggerEl?.classList.remove('visible');
    hideCard();
  });
}

function requestTranslation(text: string): void {
  if (!text) return;

  const sel = document.getSelection();
  const rect = sel?.rangeCount ? sel.getRangeAt(0).getBoundingClientRect() : null;
  showCard(text, rect);

  // Send to parent via postMessage
  window.parent.postMessage({
    type: 'DEEPGLOSS_TRANSLATE',
    payload: { text },
  }, '*');
}

function showCard(sourceText: string, rect: DOMRect | null): void {
  if (!cardEl) return;

  const maxWidth = 400;
  let left = rect ? rect.left : 100;
  let top = rect ? rect.bottom + 8 : 100;
  left = Math.max(8, Math.min(left, window.innerWidth - maxWidth - 8));
  if (top + 200 > window.innerHeight) {
    top = Math.max(8, (rect?.top ?? 100) - 200);
  }

  cardEl.style.left = `${left}px`;
  cardEl.style.top = `${top}px`;
  cardEl.style.width = `${maxWidth}px`;
  cardEl.style.display = 'block';

  cardEl.innerHTML = `
    <div class="dg-card">
      <div class="dg-header">
        <span class="dg-header-title">DeepGloss</span>
        <button class="dg-close" id="dg-close-btn">&times;</button>
      </div>
      <div class="dg-source">${escapeHtml(sourceText.length > 200 ? sourceText.slice(0, 200) + '...' : sourceText)}</div>
      <div class="dg-body">
        <div class="dg-loading" style="display:flex"><div class="dg-spinner"></div></div>
        <div class="dg-stream" id="dg-stream"></div>
        <div class="dg-error" id="dg-error"></div>
      </div>
      <div class="dg-footer">
        <span id="dg-provider"></span>
        <button class="dg-copy-btn" id="dg-copy-btn">Copy</button>
      </div>
    </div>
  `;

  document.getElementById('dg-close-btn')!.addEventListener('click', hideCard);
  document.getElementById('dg-copy-btn')!.addEventListener('click', () => {
    const text = document.getElementById('dg-stream')?.textContent || '';
    if (text) {
      navigator.clipboard.writeText(text);
      document.getElementById('dg-copy-btn')!.textContent = 'Copied!';
      setTimeout(() => {
        const btn = document.getElementById('dg-copy-btn');
        if (btn) btn.textContent = 'Copy';
      }, 1500);
    }
  });
}

function hideCard(): void {
  if (cardEl) cardEl.style.display = 'none';
}

function handleTranslationResponse(data: { chunk?: string; done?: boolean; error?: string }): void {
  if (!cardEl) return;
  const loading = cardEl.querySelector('.dg-loading') as HTMLElement;
  const stream = document.getElementById('dg-stream');
  const error = document.getElementById('dg-error');

  if (data.error) {
    if (loading) loading.style.display = 'none';
    if (error) {
      error.style.display = 'block';
      error.textContent = data.error;
    }
    return;
  }

  if (data.chunk) {
    if (loading) loading.style.display = 'none';
    if (stream) {
      stream.style.display = 'block';
      stream.textContent += data.chunk;
    }
  }
}

// Translation results are handled in the unified message listener above

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ---- Init ----
async function init(): Promise<void> {
  try {
    loadingText.textContent = 'Waiting for PDF data...';

    // Wait for PDF ArrayBuffer from bridge (extension context fetches to bypass CORS)
    const arrayBuffer = await pdfDataPromise;

    loadingText.textContent = 'Loading PDF...';
    const loadingTask = pdfjsLib.getDocument({
      data: arrayBuffer,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4/cmaps/',
      cMapPacked: true,
    });

    pdfDoc = await loadingTask.promise;
    pageCountEl.textContent = String(pdfDoc.numPages);
    pageInput.max = String(pdfDoc.numPages);

    // Set document for viewer
    pdfViewer.setDocument(pdfDoc);
    linkService.setDocument(pdfDoc);

    // Render outline
    await renderOutline(pdfDoc);

    // Initial zoom
    eventBus.on('pagesinit', () => {
      applyZoom('page-width');
      loadingOverlay.classList.add('hidden');
    });

    // Create translation UI
    createTranslationUI();

  } catch (err) {
    loadingText.textContent = `Failed to load PDF: ${(err as Error).message}`;
  }
}

// Handle window resize
window.addEventListener('resize', () => {
  eventBus.dispatch('resize', { source: window });
});

init();
