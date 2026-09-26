import type { DeepGlossSettings } from '@/storage/settings';
import type { DeepReadSectionKind } from '@/providers/types';
import { DEEP_READ_SECTION_KINDS, DEEP_READ_SECTIONS } from '@/providers/deep-read';

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

function Checkbox({
  id,
  checked,
  label,
  onChange,
}: {
  id: string;
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <input
        type="checkbox"
        id={id}
        checked={checked}
        onChange={(e) => onChange((e.target as HTMLInputElement).checked)}
        style={{ margin: 0 }}
      />
      <label for={id} style={{ fontSize: '13px', color: '#333', cursor: 'pointer' }}>
        {label}
      </label>
    </div>
  );
}

export function CardConfig({ settings, onUpdate }: Props) {
  const toggleSection = (kind: DeepReadSectionKind, checked: boolean) => {
    const current = new Set(settings.deepReadSections);
    if (checked) current.add(kind);
    else current.delete(kind);
    const next = DEEP_READ_SECTION_KINDS.filter((k) => current.has(k));
    // Never allow an empty selection — fall back to at least one section.
    if (next.length === 0) return;
    onUpdate('deepReadSections', next);
  };

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

      {/* ---- AI deep read ---- */}
      <div style={{
        marginTop: '4px',
        padding: '12px',
        background: '#f5f7ff',
        borderRadius: '8px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
      }}>
        <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>AI Deep Read / AI 深读</div>

        <Checkbox
          id="deepReadEnabled"
          checked={settings.deepReadEnabled}
          label="Enable AI deep read tab / 启用 AI 深读标签页"
          onChange={(v) => onUpdate('deepReadEnabled', v)}
        />

        <Checkbox
          id="deepReadCacheEnabled"
          checked={settings.deepReadCacheEnabled}
          label="Cache deep-read results / 缓存深读结果"
          onChange={(v) => onUpdate('deepReadCacheEnabled', v)}
        />

        {settings.deepReadCacheEnabled && (
          <div>
            <label style={labelStyle}>Deep Read Cache Size ({settings.deepReadCacheMaxSize})</label>
            <input
              type="range"
              min="50"
              max="1000"
              step="50"
              value={settings.deepReadCacheMaxSize}
              style={{ width: '100%' }}
              onChange={(e) => onUpdate('deepReadCacheMaxSize', Number((e.target as HTMLInputElement).value))}
            />
          </div>
        )}

        <div>
          <label style={labelStyle}>Sections / 深读板块（裁剪可省 token）</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {DEEP_READ_SECTION_KINDS.map((kind) => (
              <Checkbox
                key={kind}
                id={`section-${kind}`}
                checked={settings.deepReadSections.includes(kind)}
                label={`${DEEP_READ_SECTIONS[kind].icon} ${DEEP_READ_SECTIONS[kind].label}`}
                onChange={(v) => toggleSection(kind, v)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
