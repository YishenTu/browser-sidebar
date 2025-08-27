/**
 * @file Content Script Entry Point
 *
 * Main entry point for the tab extension content script.
 * Coordinates initialization of core modules and establishes communication.
 */

/* eslint-disable no-console */
import { createMessage, isValidMessage } from '@/types/messages';
import { initializeDocumentPatches } from './core/documentPatcher';
import { MessageHandler } from './core/messageHandler';
import { SidebarController } from './core/sidebarController';

// Initialize document patches early
initializeDocumentPatches();

// Initialize core modules
const sidebarController = new SidebarController();
const messageHandler = new MessageHandler(sidebarController);

// Set up message handling
messageHandler.initialize();

// Notify background that content script is ready
const readyMessage = createMessage({
  type: 'CONTENT_READY',
  payload: {
    status: 'content-script-ready',
    url: window.location.href,
    title: document.title,
    timestamp: Date.now(),
  },
  source: 'content',
  target: 'background',
});

chrome.runtime.sendMessage(readyMessage, response => {
  if (response && isValidMessage(response)) {
    // Background acknowledged - ready to handle messages
  }
});

export {};
