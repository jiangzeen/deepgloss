interface Props {
  activeProvider: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  google: 'Google Translate',
  'openai-compatible': 'OpenAI Compatible',
};

export function ProviderStatus({ activeProvider }: Props) {
  const label = PROVIDER_LABELS[activeProvider] || activeProvider;

  return (
    <div className="dg-surface dg-surface--muted" role="status" aria-live="polite">
      <div className="dg-meta-label">Active Provider</div>
      <div>{label}</div>
    </div>
  );
}
