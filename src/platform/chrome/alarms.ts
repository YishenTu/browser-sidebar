/**
 * @file Chrome Alarms Platform Wrapper
 */

export async function getAllAlarms(): Promise<chrome.alarms.Alarm[]> {
  return new Promise(resolve => {
    try {
      if (!chrome.alarms) {
        resolve([]);
        return;
      }
      chrome.alarms.getAll(alarms => resolve(alarms));
    } catch {
      resolve([]);
    }
  });
}
