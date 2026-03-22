import type { TranslationSegment } from '@/providers/types';
import type { DeepGlossSettings } from '@/storage/settings';

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
  | GetSettingsMessage;

export type BackgroundToContentMessage =
  | TranslateResultResponse
  | TranslateStreamChunkResponse
  | TranslateErrorResponse
  | CacheHitResponse
  | SettingsResponse;

export type TabMessage = ContextMenuTranslateMessage;
