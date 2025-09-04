/**
 * @file Chrome Scripting Platform Wrapper
 *
 * Typed, safe wrappers for chrome.scripting APIs with basic error handling.
 */

export interface ExecuteScriptOptions {
  target: chrome.scripting.InjectionTarget;
  files?: string[];
  func?: (...args: unknown[]) => unknown;
  args?: unknown[];
  world?: chrome.scripting.ExecutionWorld;
}

export interface InsertCSSOptions {
  target: chrome.scripting.InjectionTarget;
  files?: string[];
  css?: string;
  origin?: chrome.scripting.StyleOrigin;
}

function checkLastError(context: string): void {
  if (chrome.runtime.lastError) {
    const msg = chrome.runtime.lastError.message || 'Unknown scripting error';
    throw new Error(`${context} failed: ${msg}`);
  }
}

export async function executeScript<T = unknown>(
  options: ExecuteScriptOptions
): Promise<chrome.scripting.InjectionResult<T>[]> {
  try {
    const results = await chrome.scripting.executeScript(
      options as chrome.scripting.ScriptInjection<unknown[], T>
    );
    checkLastError('executeScript');
    return results as chrome.scripting.InjectionResult<T>[];
  } catch (error) {
    throw new Error(
      `executeScript failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

export async function insertCSS(options: InsertCSSOptions): Promise<void> {
  try {
    await chrome.scripting.insertCSS(options as chrome.scripting.CSSInjection);
    checkLastError('insertCSS');
  } catch (error) {
    throw new Error(`insertCSS failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Convenience helper to inject CSS (if provided) before JS files.
 */
export async function injectContent(
  tabId: number,
  jsFiles: string[],
  cssFiles: string[] = []
): Promise<void> {
  if (cssFiles.length) {
    await insertCSS({ target: { tabId }, files: cssFiles });
  }
  if (jsFiles.length) {
    await executeScript({ target: { tabId }, files: jsFiles });
  }
}
