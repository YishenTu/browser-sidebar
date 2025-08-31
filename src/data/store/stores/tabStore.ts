/**
 * @file Tab Store
 *
 * Manages tab content state within sessions
 */

import { create } from 'zustand';
import { TabContent } from '../../../types/tabs';
import { useSessionStore } from './sessionStore';

export interface TabState {
  // Actions for tab state management
  setLoadedTabs: (tabs: Record<number, TabContent>) => void;
  addLoadedTab: (tabId: number, tabContent: TabContent) => void;
  updateTabContent: (tabId: number, editedContent: string) => void;
  removeLoadedTab: (tabId: number) => void;
  setCurrentTabId: (tabId: number | null) => void;
  setHasAutoLoaded: (value: boolean) => void;

  // Selectors for tab data
  getLoadedTabs: () => Record<number, TabContent>;
  getTabContent: (tabId: number) => TabContent | undefined;
  getCurrentTabContent: () => TabContent | undefined;
  getCurrentTabId: () => number | null;
  isTabLoaded: (tabId: number) => boolean;
  getLoadedTabIds: () => number[];
  getLoadedTabCount: () => number;
  getHasAutoLoaded: () => boolean;
}

export const useTabStore = create<TabState>(() => ({
  setLoadedTabs: (tabs: Record<number, TabContent>) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ loadedTabs: tabs });
  },

  addLoadedTab: (tabId: number, tabContent: TabContent) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      const newOrder = session.tabSelectionOrder.filter(id => id !== tabId);
      newOrder.push(tabId);

      sessionStore.updateActiveSession({
        loadedTabs: {
          ...session.loadedTabs,
          [tabId]: tabContent,
        },
        tabSelectionOrder: newOrder,
      });
    }
  },

  updateTabContent: (tabId: number, editedContent: string) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      const existingTab = session.loadedTabs[tabId];
      if (!existingTab) return;

      sessionStore.updateActiveSession({
        loadedTabs: {
          ...session.loadedTabs,
          [tabId]: {
            ...existingTab,
            extractedContent: {
              ...existingTab.extractedContent,
              content: editedContent,
            },
          },
        },
      });
    }
  },

  removeLoadedTab: (tabId: number) => {
    const sessionStore = useSessionStore.getState();
    const session = sessionStore.getActiveSession();

    if (session) {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [tabId]: removed, ...remainingTabs } = session.loadedTabs;
      const newOrder = session.tabSelectionOrder.filter(id => id !== tabId);

      sessionStore.updateActiveSession({
        loadedTabs: remainingTabs,
        currentTabId: session.currentTabId === tabId ? null : session.currentTabId,
        tabSelectionOrder: newOrder,
      });
    }
  },

  setCurrentTabId: (tabId: number | null) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ currentTabId: tabId });
  },

  setHasAutoLoaded: (value: boolean) => {
    const sessionStore = useSessionStore.getState();
    sessionStore.updateActiveSession({ hasAutoLoaded: value });
  },

  // Selectors
  getLoadedTabs: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.loadedTabs : {};
  },

  getTabContent: (tabId: number) => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.loadedTabs[tabId] : undefined;
  },

  getCurrentTabContent: () => {
    const session = useSessionStore.getState().getActiveSession();
    if (!session || !session.currentTabId) return undefined;
    return session.loadedTabs[session.currentTabId];
  },

  getCurrentTabId: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.currentTabId : null;
  },

  isTabLoaded: (tabId: number) => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? tabId in session.loadedTabs : false;
  },

  getLoadedTabIds: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? Object.keys(session.loadedTabs).map(id => parseInt(id, 10)) : [];
  },

  getLoadedTabCount: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? Object.keys(session.loadedTabs).length : 0;
  },

  getHasAutoLoaded: () => {
    const session = useSessionStore.getState().getActiveSession();
    return session ? session.hasAutoLoaded : false;
  },
}));
