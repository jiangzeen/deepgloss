import type { JSX } from 'preact';
import { useState, useRef, useEffect } from 'preact/hooks';
import { LANGUAGES } from '@/shared/languages';
import { Button, Field, SelectField } from '@/shared/ui';

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
  let matchCount = 0;
  let totalCount = 0;

  for (const ch of sample) {
    if (/\s|\d|[.,!?;:'"()[\]{}\-—–…·\/\\@#$%^&*+=<>~`|]/.test(ch)) continue;
    totalCount++;

    switch (lang) {
      case 'zh':
        if (/[\u4e00-\u9fff\u3400-\u4dbf]/.test(ch)) matchCount++;
        break;
      case 'ja':
        if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(ch)) matchCount++;
        break;
      case 'ko':
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

  useEffect(() => {
    if (!autoTargetLang || !secondLang) return;

    const trimmed = text.trim();
    if (!trimmed) {
      setTgtLang(targetLang);
      return;
    }

    setTgtLang(isNativeLanguage(trimmed, targetLang) ? secondLang : targetLang);
  }, [text, autoTargetLang, targetLang, secondLang]);

  const handleSubmit = () => {
    const trimmed = text.trim();
    if (!trimmed || isTranslating) return;
    onTranslate(trimmed, srcLang, tgtLang);
  };

  const handleKeyDown = (e: JSX.TargetedKeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="dg-stack">
      <Field id="translate-text" label="Text to translate" description="Press Ctrl+Enter to translate.">
        <textarea
          id="translate-text"
          ref={textareaRef}
          value={text}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          onKeyDown={handleKeyDown}
          placeholder="输入或粘贴要翻译的文本"
          className="dg-input dg-textarea"
          aria-describedby="translate-text-description"
        />
      </Field>

      <div className="dg-grid-2">
        <SelectField
          id="popup-source-lang"
          label="Source"
          compact
          value={srcLang}
          onChange={(e) => setSrcLang((e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
          ))}
        </SelectField>

        <SelectField
          id="popup-target-lang"
          label="Target"
          compact
          value={tgtLang}
          onChange={(e) => setTgtLang((e.target as HTMLSelectElement).value)}
        >
          {LANGUAGES.filter((l) => l.code !== 'auto').map((lang) => (
            <option key={lang.code} value={lang.code}>{lang.nativeName}</option>
          ))}
        </SelectField>
      </div>

      <Button
        variant={isTranslating ? 'danger' : 'primary'}
        fullWidth
        onClick={isTranslating ? onAbort : handleSubmit}
        disabled={!isTranslating && !text.trim()}
        aria-keyshortcuts="Control+Enter"
      >
        {isTranslating ? '停止翻译' : '翻译'}
      </Button>
    </div>
  );
}
