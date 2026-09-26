import type { IDBPDatabase } from 'idb';
import type { DeepReadResult } from '@/providers/types';
import type { DeepGlossSchema } from './idb-schema';
import { hashKey } from '@/shared/utils';
import { openDeepGlossDB } from './db';

/**
 * LRU cache for AI deep-read results.
 *
 * Deep reads are considerably more expensive than translations, so they get
 * their own store, a smaller default capacity and a key that also captures the
 * provider/model **and the requested section set** (different section sets
 * produce different results).
 */
export class DeepReadCacheStorage {
  private maxSize: number;

  constructor(maxSize = 200) {
    this.maxSize = maxSize;
  }

  setMaxSize(maxSize: number): void {
    this.maxSize = maxSize;
  }

  private async getDb(): Promise<IDBPDatabase<DeepGlossSchema>> {
    return openDeepGlossDB();
  }

  static makeKey(
    text: string,
    sourceLang: string,
    targetLang: string,
    providerId: string,
    model: string | undefined,
    sectionsKey: string,
  ): string {
    return hashKey(
      `${text.trim().toLowerCase()}|${sourceLang}|${targetLang}|${providerId}|${model || ''}|${sectionsKey}`,
    );
  }

  async get(
    text: string,
    sourceLang: string,
    targetLang: string,
    providerId: string,
    model: string | undefined,
    sectionsKey: string,
  ): Promise<DeepReadResult | null> {
    const db = await this.getDb();
    const key = DeepReadCacheStorage.makeKey(
      text,
      sourceLang,
      targetLang,
      providerId,
      model,
      sectionsKey,
    );
    const entry = await db.get('deepReadCache', key);
    if (!entry) return null;

    // Touch for LRU (fire and forget).
    entry.accessedAt = Date.now();
    void db.put('deepReadCache', entry);

    return entry.result;
  }

  async set(
    text: string,
    sourceLang: string,
    targetLang: string,
    providerId: string,
    model: string | undefined,
    sectionsKey: string,
    result: DeepReadResult,
  ): Promise<void> {
    const db = await this.getDb();
    const key = DeepReadCacheStorage.makeKey(
      text,
      sourceLang,
      targetLang,
      providerId,
      model,
      sectionsKey,
    );
    const existing = await db.get('deepReadCache', key);
    await db.put('deepReadCache', {
      key,
      result,
      createdAt: existing?.createdAt ?? Date.now(),
      accessedAt: Date.now(),
    });
    await this.evictIfNeeded();
  }

  private async evictIfNeeded(): Promise<void> {
    const db = await this.getDb();
    const count = await db.count('deepReadCache');
    if (count <= this.maxSize) return;

    const toDelete = count - this.maxSize;
    const tx = db.transaction('deepReadCache', 'readwrite');
    const index = tx.store.index('accessedAt');
    let cursor = await index.openCursor();
    let deleted = 0;
    while (cursor && deleted < toDelete) {
      await cursor.delete();
      deleted++;
      cursor = await cursor.continue();
    }
    await tx.done;
  }
}
