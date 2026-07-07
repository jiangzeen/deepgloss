import { useState, useEffect } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { Section, StatusMessage, ToggleRow } from '@/shared/ui';
import { ProviderConfig } from './components/ProviderConfig';
import { TriggerConfig } from './components/TriggerConfig';
import { CardConfig } from './components/CardConfig';

const DEFAULTS: DeepGlossSettings = {
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

export function App() {
  const [settings, setSettings] = useState<DeepGlossSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(null).then((stored) => {
      setSettings({ ...DEFAULTS, ...stored } as DeepGlossSettings);
    });
  }, []);

  if (!settings) {
    return (
      <main className="dg-shell dg-options-shell">
        <StatusMessage>Loading settings...</StatusMessage>
      </main>
    );
  }

  const updateSetting = async <K extends keyof DeepGlossSettings>(
    key: K,
    value: DeepGlossSettings[K],
  ) => {
    await chrome.storage.sync.set({ [key]: value });
    setSettings((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <main className="dg-shell dg-options-shell">
      <header className="dg-topbar">
        <h1 className="dg-title">DeepGloss Settings</h1>
        {saved && <StatusMessage tone="success">Saved</StatusMessage>}
      </header>

      <Section title="Translation Provider">
        <ProviderConfig settings={settings} onUpdate={updateSetting} />
      </Section>

      <Section title="Trigger">
        <TriggerConfig settings={settings} onUpdate={updateSetting} />
      </Section>

      <Section title="Translation Card">
        <CardConfig settings={settings} onUpdate={updateSetting} />
      </Section>

      <Section title="PDF Translation">
        <ToggleRow
          id="pdf-viewer-enabled"
          label="Enable PDF translation support"
          checked={settings.pdfViewerEnabled}
          onChange={(v) => updateSetting('pdfViewerEnabled', v)}
          description="Use the built-in PDF viewer for selectable text, outline, zoom, and DeepGloss translation. Disable this to restore Chrome's default PDF viewer."
        />
      </Section>

      <Section title="Cache & History">
        <div className="dg-stack dg-stack--tight">
          <ToggleRow
            id="cache-enabled"
            label="Enable translation cache"
            checked={settings.cacheEnabled}
            onChange={(v) => updateSetting('cacheEnabled', v)}
          />
          <ToggleRow
            id="history-enabled"
            label="Enable translation history"
            checked={settings.historyEnabled}
            onChange={(v) => updateSetting('historyEnabled', v)}
          />
        </div>
      </Section>
    </main>
  );
}
