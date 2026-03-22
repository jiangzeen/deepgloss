import type { DeepGlossSettings } from '@/storage/settings';
import { LANGUAGES } from '@/shared/languages';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

const selectStyle = {
  width: '100%',
  padding: '6px 8px',
  border: '1px solid #ddd',
  borderRadius: '4px',
  fontSize: '13px',
  background: '#fff',
};

const labelStyle = {
  display: 'block',
  fontSize: '12px',
  color: '#888',
  marginBottom: '4px',
};

export function QuickSettings({ settings, onUpdate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div>
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

      <div>
        <label style={labelStyle}>Trigger Mode</label>
        <select
          style={selectStyle}
          value={settings.triggerMode}
          onChange={(e) => onUpdate('triggerMode', (e.target as HTMLSelectElement).value as DeepGlossSettings['triggerMode'])}
        >
          <option value="icon">Click Icon</option>
          <option value="auto">Auto Translate</option>
          <option value="shortcut">Shortcut Key</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Provider</label>
        <select
          style={selectStyle}
          value={settings.activeProvider}
          onChange={(e) => onUpdate('activeProvider', (e.target as HTMLSelectElement).value)}
        >
          <option value="google">Google Translate</option>
          <option value="openai-compatible">OpenAI Compatible</option>
        </select>
      </div>
    </div>
  );
}
