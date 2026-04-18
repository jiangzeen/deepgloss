import { loadSettings } from '@/storage/settings';
import type { DeepGlossSettings } from '@/storage/settings';
import { TranslationCache } from '@/storage/cache';
import { TranslationHistory } from '@/storage/history';
import { ProviderRegistry } from '@/providers/provider-registry';
import { registerMessageHandler } from '@/messaging/handler';
import { STREAM_PORT_NAME } from '@/shared/constants';
import type { ContentToBackgroundMessage, BackgroundToContentMessage } from '@/messaging/types';

/**
 * Detect language of text using Google Translate API.
 * Returns a language code like 'en', 'zh-CN', 'ja', etc.
 */
async function detectLanguage(text: string): Promise<string | null> {
  try {
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', 'auto');
    url.searchParams.set('tl', 'en');
    url.searchParams.set('dt', 't');
    url.searchParams.set('dj', '1');
    // Only send first 100 chars for detection
    url.searchParams.set('q', text.slice(0, 100));
    const resp = await fetch(url.toString());
    if (!resp.ok) return null;
    const data = await resp.json();
    return (data.src as string) || null;
  } catch {
    return null;
  }
}

/**
 * Resolve the actual target language based on auto-detection settings.
 * If autoTargetLang is enabled:
 *   - detected == targetLang (native) → translate to secondLang
 *   - detected != targetLang → translate to targetLang (native)
 */
async function resolveTargetLang(
  text: string,
  requestTargetLang: string,
  settings: DeepGlossSettings,
): Promise<string> {
  if (!settings.autoTargetLang || !settings.secondLang) {
    return requestTargetLang;
  }

  const detected = await detectLanguage(text);
  if (!detected) return requestTargetLang;

  // Normalize for comparison: 'zh-CN' and 'zh' should match
  const normalize = (code: string) => code.toLowerCase().split('-')[0];

  if (normalize(detected) === normalize(settings.targetLang)) {
    // Input is in native language → translate to second language
    return settings.secondLang;
  } else {
    // Input is NOT in native language → translate to native language
    return settings.targetLang;
  }
}

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
      const finalTargetLang = await resolveTargetLang(msg.payload.text, msg.payload.targetLang, settings);
      const translationPayload = { ...msg.payload, targetLang: finalTargetLang };
      const result = await provider.translate(translationPayload);
      // Cache and history (fire and forget)
      cache.set(msg.payload.text, msg.payload.sourceLang, finalTargetLang, result);
      if (settings.historyEnabled) {
        history.add({
          sourceText: msg.payload.text,
          translatedText: result.text,
          sourceLang: msg.payload.sourceLang,
          targetLang: finalTargetLang,
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

// ---- Bridge page messages (internal, not typed via ContentToBackgroundMessage) ----
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg?.type === 'DISABLE_PDF_ONCE' && sender.tab?.id) {
    pdfBypassTabs.add(sender.tab.id);
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
    const finalTargetLang = await resolveTargetLang(msg.payload.text, msg.payload.targetLang, settings);
    const streamPayload = { ...msg.payload, targetLang: finalTargetLang };

    if (provider.translateStream) {
      const { abort, done } = provider.translateStream(streamPayload, (chunk, isDone) => {
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
        cache.set(msg.payload.text, msg.payload.sourceLang, finalTargetLang, result);
        if (settings.historyEnabled) {
          history.add({
            sourceText: msg.payload.text,
            translatedText: result.text,
            sourceLang: msg.payload.sourceLang,
            targetLang: finalTargetLang,
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
        const result = await provider.translate(streamPayload);
        port.postMessage({
          type: 'TRANSLATE_STREAM_CHUNK',
          payload: { chunk: result.text, done: true },
        });
        cache.set(msg.payload.text, msg.payload.sourceLang, finalTargetLang, result);
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
// Two-layer strategy:
// 1. declarativeNetRequest: redirect .pdf URLs at the network level (instant, before
//    Chrome's PDF plugin loads — prevents crash from competing navigations)
//    Uses hash fragment to pass the original URL (no encoding needed).
// 2. webRequest.onHeadersReceived: fallback for PDFs served without .pdf extension,
//    detected by Content-Type header. Uses delayed chrome.tabs.update.

const PDF_REDIRECT_RULE_ID = 1;

// Track tabs currently being redirected to prevent duplicate redirects
const redirectingTabs = new Set<number>();
// Tabs where PDF interception is temporarily disabled (for fallback link in dev mode)
const pdfBypassTabs = new Set<number>();

let pdfInterceptionEnabled = true;

function getBridgeUrl(pdfUrl: string): string {
  return chrome.runtime.getURL(
    `src/pdfviewer/bridge.html?url=${encodeURIComponent(pdfUrl)}`,
  );
}

/** Add or remove declarativeNetRequest rules for .pdf URL interception */
async function updatePdfRules(enabled: boolean): Promise<void> {
  // Always remove existing rules first
  await chrome.declarativeNetRequest.updateDynamicRules({
    removeRuleIds: [PDF_REDIRECT_RULE_ID],
  });

  if (!enabled) return;

  // Redirect .pdf URLs at the network level via DNR.
  // This fires BEFORE the response is received, so Chrome's PDF plugin never loads.
  // The original URL is passed as a hash fragment (no URL-encoding needed).
  const bridgeBase = chrome.runtime.getURL('src/pdfviewer/bridge.html');
  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [{
      id: PDF_REDIRECT_RULE_ID,
      priority: 1,
      action: {
        type: 'redirect' as chrome.declarativeNetRequest.RuleActionType,
        redirect: {
          // \\0 = the full matched URL
          regexSubstitution: `${bridgeBase}#\\0`,
        },
      },
      condition: {
        // Match http(s) URLs ending in .pdf (optionally followed by query/fragment)
        regexFilter: '^https?://.*\\.pdf(\\?[^#]*)?(#.*)?$',
        resourceTypes: ['main_frame' as chrome.declarativeNetRequest.ResourceType],
      },
    }],
  });
}

// Fallback: webRequest detects PDFs by Content-Type header (for URLs without .pdf extension)
chrome.webRequest.onHeadersReceived.addListener(
  (details) => {
    if (details.type !== 'main_frame' || !pdfInterceptionEnabled) return;

    // Skip if already our bridge/extension page
    if (details.url.startsWith(chrome.runtime.getURL(''))) return;

    // Skip if this tab is already being redirected
    if (redirectingTabs.has(details.tabId)) return;

    // Skip if this tab has a one-time bypass
    if (pdfBypassTabs.has(details.tabId)) {
      pdfBypassTabs.delete(details.tabId);
      return;
    }

    // Skip .pdf URLs — already handled by DNR rule (no need for tabs.update)
    if (/\.pdf(\?|#|$)/i.test(details.url)) return;

    // Check Content-Type header for non-.pdf URLs serving PDF content
    const contentType = details.responseHeaders?.find(
      (h) => h.name.toLowerCase() === 'content-type',
    );
    if (!contentType?.value?.toLowerCase().includes('application/pdf')) return;

    // Mark tab to prevent duplicate redirects
    redirectingTabs.add(details.tabId);

    // Use setTimeout(0) to let Chrome finish processing the current response
    // before navigating, which avoids crashing the tab.
    const bridgeUrl = getBridgeUrl(details.url);
    setTimeout(() => {
      chrome.tabs.update(details.tabId, { url: bridgeUrl }).catch(() => {
        // Tab may have been closed
      }).finally(() => {
        setTimeout(() => redirectingTabs.delete(details.tabId), 2000);
      });
    }, 0);
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
