import * as pdfjsLib from 'pdfjs-dist';
import type {
  PDFDocumentProxy,
  PDFPageProxy,
  TextContent,
} from 'pdfjs-dist/types/src/display/api';

// Set worker source to bundled worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString();

// ---- State ----
let pdfDoc: PDFDocumentProxy | null = null;
let currentScale = 1.0;
const SCALE_STEP = 0.15;
const MIN_SCALE = 0.25;
const MAX_SCALE = 5.0;

// ---- DOM refs ----
const viewer = document.getElementById('viewer')!;
const viewerContainer = document.getElementById('viewer-container')!;
const pageInput = document.getElementById('page-input') as HTMLInputElement;
const pageCount = document.getElementById('page-count')!;
const zoomLevel = document.getElementById('zoom-level')!;
const prevBtn = document.getElementById('prev-btn') as HTMLButtonElement;
const nextBtn = document.getElementById('next-btn') as HTMLButtonElement;
const zoomInBtn = document.getElementById('zoom-in') as HTMLButtonElement;
const zoomOutBtn = document.getElementById('zoom-out') as HTMLButtonElement;
const zoomFitBtn = document.getElementById('zoom-fit') as HTMLButtonElement;

// ---- Get PDF URL from query param ----
function getPdfUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('url');
}

// ---- Render a single page ----
async function renderPage(page: PDFPageProxy, container: HTMLDivElement): Promise<void> {
  const viewport = page.getViewport({ scale: currentScale * window.devicePixelRatio });
  const displayViewport = page.getViewport({ scale: currentScale });

  // Canvas
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  canvas.style.width = `${displayViewport.width}px`;
  canvas.style.height = `${displayViewport.height}px`;

  container.style.width = `${displayViewport.width}px`;
  container.style.height = `${displayViewport.height}px`;

  // Clear container and add canvas
  container.innerHTML = '';
  container.appendChild(canvas);

  const ctx = canvas.getContext('2d')!;
  await page.render({ canvas, canvasContext: ctx, viewport }).promise;

  // Text layer for selection
  const textContent: TextContent = await page.getTextContent();
  const textLayer = document.createElement('div');
  textLayer.className = 'text-layer';
  container.appendChild(textLayer);

  for (const item of textContent.items) {
    if (!('str' in item) || !item.str) continue;

    const tx = item.transform;
    const fontSize = Math.sqrt(tx[0] * tx[0] + tx[1] * tx[1]);

    const span = document.createElement('span');
    span.textContent = item.str;
    span.style.fontSize = `${fontSize * currentScale}px`;
    span.style.fontFamily = item.fontName || 'sans-serif';
    span.style.left = `${tx[4] * currentScale}px`;
    // PDF coordinate system: origin at bottom-left, flip Y
    span.style.top = `${displayViewport.height - tx[5] * currentScale - fontSize * currentScale}px`;

    // Apply rotation/skew if present
    if (tx[0] !== fontSize || tx[1] !== 0 || tx[2] !== 0 || tx[3] !== fontSize) {
      const scaleX = tx[0] / fontSize;
      const scaleY = tx[3] / fontSize;
      span.style.transform = `scaleX(${scaleX}) scaleY(${scaleY})`;
      span.style.transformOrigin = 'left top';
    }

    // Width-based scaling for better alignment
    if (item.width && item.width > 0) {
      const renderedWidth = span.offsetWidth || fontSize * item.str.length * 0.6;
      const targetWidth = item.width * currentScale;
      if (renderedWidth > 0) {
        span.style.letterSpacing = `${(targetWidth - renderedWidth) / Math.max(item.str.length - 1, 1)}px`;
      }
    }

    textLayer.appendChild(span);
  }
}

// ---- Render all pages ----
async function renderAllPages(): Promise<void> {
  if (!pdfDoc) return;

  viewer.innerHTML = '';
  const totalPages = pdfDoc.numPages;

  for (let i = 1; i <= totalPages; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'pdf-page';
    pageDiv.dataset.pageNum = String(i);

    // Show loading placeholder
    const loading = document.createElement('div');
    loading.className = 'page-loading';
    loading.textContent = `Loading page ${i}...`;
    pageDiv.appendChild(loading);
    viewer.appendChild(pageDiv);
  }

  // Render visible pages first, then others
  for (let i = 1; i <= totalPages; i++) {
    const page = await pdfDoc.getPage(i);
    const pageDiv = viewer.querySelector(`[data-page-num="${i}"]`) as HTMLDivElement;
    await renderPage(page, pageDiv);
  }
}

// ---- Zoom ----
function setScale(scale: number): void {
  currentScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
  zoomLevel.textContent = `${Math.round(currentScale * 100)}%`;
  renderAllPages();
}

function fitWidth(): void {
  if (!pdfDoc) return;
  pdfDoc.getPage(1).then((page) => {
    const viewport = page.getViewport({ scale: 1.0 });
    const containerWidth = viewerContainer.clientWidth - 40; // padding
    const scale = containerWidth / viewport.width;
    setScale(scale);
  });
}

// ---- Page navigation ----
function scrollToPage(pageNum: number): void {
  const pageEl = viewer.querySelector(`[data-page-num="${pageNum}"]`);
  if (pageEl) {
    pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    pageInput.value = String(pageNum);
  }
}

function getCurrentPage(): number {
  const pages = viewer.querySelectorAll('.pdf-page');
  const containerTop = viewerContainer.scrollTop;

  for (const page of pages) {
    const el = page as HTMLElement;
    if (el.offsetTop + el.offsetHeight / 2 > containerTop) {
      return Number(el.dataset.pageNum) || 1;
    }
  }
  return 1;
}

// ---- Event listeners ----
prevBtn.addEventListener('click', () => {
  const current = getCurrentPage();
  if (current > 1) scrollToPage(current - 1);
});

nextBtn.addEventListener('click', () => {
  const current = getCurrentPage();
  if (pdfDoc && current < pdfDoc.numPages) scrollToPage(current + 1);
});

pageInput.addEventListener('change', () => {
  const num = Number(pageInput.value);
  if (pdfDoc && num >= 1 && num <= pdfDoc.numPages) {
    scrollToPage(num);
  }
});

zoomInBtn.addEventListener('click', () => setScale(currentScale + SCALE_STEP));
zoomOutBtn.addEventListener('click', () => setScale(currentScale - SCALE_STEP));
zoomFitBtn.addEventListener('click', fitWidth);

// Update page indicator on scroll
viewerContainer.addEventListener('scroll', () => {
  pageInput.value = String(getCurrentPage());
});

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey) {
    if (e.key === '=' || e.key === '+') {
      e.preventDefault();
      setScale(currentScale + SCALE_STEP);
    } else if (e.key === '-') {
      e.preventDefault();
      setScale(currentScale - SCALE_STEP);
    } else if (e.key === '0') {
      e.preventDefault();
      setScale(1.0);
    }
  }
});

// ---- Init ----
async function init(): Promise<void> {
  const url = getPdfUrl();
  if (!url) {
    viewer.innerHTML = '<div class="page-loading">No PDF URL provided.</div>';
    return;
  }

  document.title = `${decodeURIComponent(url.split('/').pop() || 'PDF')} - DeepGloss`;

  try {
    viewer.innerHTML = '<div class="page-loading">Loading PDF...</div>';
    const loadingTask = pdfjsLib.getDocument(url);
    pdfDoc = await loadingTask.promise;

    pageCount.textContent = String(pdfDoc.numPages);
    pageInput.max = String(pdfDoc.numPages);

    // Initial render with fit-width
    fitWidth();
  } catch (err) {
    viewer.innerHTML = `<div class="page-loading">Failed to load PDF: ${(err as Error).message}</div>`;
  }
}

init();
