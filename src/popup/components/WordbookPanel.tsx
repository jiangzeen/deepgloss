import { useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@/messaging/sender';
import type { WordbookEntry } from '@/storage/wordbook';

export function WordbookPanel() {
  const [words, setWords] = useState<WordbookEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWords = async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await sendMessage({ type: 'LIST_WORDS', payload: { limit: 100 } });
      if (resp.type === 'WORD_LIST') {
        setWords(resp.payload);
      } else if (resp.type === 'TRANSLATE_ERROR') {
        setError(resp.payload.message);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWords();
  }, []);

  const removeWord = async (termKey: string) => {
    await sendMessage({ type: 'REMOVE_WORD', payload: { termKey } });
    setWords((prev) => prev.filter((entry) => entry.termKey !== termKey));
  };

  if (loading) {
    return <div style={{ padding: '12px', color: '#777', fontSize: '13px' }}>加载词库...</div>;
  }

  if (error) {
    return (
      <div style={{
        padding: '10px',
        background: '#fef2f2',
        border: '1px solid #fecaca',
        borderRadius: '6px',
        color: '#dc2626',
        fontSize: '13px',
      }}>
        {error}
      </div>
    );
  }

  if (words.length === 0) {
    return <div style={{ padding: '12px', color: '#777', fontSize: '13px' }}>暂无收藏词。</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {words.map((entry) => {
        const firstDefinition = entry.deepRead.definitions[0];
        const meta = [entry.deepRead.phonetic, entry.deepRead.partOfSpeech].filter(Boolean).join(' · ');
        return (
          <div key={entry.termKey} style={{
            padding: '10px',
            border: '1px solid #e5e7eb',
            borderRadius: '8px',
            background: '#fff',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 650, fontSize: '14px', color: '#222' }}>{entry.term}</div>
                {meta && <div style={{ color: '#777', fontSize: '12px', marginTop: '1px' }}>{meta}</div>}
              </div>
              <button
                onClick={() => removeWord(entry.termKey)}
                title="删除"
                style={{
                  width: '24px',
                  height: '24px',
                  border: '1px solid #ddd',
                  borderRadius: '4px',
                  background: '#fff',
                  color: '#777',
                  cursor: 'pointer',
                  flexShrink: 0,
                }}
              >
                ×
              </button>
            </div>

            {firstDefinition && (
              <div style={{ marginTop: '6px', fontSize: '13px', color: '#333', lineHeight: 1.45 }}>
                {firstDefinition.translation || firstDefinition.meaning}
              </div>
            )}

            {entry.deepRead.contextualMeaning && (
              <div style={{ marginTop: '6px', fontSize: '12px', color: '#666', lineHeight: 1.45 }}>
                {entry.deepRead.contextualMeaning}
              </div>
            )}

            {entry.sourceUrl && (
              <a
                href={entry.sourceUrl}
                target="_blank"
                rel="noreferrer"
                style={{ display: 'block', marginTop: '6px', color: '#64748b', fontSize: '11px', textDecoration: 'none' }}
              >
                来源页面
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}
