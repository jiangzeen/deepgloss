import type { ProviderConfig } from '@/providers/types';

export interface DeepGlossSettings {
  activeProvider: string;
  providers: Record<string, ProviderConfig>;
  sourceLang: string;
  targetLang: string;
  triggerMode: 'icon' | 'auto' | 'shortcut';
  shortcutKey: string;
  cardPosition: 'below' | 'sidebar';
  cardTheme: 'light' | 'dark' | 'auto';
  cardMaxWidth: number;
  cacheEnabled: boolean;
  cacheMaxSize: number;
  historyEnabled: boolean;
  pdfViewerEnabled: boolean;
}

const DEFAULTS: DeepGlossSettings = {
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
  pdfViewerEnabled: true,
};

export async function loadSettings(): Promise<DeepGlossSettings> {
  const stored = await chrome.storage.sync.get(null);
  return { ...DEFAULTS, ...stored } as DeepGlossSettings;
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
