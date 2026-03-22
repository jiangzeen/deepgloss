import type {
  ContentToBackgroundMessage,
  BackgroundToContentMessage,
  TranslateStreamStartMessage,
} from './types';
import { STREAM_PORT_NAME } from '@/shared/constants';

/**
 * Send a one-shot message to the background service worker.
 */
export function sendMessage(
  message: ContentToBackgroundMessage,
): Promise<BackgroundToContentMessage> {
  return chrome.runtime.sendMessage(message);
}

/**
 * Open a long-lived port for streaming translation.
 */
export function openStreamPort(
  message: TranslateStreamStartMessage,
): chrome.runtime.Port {
  const port = chrome.runtime.connect({ name: STREAM_PORT_NAME });
  port.postMessage(message);
  return port;
}
