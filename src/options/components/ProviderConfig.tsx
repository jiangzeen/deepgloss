import type { DeepGlossSettings } from '@/storage/settings';
import type { ProviderConfig as ProviderConfigType } from '@/providers/types';
import { LANGUAGES } from '@/shared/languages';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

const inputStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
};

const selectStyle = { ...inputStyle };

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: '#555',
  marginBottom: '4px',
  fontWeight: 500 as const,
};

export function ProviderConfig({ settings, onUpdate }: Props) {
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Active Provider</label>
        <select
          style={selectStyle}
          value={settings.activeProvider}
          onChange={(e) => onUpdate('activeProvider', (e.target as HTMLSelectElement).value)}
        >
          <option value="google">Google Translate (Free)</option>
          <option value="openai-compatible">OpenAI Compatible (AI)</option>
        </select>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Source Language</label>
          <select
            style={selectStyle}
            value={settings.sourceLang}
            onChange={(e) => onUpdate('sourceLang', (e.target as HTMLSelectElement).value)}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
        <div style={{ flex: 1 }}>
          <label style={labelStyle}>Target Language</label>
          <select
            style={selectStyle}
            value={settings.targetLang}
            onChange={(e) => onUpdate('targetLang', (e.target as HTMLSelectElement).value)}
          >
            {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
              <option key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </option>
            ))}
          </select>
        </div>
      </div>

      {settings.activeProvider === 'openai-compatible' && (
        <div style={{
          padding: '12px',
          background: '#f9f9f9',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}>
          <h3 style={{ margin: 0, fontSize: '14px' }}>OpenAI Compatible Settings</h3>
          <div>
            <label style={labelStyle}>API Endpoint</label>
            <input
              type="text"
              style={inputStyle}
              value={(openaiConfig.endpoint as string) || 'https://api.openai.com/v1/chat/completions'}
              placeholder="https://api.openai.com/v1/chat/completions"
              onChange={(e) => updateProviderConfig('endpoint', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div>
            <label style={labelStyle}>API Key</label>
            <input
              type="password"
              style={inputStyle}
              value={(openaiConfig.apiKey as string) || ''}
              placeholder="sk-..."
              onChange={(e) => updateProviderConfig('apiKey', (e.target as HTMLInputElement).value)}
            />
          </div>
          <div>
            <label style={labelStyle}>Model</label>
            <input
              type="text"
              style={inputStyle}
              value={(openaiConfig.model as string) || 'gpt-4o-mini'}
              placeholder="gpt-4o-mini"
              onChange={(e) => updateProviderConfig('model', (e.target as HTMLInputElement).value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
