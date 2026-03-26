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
// MV3 strategy:
// 1. declarativeNetRequest: static rules redirect .pdf URLs (instant, before page loads)
// 2. webRequest.onHeadersReceived: detect PDFs by Content-Type header, then
//    use chrome.tabs.update to redirect (for PDFs without .pdf extension)

const PDF_REDIRECT_RULE_ID = 1;

function getBridgeUrl(pdfUrl: string): string {
  return chrome.runtime.getURL(
    `src/pdfviewer/bridge.html?url=${encodeURIComponent(pdfUrl)}`,
  );
}

/** Add or remove declarativeNetRequest rules based on setting */
async function updatePdfRules(enabled: boolean): Promise<void> {
  // Remove existing rule first
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PDF_REDIRECT_RULE_ID],
  });

  // declarativeNetRequest can't URL-encode the original URL into a query param,
  // so we handle .pdf URLs the same way as Content-Type detection:
  // via webRequest + tabs.update. The DNR rule is not used for now.
  // All PDF interception goes through webRequest.onHeadersReceived below.
  void enabled;
}

// For PDFs served without .pdf extension (detected by Content-Type header)
let pdfInterceptionEnabled = true;

chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== 'main_frame' || !pdfInterceptionEnabled) return;

    // Skip if already our bridge page
    if (details.url.startsWith(chrome.runtime.getURL(''))) return;

    // Check if this is a PDF: by Content-Type header or URL extension
    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type',
    );
    const isPdf =
      contentType?.value?.toLowerCase().includes('application/pdf') ||
      /\.pdf(\?|#|$)/i.test(details.url);

    if (!isPdf) return;

    // Redirect via tabs.update (non-blocking, MV3 compatible)
    const bridgeUrl = getBridgeUrl(details.url);
    chrome.tabs.update(details.tabId, { url: bridgeUrl });
  },
  { urls: ['<all_urls>'] },
  ['responseHeaders'],
);

// Initialize PDF rules
chrome.storage.sync.get({ pdfViewerEnabled: true }, (result) => {
  pdfInterceptionEnabled = result.pdfViewerEnabled;
  updatePdfRules(result.pdfViewerEnabled);
});

// Update rules when setting changes
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.pdfViewerEnabled !== undefined) {
    pdfInterceptionEnabled = changes.pdfViewerEnabled.newValue;
    updatePdfRules(changes.pdfViewerEnabled.newValue);
  }
});

console.log('[DeepGloss] Service worker loaded');
