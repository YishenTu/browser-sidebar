/**
 * @file Provider Manager Hook (new architecture)
 */

import { useRef, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@store/settings';
import { EngineManagerService } from '../../../services/engine/EngineManagerService';
import type { ProviderType, AIProvider } from '../../../types/providers';
import type { UseProviderManagerReturn, AIStats } from './types';

export function useProviderManager(enabled = true): UseProviderManagerReturn {
  const settingsStore = useSettingsStore();
  const serviceRef = useRef<EngineManagerService | null>(null);

  const ensureService = useCallback(() => {
    if (!serviceRef.current) {
      serviceRef.current = EngineManagerService.getInstance({
        autoInitialize: false,
        enableStats: true,
      });
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    ensureService();
  }, [enabled, ensureService]);

  const initializeProviders = useCallback(async () => {
    ensureService();
    await serviceRef.current!.initializeFromSettings();
  }, [ensureService]);

  const getActiveProvider = useCallback((): AIProvider | null => {
    try {
      return serviceRef.current?.getActive() || null;
    } catch {
      return null;
    }
  }, []);

  const switchProvider = useCallback(
    async (providerType: ProviderType) => {
      await serviceRef.current?.initializeFromSettings();
      await serviceRef.current?.switch(providerType);

      if (providerType !== 'openai') {
        const { useUIStore } = await import('@store/chat');
        useUIStore.getState().setLastResponseId(null);
      }

      await settingsStore.updateAISettings({
        ...settingsStore.settings.ai,
        defaultProvider: providerType,
      });
    },
    [settingsStore]
  );

  const getStats = useCallback((): AIStats => {
    const stats = serviceRef.current?.getStats();
    return {
      activeProvider: stats?.activeProvider || null,
      registeredProviders: stats?.registeredProviders || [],
    };
  }, []);

  return { getActiveProvider, switchProvider, initializeProviders, getStats };
}
