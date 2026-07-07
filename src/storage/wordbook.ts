import type { DeepReadResult } from '@/providers/types';
import { hashKey } from '@/shared/utils';
import type { DeepGlossSchema } from './idb-schema';
import { openDeepGlossDB } from './db';

export type WordbookEntry = DeepGlossSchema['wordbook']['value'];

export class WordbookStorage {
  static makeKey(term: string, sourceLang: string, targetLang: string): string {
    return hashKey(`${term.trim().toLowerCase()}|${sourceLang}|${targetLang}`);
  }

  async save(input: {
    deepRead: DeepReadResult;
    sourceLang: string;
    targetLang: string;
    providerId: string;
    sourceUrl: string;
  }): Promise<WordbookEntry> {
    const db = await openDeepGlossDB();
    const term = input.deepRead.normalizedTerm || input.deepRead.term;
    const termKey = WordbookStorage.makeKey(term, input.sourceLang, input.targetLang);
    const existing = await db.get('wordbook', termKey);
    const now = Date.now();
    const entry: WordbookEntry = {
      termKey,
      term,
      sourceLang: input.sourceLang,
      targetLang: input.targetLang,
      providerId: input.providerId,
      sourceUrl: input.sourceUrl,
      deepRead: input.deepRead,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    await db.put('wordbook', entry);
    return entry;
  }

  async get(term: string, sourceLang: string, targetLang: string): Promise<WordbookEntry | null> {
    const db = await openDeepGlossDB();
    const termKey = WordbookStorage.makeKey(term, sourceLang, targetLang);
    return (await db.get('wordbook', termKey)) || null;
  }

  async list(limit = 100): Promise<WordbookEntry[]> {
    const db = await openDeepGlossDB();
    const tx = db.transaction('wordbook', 'readonly');
    const index = tx.store.index('updatedAt');
    const results: WordbookEntry[] = [];
    let cursor = await index.openCursor(null, 'prev');

    while (cursor && results.length < limit) {
      results.push(cursor.value);
      cursor = await cursor.continue();
    }

    return results;
  }

  async remove(termKey: string): Promise<void> {
    const db = await openDeepGlossDB();
    await db.delete('wordbook', termKey);
  }
}
