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

export function CardConfig({ settings, onUpdate }: Props) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <label style={labelStyle}>Card Position</label>
        <select
          style={selectStyle}
          value={settings.cardPosition}
          onChange={(e) => onUpdate('cardPosition', (e.target as HTMLSelectElement).value as DeepGlossSettings['cardPosition'])}
        >
          <option value="below">Below selection</option>
          <option value="sidebar">Right sidebar</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Theme</label>
        <select
          style={selectStyle}
          value={settings.cardTheme}
          onChange={(e) => onUpdate('cardTheme', (e.target as HTMLSelectElement).value as DeepGlossSettings['cardTheme'])}
        >
          <option value="auto">Auto (follow system)</option>
          <option value="light">Light</option>
          <option value="dark">Dark</option>
        </select>
      </div>

      <div>
        <label style={labelStyle}>Card Max Width ({settings.cardMaxWidth}px)</label>
        <input
          type="range"
          min="280"
          max="600"
          step="20"
          value={settings.cardMaxWidth}
          style={{ width: '100%' }}
          onChange={(e) => onUpdate('cardMaxWidth', Number((e.target as HTMLInputElement).value))}
        />
      </div>
    </div>
  );
}
