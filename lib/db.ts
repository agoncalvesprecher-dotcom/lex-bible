import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'biblia_app_offline';
const DB_VERSION = 1;

export interface CachedChapter {
  id: string; // version-bookId-chapter
  version: string;
  bookId: number;
  chapter: number;
  content: unknown[];
  timestamp: number;
}

export interface CachedLexicon {
  id: string; // word-reference
  word: string;
  reference: string;
  content: unknown;
  timestamp: number;
}

let dbPromise: Promise<IDBPDatabase> | null = null;

const getDB = () => {
  if (typeof window === 'undefined') return null;
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('chapters')) {
          db.createObjectStore('chapters', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('lexicon')) {
          db.createObjectStore('lexicon', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('bibliology')) {
          db.createObjectStore('bibliology', { keyPath: 'id' });
        }
      },
    });
  }
  return dbPromise;
};

export interface CachedBibliology {
  id: string; // bookName
  content: string;
  timestamp: number;
}

export const saveBibliology = async (bookName: string, content: string) => {
  const db = await getDB();
  if (!db) return;
  await db.put('bibliology', {
    id: bookName,
    content,
    timestamp: Date.now(),
  });
};

export const getBibliology = async (bookName: string) => {
  const db = await getDB();
  if (!db) return null;
  return await db.get('bibliology', bookName);
};

export const saveChapter = async (version: string, bookId: number, chapter: number, content: unknown[]) => {
  const db = await getDB();
  if (!db) return;
  const id = `${version}-${bookId}-${chapter}`;
  await db.put('chapters', {
    id,
    version,
    bookId,
    chapter,
    content,
    timestamp: Date.now(),
  });
};

export const getChapter = async (version: string, bookId: number, chapter: number) => {
  const db = await getDB();
  if (!db) return null;
  const id = `${version}-${bookId}-${chapter}`;
  return await db.get('chapters', id);
};

export const saveLexicon = async (word: string, reference: string, content: unknown) => {
  const db = await getDB();
  if (!db) return;
  const id = `${word}-${reference}`;
  await db.put('lexicon', {
    id,
    word,
    reference,
    content,
    timestamp: Date.now(),
  });
};

export const getLexicon = async (word: string, reference: string) => {
  const db = await getDB();
  if (!db) return null;
  const id = `${word}-${reference}`;
  return await db.get('lexicon', id);
};

export const getAllCachedChapters = async () => {
  const db = await getDB();
  if (!db) return [];
  return await db.getAll('chapters');
};

export const deleteCachedChapter = async (id: string) => {
  const db = await getDB();
  if (!db) return;
  await db.delete('chapters', id);
};

export const clearAllCache = async () => {
  const db = await getDB();
  if (!db) return;
  await db.clear('chapters');
  await db.clear('lexicon');
};
