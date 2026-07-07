import { useEffect, useState } from 'preact/hooks';
import { sendMessage } from '@/messaging/sender';
import type { WordbookEntry } from '@/storage/wordbook';
import { IconButton, StatusMessage } from '@/shared/ui';

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

  if (loading) return <StatusMessage>加载词库...</StatusMessage>;
  if (error) return <StatusMessage tone="error">{error}</StatusMessage>;
  if (words.length === 0) return <StatusMessage>暂无收藏词。</StatusMessage>;

  return (
    <div className="dg-word-list" aria-label="收藏词列表">
      {words.map((entry) => {
        const firstDefinition = entry.deepRead.definitions[0];
        const meta = [entry.deepRead.phonetic, entry.deepRead.partOfSpeech].filter(Boolean).join(' · ');
        return (
          <article key={entry.termKey} className="dg-surface">
            <div className="dg-word-card__header">
              <div>
                <div className="dg-word-card__term">{entry.term}</div>
                {meta && <div className="dg-word-card__meta">{meta}</div>}
              </div>
              <IconButton
                aria-label={`删除 ${entry.term}`}
                title="删除"
                onClick={() => removeWord(entry.termKey)}
              >
                ×
              </IconButton>
            </div>

            {firstDefinition && (
              <div className="dg-word-card__body">
                {firstDefinition.translation || firstDefinition.meaning}
              </div>
            )}

            {entry.deepRead.contextualMeaning && (
              <div className="dg-word-card__context">{entry.deepRead.contextualMeaning}</div>
            )}

            {entry.sourceUrl && (
              <a className="dg-link" href={entry.sourceUrl} target="_blank" rel="noreferrer">
                来源页面
              </a>
            )}
          </article>
        );
      })}
    </div>
  );
}
