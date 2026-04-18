import { useState, useRef, useEffect } from 'preact/hooks';
import { LANGUAGES } from '@/shared/languages';

interface Props {
  sourceLang: string;
  targetLang: string;
  secondLang: string;
  autoTargetLang: boolean;
  onTranslate: (text: string, sourceLang: string, targetLang: string) => void;
  onAbort: () => void;
  isTranslating: boolean;
}

/**
 * Detect if text is predominantly in the native language using Unicode ranges.
 * Returns true if the majority of non-space characters match the native language script.
 */
function isNativeLanguage(text: string, nativeLang: string): boolean {
  const sample = text.trim().slice(0, 200);
  if (!sample) return false;

  const lang = nativeLang.toLowerCase().split('-')[0];

  // Count characters matching the native language script
  let matchCount = 0;
  let totalCount = 0;

  for (const ch of sample) {
    if (/\s|\d|[.,!?;:'"()[\]{}\-—–…·\/\\@#$%^&*+=<>~`|]/.test(ch)) continue;
    totalCount++;

    switch (lang) {
      case 'zh':
        // CJK Unified Ideographs + Extensions
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) matchCount++;
        break;
      case 'ja':
        // Hiragana + Katakana + CJK
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(ch)) matchCount++;
        break;
      case 'ko':
        // Hangul
        if (/[\uac00-\ud7af\u1100-\u11ff\u3130-\u318f]/.test(ch)) matchCount++;
        break;
      case 'ar':
        if (/[\u0600-\u06ff]/.test(ch)) matchCount++;
        break;
      case 'hi':
        if (/[\u0900-\u097f]/.test(ch)) matchCount++;
        break;
      case 'th':
        if (/[\u0e00-\u0e7f]/.test(ch)) matchCount++;
        break;
      case 'ru':
      case 'uk':
        if (/[\u0400-\u04ff]/.test(ch)) matchCount++;
        break;
      default:
        // Latin-based languages (en, fr, de, es, pt, it, nl, pl, vi)
        if (/[a-zA-Z\u00c0-\u024f]/.test(ch)) matchCount++;
        break;
    }
  }

  if (totalCount === 0) return false;
  return matchCount / totalCount > 0.5;
}

export function TranslateInput({ sourceLang, targetLang, secondLang, autoTargetLang, onTranslate, onAbort, isTranslating }: Props) {
  const [text, setText] = useState('');
  const [srcLang, setSrcLang] = useState(sourceLang);
  const [tgtLang, setTgtLang] = useState(targetLang);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  // Auto-detect target language when text changes
  useEffect(() => {
    if (!autoTargetLang || !secondLang) return;

    const trimmed = text.trim();
    if (!trimmed) {
      setTgtLang(targetLang);
      return;
    }

    if (isNativeLanguage(trimmed, targetLang)) {
      // Input is native language → translate to second language
      setTgtLang(secondLang);
    } else {
      // Input is NOT native language → translate to native language
      setTgtLang(targetLang);
    }
  }, [text, autoTargetLang, targetLang, secondLang]);

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
