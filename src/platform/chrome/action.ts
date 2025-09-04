/**
 * @file Chrome Action (toolbar icon) wrapper
 */

export type ActionClickListener = (tab: chrome.tabs.Tab) => void | Promise<void>;

export interface ListenerOptions {
  handleErrors?: boolean;
  onError?: (error: Error) => void;
}

export function addClickedListener(
  listener: ActionClickListener,
  options: ListenerOptions = {}
): () => void {
  const { handleErrors = true, onError } = options;

  const wrapped = async (tab: chrome.tabs.Tab) => {
    try {
      await listener(tab);
    } catch (err) {
      if (handleErrors) {
        const e = err instanceof Error ? err : new Error(String(err));
        if (onError) onError(e);
        else console.error('Action click handler error:', e);
      }
    }
  };

  chrome.action.onClicked.addListener(wrapped);
  return () => chrome.action.onClicked.removeListener(wrapped);
}
