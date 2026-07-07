import type { DeepGlossSettings } from '@/storage/settings';
import { LANGUAGES } from '@/shared/languages';
import { SelectField } from '@/shared/ui';

interface Props {
  settings: DeepGlossSettings;
  onUpdate: <K extends keyof DeepGlossSettings>(key: K, value: DeepGlossSettings[K]) => void;
}

export function QuickSettings({ settings, onUpdate }: Props) {
  return (
    <div className="dg-stack dg-stack--tight">
      <SelectField
        id="quick-target-lang"
        label="Target Language"
        compact
        value={settings.targetLang}
        onChange={(e) => onUpdate('targetLang', (e.target as HTMLSelectElement).value)}
      >
        {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
          <option key={lang.code} value={lang.code}>{lang.nativeName} ({lang.name})</option>
        ))}
      </SelectField>

      <SelectField
        id="quick-trigger-mode"
        label="Trigger Mode"
        compact
        value={settings.triggerMode}
        onChange={(e) => onUpdate('triggerMode', (e.target as HTMLSelectElement).value as DeepGlossSettings['triggerMode'])}
      >
        <option value="icon">Click Icon</option>
        <option value="auto">Auto Translate</option>
        <option value="shortcut">Shortcut Key</option>
      </SelectField>

      <SelectField
        id="quick-provider"
        label="Provider"
        compact
        value={settings.activeProvider}
        onChange={(e) => onUpdate('activeProvider', (e.target as HTMLSelectElement).value)}
      >
        <option value="google">Google Translate</option>
        <option value="openai-compatible">OpenAI Compatible</option>
      </SelectField>
    </div>
  );
}
