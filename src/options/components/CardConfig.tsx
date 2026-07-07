import type { DeepGlossSettings } from '@/storage/settings';
import { Field, SelectField } from '@/shared/ui';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

export function CardConfig({ settings, onUpdate }: Props) {
  return (
    <div className="dg-stack">
      <SelectField
        id="card-position"
        label="Card Position"
        value={settings.cardPosition}
        onChange={(e) => onUpdate('cardPosition', (e.target as HTMLSelectElement).value as DeepGlossSettings['cardPosition'])}
      >
        <option value="below">Below selection</option>
        <option value="sidebar">Right sidebar</option>
      </SelectField>

      <SelectField
        id="card-theme"
        label="Theme"
        value={settings.cardTheme}
        onChange={(e) => onUpdate('cardTheme', (e.target as HTMLSelectElement).value as DeepGlossSettings['cardTheme'])}
      >
        <option value="auto">Auto (follow system)</option>
        <option value="light">Light</option>
        <option value="dark">Dark</option>
      </SelectField>

      <Field id="card-max-width" label={`Card Max Width (${settings.cardMaxWidth}px)`}>
        <input
          id="card-max-width"
          type="range"
          min="280"
          max="600"
          step="20"
          value={settings.cardMaxWidth}
          onChange={(e) => onUpdate('cardMaxWidth', Number((e.target as HTMLInputElement).value))}
        />
      </Field>
    </div>
  );
}
