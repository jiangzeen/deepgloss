import { openDB, type IDBPDatabase } from 'idb';
import type { DeepGlossSchema } from './idb-schema';

const DB_NAME = 'deepgloss';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<DeepGlossSchema>> | null = null;

export function openDeepGlossDB(): Promise<IDBPDatabase<DeepGlossSchema>> {
  if (!dbPromise) {
    dbPromise = openDB<DeepGlossSchema>(DB_NAME, DB_VERSION, {
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

        if (!db.objectStoreNames.contains('wordbook')) {
          const wordbookStore = db.createObjectStore('wordbook', {
            keyPath: 'termKey',
          });
          wordbookStore.createIndex('updatedAt', 'updatedAt');
          wordbookStore.createIndex('term', 'term');
        }
      },
    });
  }

  return dbPromise;
}
