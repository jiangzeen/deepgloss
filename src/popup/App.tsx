import { useState, useEffect, useRef } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { STREAM_PORT_NAME } from '@/shared/constants';
import { TranslateInput } from './components/TranslateInput';
import { TranslateResult } from './components/TranslateResult';
import { QuickSettings } from './components/QuickSettings';
import { ProviderStatus } from './components/ProviderStatus';

export function App() {
  const [settings, setSettings] = useState<DeepGlossSettings | null>(null);
  const [result, setResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const portRef = useRef<chrome.runtime.Port | null>(null);

  useEffect(() => {
    chrome.storage.sync.get(null).then((stored) => {
      const defaults: DeepGlossSettings = {
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

  const handleTranslate = (text: string, sourceLang: string, targetLang: string) => {
    setResult('');
    setError(null);
    setIsTranslating(true);

    const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
    portRef.current = port;

    port.onMessage.addListener((msg) => {
      if (msg.type === 'TRANSLATE_STREAM_CHUNK') {
        setResult((prev) => prev + msg.payload.chunk);
        if (msg.payload.done) {
          setIsTranslating(false);
          portRef.current = null;
        }
      } else if (msg.type === 'TRANSLATE_ERROR') {
        setError(msg.payload.message);
        setIsTranslating(false);
        portRef.current = null;
      }
    });

    port.onDisconnect.addListener(() => {
      setIsTranslating(false);
      portRef.current = null;
    });

    port.postMessage({
      type: 'TRANSLATE_STREAM_START',
      payload: { text, sourceLang, targetLang },
    });
  };

  const handleAbort = () => {
    portRef.current?.disconnect();
    portRef.current = null;
    setIsTranslating(false);
  };

  return (
    <div style={{ padding: '12px', fontSize: '14px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <h1 style={{ fontSize: '16px', margin: 0 }}>DeepGloss</h1>
      </div>

      <TranslateInput
        sourceLang={settings.sourceLang}
        targetLang={settings.targetLang}
        secondLang={settings.secondLang}
        autoTargetLang={settings.autoTargetLang}
        onTranslate={handleTranslate}
        onAbort={handleAbort}
        isTranslating={isTranslating}
      />

      <TranslateResult
        result={result}
        isTranslating={isTranslating}
        error={error}
      />

      <div style={{ marginTop: '12px', borderTop: '1px solid #eee', paddingTop: '10px' }}>
        <button
          onClick={() => setShowSettings(!showSettings)}
          style={{
            width: '100%',
            padding: '6px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            color: '#888',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px',
          }}
        >
          {showSettings ? '收起设置' : '快捷设置'}
        </button>

        {showSettings && (
          <div style={{ marginTop: '8px' }}>
            <ProviderStatus activeProvider={settings.activeProvider} />
            <QuickSettings settings={settings} onUpdate={updateSetting} />
            <button
              onClick={() => chrome.runtime.openOptionsPage()}
              style={{
                width: '100%',
                padding: '8px',
                marginTop: '10px',
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
        )}
      </div>
    </div>
  );
}
