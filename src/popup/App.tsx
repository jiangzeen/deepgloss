import { useState, useEffect } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { QuickSettings } from './components/QuickSettings';
import { ProviderStatus } from './components/ProviderStatus';

export function App() {
  const [settings, setSettings] = useState<DeepGlossSettings | null>(null);

  useEffect(() => {
    chrome.storage.sync.get(null).then((stored) => {
      const defaults: DeepGlossSettings = {
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
      setSettings({ ...defaults, ...stored } as DeepGlossSettings);
    });
  }, []);

  if (!settings) return <div style={{ padding: '16px' }}>Loading...</div>;

  const updateSetting = async <K extends keyof DeepGlossSettings>(
    key: K,
    value: DeepGlossSettings[K],
  ) => {
    await chrome.storage.sync.set({ [key]: value });
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
  };

  return (
    <div style={{ padding: '16px', fontSize: '14px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
        <h1 style={{ fontSize: '16px', margin: 0 }}>DeepGloss</h1>
      </div>

      <ProviderStatus activeProvider={settings.activeProvider} />

      <QuickSettings settings={settings} onUpdate={updateSetting} />

      <button
        onClick={() => chrome.runtime.openOptionsPage()}
        style={{
          width: '100%',
          padding: '8px',
          marginTop: '12px',
          background: 'none',
          border: '1px solid #ddd',
          borderRadius: '6px',
          cursor: 'pointer',
          fontSize: '13px',
          color: '#555',
        }}
      >
        Open Settings
      </button>
    </div>
  );
}
