import { openDB, type IDBPDatabase } from 'idb';
import type { TranslationSegment } from '@/providers/types';
import type { DeepGlossSchema } from './idb-schema';
import { hashKey } from '@/shared/utils';

export class TranslationCache {
  private db: IDBPDatabase<DeepGlossSchema> | null = null;
  private maxSize: number;

  constructor(maxSize = 1000) {
    this.maxSize = maxSize;
  }

  private async getDb(): Promise<IDBPDatabase<DeepGlossSchema>> {
    if (!this.db) {
      this.db = await openDB<DeepGlossSchema>('deepgloss', 1, {
        upgrade(db) {
          const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
          cacheStore.createIndex('accessedAt', 'accessedAt');

          const historyStore = db.createObjectStore('history', {
            keyPath: 'id',
            autoIncrement: true,
          });
          historyStore.createIndex('createdAt', 'createdAt');
        },
      });
    }
    return this.db;
  }

  static makeKey(text: string, sourceLang: string, targetLang: string, providerId?: string): string {
    return hashKey(`${text}|${sourceLang}|${targetLang}|${providerId || 'default'}`);
  }

  async get(text: string, sourceLang: string, targetLang: string, providerId?: string): Promise<TranslationSegment | null> {
    const db = await this.getDb();
    const key = TranslationCache.makeKey(text, sourceLang, targetLang, providerId);
    const entry = await db.get('cache', key);
    if (!entry) return null;

    // Update accessedAt (fire and forget)
    entry.accessedAt = Date.now();
    db.put('cache', entry);

    return entry.result;
  }

  async set(text: string, sourceLang: string, targetLang: string, result: TranslationSegment, providerId?: string): Promise<void> {
    const db = await this.getDb();
    const key = TranslationCache.makeKey(text, sourceLang, targetLang, providerId);
    await db.put('cache', {
      key,
      result,
      accessedAt: Date.now(),
      createdAt: Date.now(),
    });
    this.evictIfNeeded();
  }

  private async evictIfNeeded(): Promise<void> {
    const db = await this.getDb();
    const count = await db.count('cache');
    if (count <= this.maxSize) return;

    const toDelete = count - this.maxSize;
    const tx = db.transaction('cache', 'readwrite');
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
