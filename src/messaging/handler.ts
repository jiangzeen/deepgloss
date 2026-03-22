import type { ContentToBackgroundMessage, BackgroundToContentMessage } from './types';

type MessageHandler = (
  message: ContentToBackgroundMessage,
) => Promise<BackgroundToContentMessage>;

/**
 * Register a message handler in the background service worker.
 */
export function registerMessageHandler(handler: MessageHandler): void {
  chrome.runtime.onMessage.addListener(
    (message: ContentToBackgroundMessage, _sender, sendResponse) => {
      handler(message).then(sendResponse).catch((err) => {
        sendResponse({
          type: 'TRANSLATE_ERROR',
          payload: { message: (err as Error).message, code: 'HANDLER_ERROR' },
        } as BackgroundToContentMessage);
      });
      return true; // async response
    },
  );
}
