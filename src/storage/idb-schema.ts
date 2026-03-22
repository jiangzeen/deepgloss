import type { DBSchema } from 'idb';
import type { TranslationSegment } from '@/providers/types';

export interface DeepGlossSchema extends DBSchema {
  cache: {
    key: string;
    value: {
      key: string;
      result: TranslationSegment;
      accessedAt: number;
      createdAt: number;
    };
    indexes: {
      accessedAt: number;
    };
  };
  history: {
    key: number;
    value: {
      id?: number;
      sourceText: string;
      translatedText: string;
      sourceLang: string;
      targetLang: string;
      providerId: string;
      url: string;
      createdAt: number;
    };
    indexes: {
      createdAt: number;
    };
  };
}
