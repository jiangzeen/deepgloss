/**
 * Bridge script: runs in the extension context (non-sandboxed).
 *
 * Responsibilities:
 * 1. Fetch PDF data (extension context has host permissions, bypassing CORS)
 * 2. Send PDF data to sandboxed viewer via postMessage (ArrayBuffer transfer)
 * 3. Forward translation requests from sandbox to service worker
 * 4. Forward translation results back to sandbox
 */

import { STREAM_PORT_NAME } from '@/shared/constants';

// Support both ?url= (webRequest redirect) and #url (DNR redirect)
const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('url') || decodeURIComponent(window.location.hash.slice(1)) || '';

// Set page title
const fileName = decodeURIComponent(pdfUrl.split('/').pop()?.split('?')[0] || 'PDF');
document.title = `${fileName} - DeepGloss`;

let iframe: HTMLIFrameElement | null = null;

/**
 * In CRXJS dev mode, sandbox pages are replaced by a dev loader that
 * infinitely reloads (chrome.runtime is unavailable in sandbox context).
 * This causes rapid resource exhaustion and crashes the tab.
 * Detect dev mode and skip the sandbox iframe entirely.
 */
if (import.meta.env.DEV) {
  showDevModeFallback();
} else {
  initSandboxViewer();
}

function showDevModeFallback(): void {
  document.body.style.margin = '0';
  document.body.innerHTML = `
    <div style="font-family:system-ui;padding:40px;text-align:center;color:#666;max-width:600px;margin:80px auto">
      <h2 style="color:#333;margin-bottom:16px">PDF Viewer unavailable in dev mode</h2>
      <p style="line-height:1.6">The sandboxed PDF viewer cannot load with CRXJS HMR because sandbox pages
      have no access to <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px">chrome.runtime</code>.</p>
      <p style="margin-top:12px;line-height:1.6">Run <code style="background:#f0f0f0;padding:2px 6px;border-radius:3px">npm run build</code>
      and reload the extension to use the PDF viewer.</p>
      <p style="margin-top:24px">
        <a href="${pdfUrl}" id="fallback-link"
           style="color:#4285f4;text-decoration:none;padding:8px 20px;border:1px solid #4285f4;border-radius:4px;display:inline-block">
          Open original PDF
        </a>
      </p>
    </div>
  `;
  document.getElementById('fallback-link')?.addEventListener('click', (e) => {
    e.preventDefault();
    // Tell service worker to skip PDF interception for this tab once
    chrome.runtime.sendMessage({ type: 'DISABLE_PDF_ONCE' }).catch(() => {});
    setTimeout(() => { window.location.href = pdfUrl; }, 100);
  });
}

function initSandboxViewer(): void {
  // Create iframe pointing to sandboxed viewer
  iframe = document.createElement('iframe');
  iframe.src = chrome.runtime.getURL('src/pdfviewer/index.html');
  iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;';
  document.body.style.margin = '0';
  document.body.style.overflow = 'hidden';
  document.body.appendChild(iframe);

  // Once iframe is ready, fetch PDF and send data
  iframe.addEventListener('load', async () => {
    // Tell sandbox the original URL (for display in toolbar)
    iframe!.contentWindow?.postMessage({
      type: 'DEEPGLOSS_PDF_INFO',
      payload: { url: pdfUrl, fileName },
    }, '*');

    try {
      // Fetch PDF in extension context (has host permissions, no CORS issue)
      const resp = await fetch(pdfUrl);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

      const arrayBuffer = await resp.arrayBuffer();

      // Transfer ArrayBuffer to sandbox (zero-copy via transferable)
      iframe!.contentWindow?.postMessage({
        type: 'DEEPGLOSS_PDF_DATA',
        payload: arrayBuffer,
      }, '*', [arrayBuffer]);
    } catch (err) {
      iframe!.contentWindow?.postMessage({
        type: 'DEEPGLOSS_PDF_ERROR',
        payload: { message: (err as Error).message },
      }, '*');
    }
  });
}

// Listen for messages from sandbox
window.addEventListener('message', async (evt) => {
  const { type } = evt.data || {};

  if (type === 'DEEPGLOSS_TRANSLATE') {
    handleTranslateRequest(evt.data.payload.text);
  }
});

async function handleTranslateRequest(text: string): Promise<void> {
  if (!iframe) return;

  // Load settings
  const settings = await chrome.storage.sync.get({
    activeProvider: 'google',
    sourceLang: 'auto',
    targetLang: 'zh-CN',
    cacheEnabled: true,
  });

  // Check cache first
  if (settings.cacheEnabled) {
    try {
      const cacheResp = await chrome.runtime.sendMessage({
        type: 'CACHE_LOOKUP',
        payload: {
          text,
          sourceLang: settings.sourceLang,
          targetLang: settings.targetLang,
        },
      });
      if (cacheResp?.type === 'CACHE_HIT' && cacheResp.payload) {
        iframe.contentWindow?.postMessage({
          type: 'DEEPGLOSS_TRANSLATE_RESULT',
          payload: { chunk: cacheResp.payload.text, done: true },
        }, '*');
        return;
      }
    } catch {
      // Cache miss
    }
  }

  // Stream translation via port
  const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
  port.postMessage({
    type: 'TRANSLATE_STREAM_START',
    payload: {
      text,
      sourceLang: settings.sourceLang,
      targetLang: settings.targetLang,
    },
  });

  port.onMessage.addListener((msg) => {
    if (msg.type === 'TRANSLATE_STREAM_CHUNK') {
      iframe!.contentWindow?.postMessage({
        type: 'DEEPGLOSS_TRANSLATE_RESULT',
        payload: { chunk: msg.payload.chunk, done: msg.payload.done },
      }, '*');
      if (msg.payload.done) port.disconnect();
    } else if (msg.type === 'TRANSLATE_ERROR') {
      iframe!.contentWindow?.postMessage({
        type: 'DEEPGLOSS_TRANSLATE_RESULT',
        payload: { error: msg.payload.message },
      }, '*');
      port.disconnect();
    }
  });
}
