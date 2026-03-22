/**
 * Bridge script: runs in the extension context (non-sandboxed).
 * Listens for postMessage from the sandboxed PDF viewer iframe/page
 * and forwards translation requests to the service worker.
 *
 * This page wraps the sandboxed viewer in an iframe.
 */

import { STREAM_PORT_NAME } from '@/shared/constants';

const params = new URLSearchParams(window.location.search);
const pdfUrl = params.get('url') || '';

// Create iframe pointing to sandboxed viewer
const iframe = document.createElement('iframe');
iframe.src = chrome.runtime.getURL(`src/pdfviewer/index.html?url=${encodeURIComponent(pdfUrl)}`);
iframe.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;border:none;';
document.body.style.margin = '0';
document.body.style.overflow = 'hidden';
document.body.appendChild(iframe);

// Set page title
const fileName = decodeURIComponent(pdfUrl.split('/').pop()?.split('?')[0] || 'PDF');
document.title = `${fileName} - DeepGloss`;

// Listen for translation requests from sandbox
window.addEventListener('message', async (evt) => {
  if (evt.data?.type !== 'DEEPGLOSS_TRANSLATE') return;

  const { text } = evt.data.payload;

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
      if (msg.payload.done) {
        port.disconnect();
      }
    } else if (msg.type === 'TRANSLATE_ERROR') {
      iframe.contentWindow?.postMessage({
        type: 'DEEPGLOSS_TRANSLATE_RESULT',
        payload: { error: msg.payload.message },
      }, '*');
      port.disconnect();
    }
  });
});
