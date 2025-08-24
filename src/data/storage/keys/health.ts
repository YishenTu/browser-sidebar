/**
 * @file Health and Connection Testing
 *
 * Functions for testing API key connections and checking system health
 */

import type { ConnectionTestResult, HealthCheckResult } from '@/types/apiKeys';
import * as chromeStorage from '@/data/storage/chrome';
import { PROVIDER_ENDPOINTS, PERFORMANCE_THRESHOLDS } from './constants';
import { getDatabase } from './database';
import type { ServiceState } from './types';
import { requireInitialized } from './utils';
import { getAPIKey } from './operations';

/**
 * Test API key connection to provider
 */
export async function testKeyConnection(
  state: ServiceState,
  id: string
): Promise<ConnectionTestResult> {
  requireInitialized(state);
  const enc = state.encryptionService!;

  try {
    const key = await getAPIKey(state, id);
    if (!key) {
      throw new Error('API key not found');
    }

    // Decrypt the key for testing
    const decryptedKey = await enc.decryptData(key.encryptedData);

    const endpoint = PROVIDER_ENDPOINTS[key.metadata.provider];
    if (!endpoint) {
      return {
        success: false,
        responseTime: 0,
        error: 'Connection testing not supported for this provider',
      };
    }

    const startTime = Date.now();

    try {
      const response = await fetch(endpoint, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${decryptedKey}`,
          'Content-Type': 'application/json',
        },
        signal: AbortSignal.timeout(PERFORMANCE_THRESHOLDS.CONNECTION_TIMEOUT_MS),
      });

      const responseTime = Math.max(1, Date.now() - startTime);

      if (response.ok) {
        return {
          success: true,
          responseTime,
          metadata: {
            status: response.status,
            statusText: response.statusText,
          },
        };
      } else {
        return {
          success: false,
          responseTime,
          error: `${response.status} ${response.statusText}`,
        };
      }
    } catch (fetchError) {
      const responseTime = Math.max(1, Date.now() - startTime);
      return {
        success: false,
        responseTime,
        error: fetchError instanceof Error ? fetchError.message : 'Network error',
      };
    }
  } catch (error) {
    return {
      success: false,
      responseTime: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

/**
 * Get system health status
 */
export async function getHealthStatus(state: ServiceState): Promise<HealthCheckResult> {
  const checks: Array<{ name: string; status: 'pass' | 'fail' | 'warn'; message?: string }> = [];
  const enc = state.encryptionService;
  const dbInstance = getDatabase();

  // Check encryption service
  checks.push({
    name: 'encryption_service',
    status: enc?.isInitialized ? 'pass' : 'fail',
    message: enc?.isInitialized
      ? 'Encryption service operational'
      : 'Encryption service not initialized',
  });

  // Check session status
  checks.push({
    name: 'session_status',
    status: enc?.isSessionActive ? 'pass' : 'fail',
    message: enc?.isSessionActive ? 'Session active' : 'Session expired',
  });

  // Check database connectivity
  try {
    if (dbInstance) {
      await dbInstance.openDatabase();
    }
    checks.push({
      name: 'database_connectivity',
      status: 'pass',
      message: 'Database accessible',
    });
  } catch {
    checks.push({
      name: 'database_connectivity',
      status: 'fail',
      message: 'Database connection failed',
    });
  }

  // Check Chrome storage
  try {
    await chromeStorage.get('health_check');
    checks.push({
      name: 'chrome_storage',
      status: 'pass',
      message: 'Chrome storage accessible',
    });
  } catch {
    checks.push({
      name: 'chrome_storage',
      status: 'fail',
      message: 'Chrome storage access failed',
    });
  }

  const healthy = checks.every(check => check.status === 'pass');

  return {
    healthy,
    checks,
  };
}
