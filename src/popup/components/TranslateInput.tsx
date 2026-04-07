import { useState, useRef, useEffect } from 'preact/hooks';
import { LANGUAGES } from '@/shared/languages';

interface Props {
  sourceLang: string;
  targetLang: string;
  onTranslate: (text: string, sourceLang: string, targetLang: string) => void;
  onAbort: () => void;
  isTranslating: boolean;
}

export function TranslateInput({ sourceLang, targetLang, onTranslate, onAbort, isTranslating }: Props) {
  const [text, setText] = useState('');
  const [srcLang, setSrcLang] = useState(sourceLang);
  const [tgtLang, setTgtLang] = useState(targetLang);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isTranslating) return;
    onTranslate(trimmed, srcLang, tgtLang);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  const selectStyle: Record<string, string> = {
    flex: '1',
    padding: '4px 6px',
    border: '1px solid #ddd',
    borderRadius: '4px',
    fontSize: '12px',
    background: '#fff',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <textarea
        ref={textareaRef}
        value={text}
        onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
        onKeyDown={handleKeyDown}
        placeholder="输入或粘贴要翻译的文本"
        style={{
          width: '100%',
          minHeight: '80px',
          padding: '8px',
          border: '1px solid #ddd',
          borderRadius: '6px',
          fontSize: '13px',
          fontFamily: 'inherit',
          resize: 'vertical',
          boxSizing: 'border-box',
          lineHeight: '1.4',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <select
          style={selectStyle}
          value={srcLang}
          onChange={(e) => setSrcLang((e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>

        <span style={{ color: '#999', fontSize: '12px' }}>→</span>

        <select
          style={selectStyle}
          value={tgtLang}
          onChange={(e) => setTgtLang((e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
            <option key={lang.code} value={lang.code}>
              {lang.nativeName}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={isTranslating ? onAbort : handleSubmit}
        disabled={!isTranslating && !text.trim()}
        style={{
          width: '100%',
          padding: '7px',
          background: isTranslating ? '#e74c3c' : (!text.trim() ? '#ccc' : '#4A90D9'),
          color: '#fff',
          border: 'none',
          borderRadius: '6px',
          cursor: !isTranslating && !text.trim() ? 'not-allowed' : 'pointer',
          fontSize: '13px',
          fontWeight: 500,
        }}
      >
        {isTranslating ? '停止翻译' : '翻译'}
      </button>
    </div>
  );
}
