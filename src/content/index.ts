import { SelectionDetector, type SelectionInfo } from './selection-detector';
import { TriggerIcon } from './trigger-icon';
import { CardHost } from './card/card-host';
import { sendMessage, openStreamPort } from '@/messaging/sender';
import type { DeepGlossSettings } from '@/storage/settings';
import type {
  BackgroundToContentMessage,
  TabMessage,
  TranslateStreamChunkResponse,
  TranslateErrorResponse,
} from '@/messaging/types';

/**
 * Detect if text is predominantly in the given language using Unicode ranges.
 */
function isNativeLanguage(text: string, nativeLang: string): boolean {
  const sample = text.trim().slice(0, 200);
  if (!sample) return false;

  const lang = nativeLang.toLowerCase().split('-')[0];
  let matchCount = 0;
  let totalCount = 0;

  for (const ch of sample) {
    if (/\s|\d|[.,!?;:'"()[\]{}\-—–…·\/\\@#$%^&*+=<>~`|]/.test(ch)) continue;
    totalCount++;
    switch (lang) {
      case 'zh':
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) matchCount++;
        break;
      case 'ja':
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(ch)) matchCount++;
        break;
      case 'ko':
        if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(ch)) matchCount++;
        break;
      case 'ar':
        if (/[\u0600-\u06ff]/.test(ch)) matchCount++;
        break;
      case 'hi':
        if (/[\u0900-\u097f]/.test(ch)) matchCount++;
        break;
      case 'th':
        if (/[\u0e00-\u0e7f]/.test(ch)) matchCount++;
        break;
      case 'ru': case 'uk':
        if (/[\u0400-\u04ff]/.test(ch)) matchCount++;
        break;
      default:
        if (/[a-zA-Z\u00c0-\u024f]/.test(ch)) matchCount++;
        break;
    }
  }

  if (totalCount === 0) return false;
  return matchCount / totalCount > 0.5;
}

class DeepGlossContentScript {
  private settings: DeepGlossSettings | null = null;
  private selectionDetector: SelectionDetector;
  private triggerIcon: TriggerIcon;
  private cardHost: CardHost | null = null;
  private currentPort: chrome.runtime.Port | null = null;

  constructor() {
    this.selectionDetector = new SelectionDetector();
    this.triggerIcon = new TriggerIcon();
  }

  async init(): Promise<void> {
    // Load settings
    try {
      const resp = await sendMessage({ type: 'GET_SETTINGS' });
      if (resp.type === 'SETTINGS') {
        this.settings = resp.payload;
      }
    } catch {
      // Use defaults if settings can't be loaded
      this.settings = {
        activeProvider: 'google',
        providers: {},
        sourceLang: 'auto',
        targetLang: 'zh-CN',
        secondLang: 'en',
        autoTargetLang: true,
        triggerMode: 'icon',
        shortcutKey: 'Alt+T',
        cardPosition: 'below',
        cardTheme: 'auto',
        cardMaxWidth: 400,
        cacheEnabled: true,
        cacheMaxSize: 1000,
        historyEnabled: true,
        pdfViewerEnabled: true,
      };
    }

    // Pre-create card host
    this.cardHost = new CardHost(
      this.settings!.cardMaxWidth,
      this.settings!.cardTheme,
    );

    // Wire selection events
    this.selectionDetector.onSelection((info) => {
      if (this.settings!.triggerMode === 'auto') {
        this.startTranslation(info);
      } else if (this.settings!.triggerMode === 'icon') {
        this.triggerIcon.show(info.rect, () => this.startTranslation(info));
      }
    });

    this.selectionDetector.onSelectionClear(() => {
      this.triggerIcon.hide();
    });

    // Listen for context menu messages from background
    chrome.runtime.onMessage.addListener((msg: TabMessage) => {
      if (msg.type === 'CONTEXT_MENU_TRANSLATE') {
        const sel = document.getSelection();
        if (sel && !sel.isCollapsed && sel.rangeCount > 0) {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          this.startTranslation({
            text: msg.payload.text,
            rect,
            context: '',
          });
        }
      }
    });

    // Listen for settings changes
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'sync' || !this.settings) return;
      for (const [key, { newValue }] of Object.entries(changes)) {
        (this.settings as unknown as Record<string, unknown>)[key] = newValue;
      }
      if (changes.cardTheme) {
        this.cardHost?.updateTheme(changes.cardTheme.newValue);
      }
      if (changes.cardMaxWidth) {
        this.cardHost?.updateWidth(changes.cardMaxWidth.newValue);
      }
    });
  }

  private resolveTargetLang(text: string): string {
    if (!this.settings || !this.settings.autoTargetLang || !this.settings.secondLang) {
      return this.settings?.targetLang || 'zh-CN';
    }
    if (isNativeLanguage(text, this.settings.targetLang)) {
      return this.settings.secondLang;
    }
    return this.settings.targetLang;
  }

  private async startTranslation(info: SelectionInfo): Promise<void> {
    if (!this.settings || !this.cardHost) return;

    this.triggerIcon.hide();

    // Disconnect previous stream if any
    this.currentPort?.disconnect();
    this.currentPort = null;

    const targetLang = this.resolveTargetLang(info.text);

    this.cardHost.show(
      info.rect,
      this.settings.cardPosition,
      info.text,
      this.settings.activeProvider,
    );
    this.cardHost.setLoading(true);

    // 1. Check cache first
    if (this.settings.cacheEnabled) {
      try {
        const cacheResp = await sendMessage({
          type: 'CACHE_LOOKUP',
          payload: {
            text: info.text,
            sourceLang: this.settings.sourceLang,
            targetLang,
          },
        });
        if (cacheResp.type === 'CACHE_HIT' && cacheResp.payload) {
          this.cardHost.renderResult(cacheResp.payload);
          return;
        }
      } catch {
        // Cache miss, continue to translate
      }
    }

    // 2. Stream translation
    const port = openStreamPort({
      type: 'TRANSLATE_STREAM_START',
      payload: {
        text: info.text,
        sourceLang: this.settings.sourceLang,
        targetLang,
        context: info.context || undefined,
      },
    });
    this.currentPort = port;

    port.onMessage.addListener((msg: BackgroundToContentMessage) => {
      if (msg.type === 'TRANSLATE_STREAM_CHUNK') {
        const chunk = (msg as TranslateStreamChunkResponse).payload;
        if (chunk.chunk) {
          this.cardHost!.appendStreamChunk(chunk.chunk);
        }
        if (chunk.done) {
          this.cardHost!.finalizeStream();
          this.currentPort = null;
        }
      } else if (msg.type === 'TRANSLATE_ERROR') {
        const err = (msg as TranslateErrorResponse).payload;
        this.cardHost!.showError(err.message);
        this.currentPort = null;
      }
    });

    port.onDisconnect.addListener(() => {
      this.currentPort = null;
    });
  }
}

// Skip initialization on extension pages (CRXJS dev mode may inject here)
// and PDF documents (they will be redirected to the DeepGloss PDF viewer)
const shouldSkip =
  location.protocol === 'chrome-extension:' ||
  document.contentType === 'application/pdf';

if (!shouldSkip) {
  const deepgloss = new DeepGlossContentScript();
  deepgloss.init();
}
