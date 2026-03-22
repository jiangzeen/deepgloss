interface Props {
  activeProvider: string;
}

const PROVIDER_LABELS: Record<string, string> = {
  'google': 'Google Translate',
  'openai-compatible': 'OpenAI Compatible',
};

export function ProviderStatus({ activeProvider }: Props) {
  const label = PROVIDER_LABELS[activeProvider] || activeProvider;

  return (
    <div style={{
      padding: '8px 12px',
      background: '#f5f5f5',
      borderRadius: '6px',
      fontSize: '13px',
      marginBottom: '12px',
    }}>
      <div style={{ color: '#888', fontSize: '11px', marginBottom: '2px' }}>Active Provider</div>
      <div style={{ fontWeight: 500 }}>{label}</div>
    </div>
  );
}
