import type { DeepGlossSettings } from '@/storage/settings';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

const selectStyle = {
  width: '100%',
  padding: '8px 10px',
  border: '1px solid #ddd',
  borderRadius: '6px',
  fontSize: '14px',
  boxSizing: 'border-box' as const,
};

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  color: '#555',
  marginBottom: '4px',
  fontWeight: 500 as const,
};

export function TriggerConfig({ settings, onUpdate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Trigger Mode</label>
        <select
          style={selectStyle}
          value={settings.triggerMode}
          onChange={(e) => onUpdate('triggerMode', (e.target as HTMLSelectElement).value as DeepGlossSettings['triggerMode'])}
        >
          <option value="icon">Click floating icon</option>
          <option value="auto">Auto translate on selection</option>
          <option value="shortcut">Keyboard shortcut</option>
        </select>
        <p style={{ fontSize: '12px', color: '#999', margin: '4px 0 0' }}>
          {settings.triggerMode === 'icon' && 'A small icon appears near your selection. Click it to translate.'}
          {settings.triggerMode === 'auto' && 'Translation starts immediately when you select text.'}
          {settings.triggerMode === 'shortcut' && `Press ${settings.shortcutKey} after selecting text to translate.`}
        </p>
      </div>
    </div>
  );
}
