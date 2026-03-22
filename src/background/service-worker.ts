import { loadSettings } from '@/storage/settings';
import { TranslationCache } from '@/storage/cache';
import { TranslationHistory } from '@/storage/history';
import { ProviderRegistry } from '@/providers/provider-registry';
import { registerMessageHandler } from '@/messaging/handler';
import { STREAM_PORT_NAME } from '@/shared/constants';
import type { ContentToBackgroundMessage, BackgroundToContentMessage } from '@/messaging/types';

const cache = new TranslationCache();
const history = new TranslationHistory();
const registry = new ProviderRegistry();

// Initialize providers with saved config
loadSettings().then((settings) => {
  registry.configureAll(settings.providers);
});

// ---- One-shot message handler ----
registerMessageHandler(async (msg: ContentToBackgroundMessage): Promise<BackgroundToContentMessage> => {
  switch (msg.type) {
    case 'GET_SETTINGS': {
      const settings = await loadSettings();
      return { type: 'SETTINGS', payload: settings };
    }

    case 'CACHE_LOOKUP': {
      const result = await cache.get(
        msg.payload.text,
        msg.payload.sourceLang,
        msg.payload.targetLang,
      );
      return { type: 'CACHE_HIT', payload: result };
    }

    case 'TRANSLATE': {
      const settings = await loadSettings();
      const provider = registry.get(msg.payload.providerId || settings.activeProvider);
      const result = await provider.translate(msg.payload);
      // Cache and history (fire and forget)
      cache.set(msg.payload.text, msg.payload.sourceLang, msg.payload.targetLang, result);
      if (settings.historyEnabled) {
        history.add({
          sourceText: msg.payload.text,
          translatedText: result.text,
          sourceLang: msg.payload.sourceLang,
          targetLang: msg.payload.targetLang,
          providerId: msg.payload.providerId || settings.activeProvider,
          url: '',
        });
      }
      return { type: 'TRANSLATE_RESULT', payload: result };
    }

    default:
      return {
        type: 'TRANSLATE_ERROR',
        payload: { message: `Unknown message type: ${(msg as ContentToBackgroundMessage).type}`, code: 'UNKNOWN' },
      };
  }
});

// ---- Streaming via long-lived ports ----
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== STREAM_PORT_NAME) return;

  let abortController: AbortController | null = null;

  port.onMessage.addListener(async (msg: ContentToBackgroundMessage) => {
    if (msg.type !== 'TRANSLATE_STREAM_START') return;

    const settings = await loadSettings();
    const provider = registry.get(msg.payload.providerId || settings.activeProvider);

    if (provider.translateStream) {
      const { abort, done } = provider.translateStream(msg.payload, (chunk, isDone) => {
        try {
          port.postMessage({
            type: 'TRANSLATE_STREAM_CHUNK',
            payload: { chunk, done: isDone },
          });
        } catch {
          // port disconnected
        }
      });
      abortController = abort;

      try {
        const result = await done;
        cache.set(msg.payload.text, msg.payload.sourceLang, msg.payload.targetLang, result);
        if (settings.historyEnabled) {
          history.add({
            sourceText: msg.payload.text,
            translatedText: result.text,
            sourceLang: msg.payload.sourceLang,
            targetLang: msg.payload.targetLang,
            providerId: msg.payload.providerId || settings.activeProvider,
            url: '',
          });
        }
      } catch (err) {
        if ((err as Error).name !== 'AbortError') {
          try {
            port.postMessage({
              type: 'TRANSLATE_ERROR',
              payload: { message: (err as Error).message, code: 'STREAM_ERROR' },
            });
          } catch {
            // port disconnected
          }
        }
      }
    } else {
      // Fallback: non-streaming provider
      try {
        const result = await provider.translate(msg.payload);
        port.postMessage({
          type: 'TRANSLATE_STREAM_CHUNK',
          payload: { chunk: result.text, done: true },
        });
        cache.set(msg.payload.text, msg.payload.sourceLang, msg.payload.targetLang, result);
      } catch (err) {
        try {
          port.postMessage({
            type: 'TRANSLATE_ERROR',
            payload: { message: (err as Error).message, code: 'TRANSLATE_ERROR' },
          });
        } catch {
          // port disconnected
        }
      }
    }
  });

  port.onDisconnect.addListener(() => {
    abortController?.abort();
  });
});

// ---- Context menu ----
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: 'deepgloss-translate',
    title: 'Translate with DeepGloss',
    contexts: ['selection'],
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === 'deepgloss-translate' && tab?.id && info.selectionText) {
    chrome.tabs.sendMessage(tab.id, {
      type: 'CONTEXT_MENU_TRANSLATE',
      payload: { text: info.selectionText },
    });
  }
});

// ---- PDF interception ----
// Redirect PDF navigations to our bridge page (which loads sandboxed PDF.js viewer)
async function isPdfInterceptionEnabled(): Promise<boolean> {
  const result = await chrome.storage.sync.get({ pdfViewerEnabled: true });
  return result.pdfViewerEnabled;
}

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    // Only handle main frame navigations
    if (details.type !== 'main_frame') return;

    // Check Content-Type header for PDF
    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type',
    );
    const isPdf =
      contentType?.value?.toLowerCase().includes('application/pdf') ||
      details.url.match(/\.pdf(\?|#|$)/i);

    if (!isPdf) return;

    // Check if feature is enabled (async, but we need to redirect synchronously)
    // Use a cached flag that's updated on storage change
    if (!pdfInterceptionEnabled) return;

    const bridgeUrl = chrome.runtime.getURL(
      `src/pdfviewer/bridge.html?url=${encodeURIComponent(details.url)}`,
    );

    return { redirectUrl: bridgeUrl };
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders'],
);

// Cache the pdfViewerEnabled flag for synchronous access
let pdfInterceptionEnabled = true;
chrome.storage.sync.get({ pdfViewerEnabled: true }, (result) => {
  pdfInterceptionEnabled = result.pdfViewerEnabled;
});
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.pdfViewerEnabled !== undefined) {
    pdfInterceptionEnabled = changes.pdfViewerEnabled.newValue;
  }
});

console.log('[DeepGloss] Service worker loaded');
