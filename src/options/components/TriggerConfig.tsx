import type { DeepGlossSettings } from '@/storage/settings';
import { SelectField } from '@/shared/ui';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

export function TriggerConfig({ settings, onUpdate }: Props) {
  const description = {
    icon: 'A small icon appears near your selection. Click it to translate.',
    auto: 'Translation starts immediately when you select text.',
    shortcut: `Press ${settings.shortcutKey} after selecting text to translate.`,
  }[settings.triggerMode];

  return (
    <SelectField
      id="trigger-mode"
      label="Trigger Mode"
      value={settings.triggerMode}
      description={description}
      onChange={(e) => onUpdate('triggerMode', (e.target as HTMLSelectElement).value as DeepGlossSettings['triggerMode'])}
    >
      <option value="icon">Click floating icon</option>
      <option value="auto">Auto translate on selection</option>
      <option value="shortcut">Keyboard shortcut</option>
    </SelectField>
  );
}
