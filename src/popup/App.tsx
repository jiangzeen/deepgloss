import { useState, useEffect, useRef } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { STREAM_PORT_NAME } from '@/shared/constants';
import { Button, StatusMessage } from '@/shared/ui';
import { TranslateInput } from './components/TranslateInput';
import { TranslateResult } from './components/TranslateResult';
import { QuickSettings } from './components/QuickSettings';
import { ProviderStatus } from './components/ProviderStatus';
import { WordbookPanel } from './components/WordbookPanel';

export function App() {
  const [settings, setSettings] = useState<DeepGlossSettings | null>(null);
  const [result, setResult] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showWordbook, setShowWordbook] = useState(false);
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

  if (!settings) {
    return (
      <main className="dg-shell dg-popup-shell">
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
    <main className="dg-shell dg-popup-shell">
      <header className="dg-topbar">
        <h1 className="dg-title dg-title--compact">DeepGloss</h1>
      </header>

      <div className="dg-segmented" role="group" aria-label="Popup view">
        <Button
          variant="ghost"
          size="compact"
          aria-pressed={!showWordbook}
          onClick={() => setShowWordbook(false)}
        >
          翻译
        </Button>
        <Button
          variant="ghost"
          size="compact"
          aria-pressed={showWordbook}
          onClick={() => setShowWordbook(true)}
        >
          词库
        </Button>
      </div>

      <div className="dg-divider">
        {showWordbook ? (
          <WordbookPanel />
        ) : (
          <>
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

            <div className="dg-divider">
              <Button
                variant="ghost"
                fullWidth
                size="compact"
                aria-expanded={showSettings}
                onClick={() => setShowSettings(!showSettings)}
              >
                {showSettings ? '收起设置' : '快捷设置'}
              </Button>

              {showSettings && (
                <div className="dg-stack">
                  <ProviderStatus activeProvider={settings.activeProvider} />
                  <QuickSettings settings={settings} onUpdate={updateSetting} />
                  <Button fullWidth onClick={() => chrome.runtime.openOptionsPage()}>
                    Open Settings
                  </Button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
