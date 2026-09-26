import type { DeepReadSectionKind, ProviderConfig } from '@/providers/types';
import { DEEP_READ_SECTION_KINDS } from '@/providers/deep-read/sections';

export interface DeepGlossSettings {
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  sourceLang: string;
  targetLang: string;
  secondLang: string;
  autoTargetLang: boolean;
  triggerMode: 'icon' | 'auto' | 'shortcut';
  shortcutKey: string;
  cardPosition: 'below' | 'sidebar';
  cardTheme: 'light' | 'dark' | 'auto';
  cardMaxWidth: number;
  cacheEnabled: boolean;
  cacheMaxSize: number;
  historyEnabled: boolean;
  pdfViewerEnabled: boolean;
  // ---- AI deep read ----
  deepReadEnabled: boolean;
  deepReadCacheEnabled: boolean;
  deepReadCacheMaxSize: number;
  /** Section kinds requested from the model. Trim to save tokens/latency. */
  deepReadSections: DeepReadSectionKind[];
}

export const DEFAULT_SETTINGS: DeepGlossSettings = {
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
  deepReadEnabled: true,
  deepReadCacheEnabled: true,
  deepReadCacheMaxSize: 200,
  deepReadSections: [...DEEP_READ_SECTION_KINDS],
};

export async function loadSettings(): Promise<DeepGlossSettings> {
  const stored = await chrome.storage.sync.get(null);
  return { ...DEFAULT_SETTINGS, ...stored } as DeepGlossSettings;
}

export async function saveSettings(partial: Partial<DeepGlossSettings>): Promise<void> {
  await chrome.storage.sync.set(partial);
}

export function onSettingsChanged(
  cb: (changes: Partial<DeepGlossSettings>) => void,
): void {
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'sync') return;
    const parsed: Partial<DeepGlossSettings> = {};
    for (const [key, { newValue }] of Object.entries(changes)) {
      (parsed as Record<string, unknown>)[key] = newValue;
    }
    cb(parsed);
  });
}
