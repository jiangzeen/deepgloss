import type { TranslationProvider, ProviderConfig } from './types';
import { GoogleTranslateProvider } from './google-translate';
import { OpenAICompatibleProvider } from './openai-compatible';

export class ProviderRegistry {
  private providers = new Map<string, TranslationProvider>();

  constructor() {
    this.register(new GoogleTranslateProvider());
    this.register(new OpenAICompatibleProvider());
  }

  register(provider: TranslationProvider): void {
    this.providers.set(provider.id, provider);
  }

  get(id: string): TranslationProvider {
    const provider = this.providers.get(id);
    if (!provider) throw new Error(`Unknown provider: ${id}`);
    return provider;
  }

  getAll(): TranslationProvider[] {
    return Array.from(this.providers.values());
  }

  async configureAll(configs: Record<string, ProviderConfig>): Promise<void> {
    for (const [id, config] of Object.entries(configs)) {
      const provider = this.providers.get(id);
      if (provider) provider.configure(config);
    }
  }
}
