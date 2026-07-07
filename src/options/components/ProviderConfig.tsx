import { useState } from 'preact/hooks';
import type { DeepGlossSettings } from '@/storage/settings';
import { LANGUAGES } from '@/shared/languages';
import { Button, SelectField, TextInputField, ToggleRow } from '@/shared/ui';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

export function ProviderConfig({ settings, onUpdate }: Props) {
  const [showApiKey, setShowApiKey] = useState(false);
  const openaiConfig = settings.providers['openai-compatible'] || {};

  const updateProviderConfig = (key: string, value: string) => {
    const updated = {
      ...settings.providers,
      'openai-compatible': {
        ...openaiConfig,
        [key]: value,
      },
    };
    onUpdate('providers', updated);
  };

  return (
    <div className="dg-stack">
      <SelectField
        id="active-provider"
        label="Active Provider"
        value={settings.activeProvider}
        onChange={(e) => onUpdate('activeProvider', (e.target as HTMLSelectElement).value)}
      >
        <option value="google">Google Translate (Free)</option>
        <option value="openai-compatible">OpenAI Compatible (AI)</option>
      </SelectField>

      <div className="dg-grid-2">
        <SelectField
          id="source-language"
          label="Source Language"
          value={settings.sourceLang}
          onChange={(e) => onUpdate('sourceLang', (e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
          ))}
        </SelectField>

        <SelectField
          id="target-language"
          label="Target Language (Native)"
          value={settings.targetLang}
          onChange={(e) => onUpdate('targetLang', (e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
          ))}
        </SelectField>
      </div>

      <div className="dg-surface dg-surface--accent">
        <ToggleRow
          id="auto-target-lang"
          label="Auto switch target language / 自动切换目标语言"
          checked={settings.autoTargetLang}
          onChange={(v) => onUpdate('autoTargetLang', v)}
          description="When detected language equals your native language, translate to the second language; otherwise translate to native language."
        />

        {settings.autoTargetLang && (
          <SelectField
            id="second-language"
            label="Second Language / 第二语言"
            value={settings.secondLang}
            onChange={(e) => onUpdate('secondLang', (e.target as HTMLSelectElement).value)}
          >
            {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
            ))}
          </SelectField>
        )}
      </div>

      {settings.activeProvider === 'openai-compatible' && (
        <div className="dg-surface dg-stack">
          <h3 className="dg-title dg-title--compact">OpenAI Compatible Settings</h3>
          <TextInputField
            id="openai-endpoint"
            label="API Endpoint"
            type="url"
            value={(openaiConfig.endpoint as string) || 'https://api.openai.com/v1/chat/completions'}
            placeholder="https://api.openai.com/v1/chat/completions"
            onChange={(e) => updateProviderConfig('endpoint', (e.target as HTMLInputElement).value)}
          />
          <div className="dg-stack dg-stack--tight">
            <TextInputField
              id="openai-api-key"
              label="API Key"
              type={showApiKey ? 'text' : 'password'}
              value={(openaiConfig.apiKey as string) || ''}
              placeholder="sk-..."
              autoComplete="off"
              onChange={(e) => updateProviderConfig('apiKey', (e.target as HTMLInputElement).value)}
            />
            <Button size="compact" onClick={() => setShowApiKey((v) => !v)}>
              {showApiKey ? 'Hide API Key' : 'Show API Key'}
            </Button>
          </div>
          <TextInputField
            id="openai-model"
            label="Model"
            type="text"
            value={(openaiConfig.model as string) || 'gpt-4o-mini'}
            placeholder="gpt-4o-mini"
            onChange={(e) => updateProviderConfig('model', (e.target as HTMLInputElement).value)}
          />
        </div>
      )}
    </div>
  );
}
