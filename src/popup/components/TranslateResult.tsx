import { useState } from 'preact/hooks';

interface Props {
  result: string;
  isTranslating: boolean;
  error: string | null;
}

export function TranslateResult({ result, isTranslating, error }: Props) {
  const [copied, setCopied] = useState(false);

  if (!result && !isTranslating && !error) return null;

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div style={{ marginTop: '8px' }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '4px',
      }}>
        <span style={{ fontSize: '12px', color: '#888' }}>
          翻译结果{isTranslating ? '（翻译中...）' : ''}
        </span>
        {result && (
          <button
            onClick={handleCopy}
            style={{
              background: 'none',
              border: '1px solid #ddd',
              borderRadius: '4px',
              padding: '2px 8px',
              fontSize: '11px',
              cursor: 'pointer',
              color: copied ? '#27ae60' : '#666',
            }}
          >
            {copied ? '已复制' : '复制'}
          </button>
        )}
      </div>

      {error ? (
        <div style={{
          padding: '8px',
          background: '#fef2f2',
          border: '1px solid #fecaca',
          borderRadius: '6px',
          fontSize: '13px',
          color: '#dc2626',
        }}>
          {error}
        </div>
      ) : (
        <div style={{
          padding: '8px',
          background: '#f8f9fa',
          border: '1px solid #e9ecef',
          borderRadius: '6px',
          fontSize: '13px',
          lineHeight: '1.5',
          minHeight: '40px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}>
          {result || (isTranslating ? '' : '')}
        </div>
      )}
    </div>
  );
}
