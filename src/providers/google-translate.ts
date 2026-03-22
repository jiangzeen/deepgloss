import type {
  TranslationProvider,
  TranslationRequest,
  TranslationSegment,
  ProviderCapabilities,
  ProviderConfig,
} from './types';

export class GoogleTranslateProvider implements TranslationProvider {
  readonly id = 'google';
  readonly name = 'Google Translate';
  readonly capabilities: ProviderCapabilities = {
    supportsStreaming: false,
    supportsAutoDetect: true,
    supportsGloss: false,
    supportsContext: false,
    maxTextLength: 5000,
    requiresApiKey: false,
  };

  configure(_config: ProviderConfig): void {
    // no-op: Google Translate free API needs no config
  }

  async validateConfig(_config: ProviderConfig): Promise<{ valid: boolean; error?: string }> {
    return { valid: true };
  }

  async translate(req: TranslationRequest): Promise<TranslationSegment> {
    const sl = req.sourceLang === 'auto' ? 'auto' : req.sourceLang;
    const url = new URL('https://translate.googleapis.com/translate_a/single');
    url.searchParams.set('client', 'gtx');
    url.searchParams.set('sl', sl);
    url.searchParams.set('tl', req.targetLang);
    url.searchParams.set('dt', 't');   // translation
    url.searchParams.set('dj', '1');   // JSON response format
    url.searchParams.set('q', req.text);

    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`Google Translate error: ${resp.status}`);

    const data = await resp.json();

    const translatedText = (data.sentences as Array<{ trans: string }>)
      ?.map((s) => s.trans)
      .filter(Boolean)
      .join('') || '';

    const detectedLang = data.src as string | undefined;

    return {
      text: translatedText,
      detectedLang,
    };
  }
}
