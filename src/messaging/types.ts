import type { DeepReadResult, TranslationSegment } from '@/providers/types';
import type { DeepGlossSettings } from '@/storage/settings';
import type { WordbookEntry } from '@/storage/wordbook';

// ---- Content -> Background ----

export interface TranslateMessage {
  type: 'TRANSLATE';
  payload: {
    text: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
    providerId?: string;
  };
}

export interface TranslateStreamStartMessage {
  type: 'TRANSLATE_STREAM_START';
  payload: {
    text: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
    providerId?: string;
  };
}

export interface TranslateStreamCancelMessage {
  type: 'TRANSLATE_STREAM_CANCEL';
  payload: { requestId: string };
}

export interface CacheLookupMessage {
  type: 'CACHE_LOOKUP';
  payload: { text: string; sourceLang: string; targetLang: string };
}

export interface GetSettingsMessage {
  type: 'GET_SETTINGS';
}

export interface DeepReadMessage {
  type: 'DEEP_READ';
  payload: {
    text: string;
    sourceLang: string;
    targetLang: string;
    context?: string;
    translatedText?: string;
    providerId?: string;
  };
}

export interface SaveWordMessage {
  type: 'SAVE_WORD';
  payload: {
    deepRead: DeepReadResult;
    sourceLang: string;
    targetLang: string;
    providerId: string;
    sourceUrl: string;
  };
}

export interface GetWordMessage {
  type: 'GET_WORD';
  payload: { term: string; sourceLang: string; targetLang: string };
}

export interface ListWordsMessage {
  type: 'LIST_WORDS';
  payload?: { limit?: number };
}

export interface RemoveWordMessage {
  type: 'REMOVE_WORD';
  payload: { termKey: string };
}

// ---- Background -> Content ----

export interface TranslateResultResponse {
  type: 'TRANSLATE_RESULT';
  payload: TranslationSegment;
}

export interface TranslateStreamChunkResponse {
  type: 'TRANSLATE_STREAM_CHUNK';
  payload: { chunk: string; done: boolean };
}

export interface TranslateErrorResponse {
  type: 'TRANSLATE_ERROR';
  payload: { message: string; code: string };
}

export interface CacheHitResponse {
  type: 'CACHE_HIT';
  payload: TranslationSegment | null;
}

export interface SettingsResponse {
  type: 'SETTINGS';
  payload: DeepGlossSettings;
}

export interface DeepReadResultResponse {
  type: 'DEEP_READ_RESULT';
  payload: { result: DeepReadResult; saved: boolean };
}

export interface WordSavedResponse {
  type: 'WORD_SAVED';
  payload: WordbookEntry;
}

export interface WordLookupResponse {
  type: 'WORD_LOOKUP';
  payload: WordbookEntry | null;
}

export interface WordListResponse {
  type: 'WORD_LIST';
  payload: WordbookEntry[];
}

export interface WordRemovedResponse {
  type: 'WORD_REMOVED';
  payload: { termKey: string };
}

// ---- Background -> Content (tab message for context menu) ----

export interface ContextMenuTranslateMessage {
  type: 'CONTEXT_MENU_TRANSLATE';
  payload: { text: string };
}

// ---- Union types ----

export type ContentToBackgroundMessage =
  | TranslateMessage
  | TranslateStreamStartMessage
  | TranslateStreamCancelMessage
  | CacheLookupMessage
  | GetSettingsMessage
  | DeepReadMessage
  | SaveWordMessage
  | GetWordMessage
  | ListWordsMessage
  | RemoveWordMessage;

export type BackgroundToContentMessage =
  | TranslateResultResponse
  | TranslateStreamChunkResponse
  | TranslateErrorResponse
  | CacheHitResponse
  | SettingsResponse
  | DeepReadResultResponse
  | WordSavedResponse
  | WordLookupResponse
  | WordListResponse
  | WordRemovedResponse;

export type TabMessage = ContextMenuTranslateMessage;
