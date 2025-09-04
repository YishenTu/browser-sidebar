/**
 * @file Chrome Platform API Wrappers
 *
 * Curated re-exports to avoid TS2308 name collisions when multiple modules
 * export the same symbols (e.g., SendMessageOptions, MessageListener,
 * broadcastMessage). Prefer explicit re-exports with aliases for clarity.
 */

// runtime
export {
  ChromeRuntimeError,
  normalizeRuntimeError,
  checkRuntimeError,
  sendMessage,
  addMessageListener,
} from './runtime';
export type {
  MessageResponse as RuntimeMessageResponse,
  SendMessageOptions as RuntimeSendMessageOptions,
  MessageListener as RuntimeMessageListener,
  EventListenerOptions as RuntimeEventListenerOptions,
} from './runtime';

// storage
export * from './storage';

// ports
export * from './ports';

// keepAlive
export * from './keepAlive';

// tabs (alias colliding names)
export {
  getActiveTabId,
  getTab,
  queryTabs,
  getAllTabs,
  getTabs,
  sendMessageToTab,
  sendMessageToTabs,
  broadcastMessage as broadcastTabMessage,
  isTabAccessible,
  waitForTabReady,
  getTabsByWindow,
  getTabsByDomain,
  findTabsByUrl,
} from './tabs';
export type {
  TabQueryOptions,
  SendMessageOptions as TabSendMessageOptions,
  TabMessageResult,
  TabOperationResult,
} from './tabs';

// messaging (alias colliding names)
export {
  ChromeMessageBus,
  broadcastMessage as broadcastMessage,
  getChromeMessageBus,
  initializeChromeMessaging,
  sendChromeMessage,
  requestResponse,
  subscribeToEvent,
  subscribeOnce,
  checkMessagingHealth,
  resetChromeMessageBus,
} from './messaging';
export type {
  RequestOptions as MessagingRequestOptions,
  EventSubscriptionOptions,
  BroadcastOptions as MessagingBroadcastOptions,
  EventHandler as MessagingEventHandler,
} from './messaging';
