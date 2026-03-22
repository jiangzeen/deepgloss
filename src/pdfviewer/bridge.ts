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

const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('url') || '';

// Create iframe pointing to sandboxed viewer (without PDF url — we'll send data directly)
const iframe = document.createElement('iframe');
iframe.src = chrome.runtime.getURL('src/pdfviewer/index.html');
iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(iframe);

// Set page title
const fileName = decodeURIComponent(pdfUrl.split('/').pop()?.split('?')[0] || 'PDF');
document.title = `${fileName} - DeepGloss`;

// Once iframe is ready, fetch PDF and send data
iframe.addEventListener('load', async () => {
  // Tell sandbox the original URL (for display in toolbar)
  iframe.contentWindow?.postMessage({
    type: 'DEEPGLOSS_PDF_INFO',
    payload: { url: pdfUrl, fileName },
  }, '*');

  try {
    // Fetch PDF in extension context (has host permissions, no CORS issue)
    const resp = await fetch(pdfUrl);
    if (!resp.ok) throw new Error(`HTTP ${resp.status}: ${resp.statusText}`);

    const arrayBuffer = await resp.arrayBuffer();

    // Transfer ArrayBuffer to sandbox (zero-copy via transferable)
    iframe.contentWindow?.postMessage({
      type: 'DEEPGLOSS_PDF_DATA',
      payload: arrayBuffer,
    }, '*', [arrayBuffer]);
  } catch (err) {
    iframe.contentWindow?.postMessage({
      type: 'DEEPGLOSS_PDF_ERROR',
      payload: { message: (err as Error).message },
    }, '*');
  }
});

// Listen for messages from sandbox
window.addEventListener('message', async (evt) => {
  const { type } = evt.data || {};

  if (type === 'DEEPGLOSS_TRANSLATE') {
    handleTranslateRequest(evt.data.payload.text);
  }
});

async function handleTranslateRequest(text: string): Promise<void> {
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
      iframe.contentWindow?.postMessage({
        type: 'DEEPGLOSS_TRANSLATE_RESULT',
        payload: { chunk: msg.payload.chunk, done: msg.payload.done },
      }, '*');
      if (msg.payload.done) port.disconnect();
    } else if (msg.type === 'TRANSLATE_ERROR') {
      iframe.contentWindow?.postMessage({
        type: 'DEEPGLOSS_TRANSLATE_RESULT',
        payload: { error: msg.payload.message },
      }, '*');
      port.disconnect();
    }
  });
}
