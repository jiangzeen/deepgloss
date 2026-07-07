import { useState } from 'preact/hooks';
import { Button, StatusMessage } from '@/shared/ui';

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
    <section className="dg-stack dg-stack--tight" aria-labelledby="translate-result-title">
      <div className="dg-result-header">
        <span className="dg-meta-label" id="translate-result-title">
          翻译结果{isTranslating ? '（翻译中...）' : ''}
        </span>
        {result && (
          <Button size="compact" onClick={handleCopy} aria-live="polite">
            {copied ? '已复制' : '复制'}
          </Button>
        )}
      </div>

      {error ? (
        <StatusMessage tone="error">{error}</StatusMessage>
      ) : (
        <div className="dg-status dg-result" role="status" aria-live="polite" aria-atomic="false">
          {result || (isTranslating ? '正在等待翻译结果...' : '')}
        </div>
      )}
    </section>
  );
}
