import { openDB, type IDBPDatabase } from 'idb';
import type { DeepGlossSchema } from './idb-schema';

export interface HistoryEntry {
  id?: number;
  sourceText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  providerId: string;
  url: string;
  createdAt: number;
}

export class TranslationHistory {
  private db: IDBPDatabase<DeepGlossSchema> | null = null;

  private async getDb(): Promise<IDBPDatabase<DeepGlossSchema>> {
    if (!this.db) {
      this.db = await openDB<DeepGlossSchema>('deepgloss', 1, {
        upgrade(db) {
          if (!db.objectStoreNames.contains('cache')) {
            const cacheStore = db.createObjectStore('cache', { keyPath: 'key' });
            cacheStore.createIndex('accessedAt', 'accessedAt');
          }
          if (!db.objectStoreNames.contains('history')) {
            const historyStore = db.createObjectStore('history', {
              keyPath: 'id',
              autoIncrement: true,
            });
            historyStore.createIndex('createdAt', 'createdAt');
          }
        },
      });
    }
    return this.db;
  }

  async add(entry: Omit<HistoryEntry, 'id' | 'createdAt'>): Promise<void> {
    const db = await this.getDb();
    await db.add('history', {
      ...entry,
      createdAt: Date.now(),
    });
  }

  async getRecent(limit = 50, offset = 0): Promise<HistoryEntry[]> {
    const db = await this.getDb();
    const tx = db.transaction('history', 'readonly');
    const index = tx.store.index('createdAt');
    const results: HistoryEntry[] = [];
    let cursor = await index.openCursor(null, 'prev');
    let skipped = 0;

    while (cursor) {
      if (skipped < offset) {
        skipped++;
        cursor = await cursor.continue();
        continue;
      }
      if (results.length >= limit) break;
      results.push(cursor.value);
      cursor = await cursor.continue();
    }

    return results;
  }

  async clear(): Promise<void> {
    const db = await this.getDb();
    await db.clear('history');
  }

  async delete(id: number): Promise<void> {
    const db = await this.getDb();
    await db.delete('history', id);
  }
}
