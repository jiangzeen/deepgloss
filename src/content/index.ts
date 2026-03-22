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
        triggerMode: 'icon',
        shortcutKey: 'Alt+T',
        cardPosition: 'below',
        cardTheme: 'auto',
        cardMaxWidth: 400,
        cacheEnabled: true,
        cacheMaxSize: 1000,
        historyEnabled: true,
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

  private async startTranslation(info: SelectionInfo): Promise<void> {
    if (!this.settings || !this.cardHost) return;

    this.triggerIcon.hide();

    // Disconnect previous stream if any
    this.currentPort?.disconnect();
    this.currentPort = null;

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
            targetLang: this.settings.targetLang,
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
        targetLang: this.settings.targetLang,
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

// Bootstrap
const deepgloss = new DeepGlossContentScript();
deepgloss.init();
