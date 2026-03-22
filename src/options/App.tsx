import { useState, useEffect } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { ProviderConfig } from './components/ProviderConfig';
import { TriggerConfig } from './components/TriggerConfig';
import { CardConfig } from './components/CardConfig';

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

export function App() {
  const [settings, setSettings] = useState<DeepGlossSettings | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    chrome.storage.sync.get(null).then((stored) => {
      setSettings({ ...DEFAULTS, ...stored } as DeepGlossSettings);
    });
  }, []);

  if (!settings) return <div style={{ padding: '24px' }}>Loading...</div>;

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
    <div style={{ maxWidth: '640px', margin: '0 auto', padding: '24px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
        <h1 style={{ margin: 0, fontSize: '24px' }}>DeepGloss Settings</h1>
        {saved && <span style={{ color: '#34a853', fontSize: '14px' }}>Saved</span>}
      </div>

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
          label="Enable PDF translation support"
          checked={settings.pdfViewerEnabled}
          onChange={(v) => updateSetting('pdfViewerEnabled', v)}
        />
        <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0', lineHeight: 1.5 }}>
          When enabled, PDF files opened in the browser will automatically use DeepGloss's built-in viewer, which supports text selection and translation — just like a regular webpage. The viewer includes document outline, zoom, and search. Turn this off to restore Chrome's default PDF viewer.
        </p>
        <p style={{ fontSize: '12px', color: '#888', margin: '4px 0 0', lineHeight: 1.5 }}>
          开启后，在浏览器中打开 PDF 文件时会自动使用 DeepGloss 内置阅读器，支持像普通网页一样选中文字进行划词翻译。内置阅读器带有文档目录、缩放、搜索等功能。关闭此选项可恢复使用 Chrome 默认的 PDF 查看器。
        </p>
      </Section>

      <Section title="Cache & History">
        <ToggleRow
          label="Enable translation cache"
          checked={settings.cacheEnabled}
          onChange={(v) => updateSetting('cacheEnabled', v)}
        />
        <ToggleRow
          label="Enable translation history"
          checked={settings.historyEnabled}
          onChange={(v) => updateSetting('historyEnabled', v)}
        />
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: preact.ComponentChildren }) {
  return (
    <div style={{ marginBottom: '24px' }}>
      <h2 style={{ fontSize: '16px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #eee' }}>
        {title}
      </h2>
      {children}
    </div>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 0', cursor: 'pointer', fontSize: '14px' }}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
      />
      {label}
    </label>
  );
}
