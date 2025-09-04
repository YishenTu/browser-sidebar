import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@store/settings';
import {
  addOrUpdateOpenAICompatProvider,
  getCompatProviderById,
  listOpenAICompatProviders,
  clearAllOpenAICompatProviders,
} from '@/data/storage/keys/compat';
import { getPresetById } from '@/config/models';
import '../../styles/3-components/settings.css';
import {
  validateOpenAIKey,
  validateGeminiKey,
  validateOpenRouterKey,
  validateCompatProvider,
} from '@services/engine';

export function Settings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [openaiValid, setOpenaiValid] = useState<boolean | null>(null);
  const [geminiValid, setGeminiValid] = useState<boolean | null>(null);
  const [openrouterValid, setOpenrouterValid] = useState<boolean | null>(null);
  const [openaiVerifying, setOpenaiVerifying] = useState(false);
  const [geminiVerifying, setGeminiVerifying] = useState(false);
  const [openrouterVerifying, setOpenrouterVerifying] = useState(false);
  const [openaiMasked, setOpenaiMasked] = useState(true);
  const [geminiMasked, setGeminiMasked] = useState(true);
  const [openrouterMasked, setOpenrouterMasked] = useState(true);

  // OpenAI-compatible provider states
  const [selectedCompatProvider, setSelectedCompatProvider] = useState<string>('deepseek');
  const [compatApiKey, setCompatApiKey] = useState('');
  const [compatValid, setCompatValid] = useState<boolean | null>(null);
  const [compatVerifying, setCompatVerifying] = useState(false);
  const [compatMasked, setCompatMasked] = useState(true);
  const [savedCompatProviders, setSavedCompatProviders] = useState<string[]>([]);

  // Load existing API keys on mount
  useEffect(() => {
    const settings = useSettingsStore.getState();
    const apiKeys = settings.settings.apiKeys;

    if (apiKeys?.openai) {
      setOpenaiKey(apiKeys.openai);
      setOpenaiValid(true); // Mark as valid if already saved
    }

    if (apiKeys?.google) {
      setGeminiKey(apiKeys.google);
      setGeminiValid(true); // Mark as valid if already saved
    }

    if (apiKeys?.openrouter) {
      setOpenrouterKey(apiKeys.openrouter);
      setOpenrouterValid(true); // Mark as valid if already saved
    }

    // Load saved compat providers
    loadCompatProviders();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loadCompatProviders = async () => {
    const providers = await listOpenAICompatProviders();
    setSavedCompatProviders(providers.map(p => p.id));

    // Load the currently selected provider's key if it exists
    if (selectedCompatProvider) {
      const provider = await getCompatProviderById(selectedCompatProvider);
      if (provider) {
        setCompatApiKey(provider.apiKey);
        setCompatValid(true);
      }
    }
  };

  const handleVerifyAndSaveOpenAI = useCallback(async () => {
    if (!openaiKey.trim()) return;

    setOpenaiVerifying(true);
    setOpenaiValid(null);

    try {
      // Validate via service (uses transport under the hood)
      const isValid = await validateOpenAIKey(openaiKey);
      setOpenaiValid(isValid);

      // If valid, save the key
      if (isValid) {
        const state = useSettingsStore.getState();
        const currentApiKeys = state.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, openai: openaiKey };
        await state.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      setOpenaiValid(false);
    } finally {
      setOpenaiVerifying(false);
    }
  }, [openaiKey]);

  const handleVerifyAndSaveGemini = useCallback(async () => {
    if (!geminiKey.trim()) return;

    setGeminiVerifying(true);
    setGeminiValid(null);

    try {
      // Validate via service
      const isValid = await validateGeminiKey(geminiKey);
      setGeminiValid(isValid);

      // If valid, save the key
      if (isValid) {
        const state = useSettingsStore.getState();
        const currentApiKeys = state.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, google: geminiKey };
        await state.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      setGeminiValid(false);
    } finally {
      setGeminiVerifying(false);
    }
  }, [geminiKey]);

  const handleVerifyAndSaveOpenRouter = useCallback(async () => {
    if (!openrouterKey.trim()) return;

    setOpenrouterVerifying(true);
    setOpenrouterValid(null);

    try {
      // Validate via service
      const isValid = await validateOpenRouterKey(openrouterKey);
      setOpenrouterValid(isValid);

      // If valid, save the key
      if (isValid) {
        const state = useSettingsStore.getState();
        const currentApiKeys = state.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, openrouter: openrouterKey };
        await state.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      setOpenrouterValid(false);
    } finally {
      setOpenrouterVerifying(false);
    }
  }, [openrouterKey]);

  // Handle compat provider selection change
  const handleCompatProviderChange = useCallback(async (providerId: string) => {
    setSelectedCompatProvider(providerId);
    setCompatValid(null);

    // Load the API key for the selected provider if it exists
    const provider = await getCompatProviderById(providerId);
    if (provider) {
      setCompatApiKey(provider.apiKey);
      setCompatValid(true);
    } else {
      setCompatApiKey('');
      setCompatValid(null);
    }
  }, []);

  // Verify and save compat provider
  const handleVerifyAndSaveCompat = useCallback(async () => {
    if (!compatApiKey.trim()) return;

    setCompatVerifying(true);
    setCompatValid(null);

    try {
      // Get the base URL from the preset configuration
      const preset = getPresetById(selectedCompatProvider);
      if (!preset) {
        setCompatValid(false);
        setCompatVerifying(false);
        return;
      }

      const baseURL = preset.baseURL;

      // Validate via service (handles proxying)
      const ok = await validateCompatProvider(baseURL, compatApiKey);

      if (ok) {
        setCompatValid(true);

        // Save the provider
        await addOrUpdateOpenAICompatProvider({
          id: selectedCompatProvider,
          apiKey: compatApiKey,
          baseURL: baseURL,
        });

        // Update saved providers list
        if (!savedCompatProviders.includes(selectedCompatProvider)) {
          setSavedCompatProviders([...savedCompatProviders, selectedCompatProvider]);
        }

        // Refresh available models
        await useSettingsStore.getState().refreshAvailableModelsWithCompat();

        // Trigger the same update mechanism as standard providers to force ModelSelector reload
        const state = useSettingsStore.getState();
        const currentApiKeys = state.settings.apiKeys || {};
        // Re-set the same API keys to trigger a store update (same as standard providers do)
        await state.updateAPIKeyReferences(currentApiKeys);
      } else {
        setCompatValid(false);
      }
    } catch (error) {
      setCompatValid(false);
    } finally {
      setCompatVerifying(false);
    }
  }, [compatApiKey, selectedCompatProvider, savedCompatProviders]);

  const handleResetAll = useCallback(async () => {
    if (confirm('Are you sure you want to remove all saved API keys?')) {
      // Clear the input fields for standard providers
      setOpenaiKey('');
      setGeminiKey('');
      setOpenrouterKey('');
      setOpenaiValid(null);
      setGeminiValid(null);
      setOpenrouterValid(null);

      // Clear the input fields for compat providers
      setCompatApiKey('');
      setCompatValid(null);
      setSavedCompatProviders([]);

      // Reset standard provider settings to defaults
      const resetToDefaults = useSettingsStore.getState().resetToDefaults;
      await resetToDefaults();

      // Clear all OpenAI-compatible providers
      await clearAllOpenAICompatProviders();

      // Refresh available models after clearing
      await useSettingsStore.getState().refreshAvailableModelsWithCompat();
    }
  }, []);

  // Function to display masked value with fixed length
  const getMaskedValue = (value: string, masked: boolean) => {
    if (!value) return '';
    if (!masked) return value;
    // Always show 20 asterisks when masked, regardless of actual length
    return '••••••••••••••••••••';
  };

  return (
    <div className="settings-container">
      <h2 className="settings-title">API Configuration</h2>

      {/* OpenAI API Key */}
      <div className="settings-section">
        <label className="settings-label">OpenAI API Key</label>
        <div className="settings-input-group">
          <div className="settings-input-wrapper">
            <input
              type="text"
              value={getMaskedValue(openaiKey, openaiMasked)}
              onChange={e => {
                if (!openaiMasked) {
                  setOpenaiKey(e.target.value);
                  setOpenaiValid(null);
                }
              }}
              onFocus={() => setOpenaiMasked(false)}
              onBlur={() => setOpenaiMasked(true)}
              placeholder="sk-..."
              className={`settings-input ${openaiMasked && openaiKey ? 'settings-input--masked' : ''}`}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveOpenAI}
            disabled={!openaiKey.trim() || openaiVerifying}
            className="settings-button"
          >
            {openaiVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {openaiVerifying && (
          <p className="settings-status settings-status--verifying">Verifying API key...</p>
        )}
        {!openaiVerifying && openaiValid === true && (
          <p className="settings-status settings-status--valid">✓ API key is valid and saved</p>
        )}
        {!openaiVerifying && openaiValid === false && (
          <p className="settings-status settings-status--invalid">✗ Invalid API key</p>
        )}
      </div>

      {/* Gemini API Key */}
      <div className="settings-section settings-section--gemini">
        <label className="settings-label">Google Gemini API Key</label>
        <div className="settings-input-group">
          <div className="settings-input-wrapper">
            <input
              type="text"
              value={getMaskedValue(geminiKey, geminiMasked)}
              onChange={e => {
                if (!geminiMasked) {
                  setGeminiKey(e.target.value);
                  setGeminiValid(null);
                }
              }}
              onFocus={() => setGeminiMasked(false)}
              onBlur={() => setGeminiMasked(true)}
              placeholder="AIza..."
              className={`settings-input ${geminiMasked && geminiKey ? 'settings-input--masked' : ''}`}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveGemini}
            disabled={!geminiKey.trim() || geminiVerifying}
            className="settings-button"
          >
            {geminiVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {geminiVerifying && (
          <p className="settings-status settings-status--verifying">Verifying API key...</p>
        )}
        {!geminiVerifying && geminiValid === true && (
          <p className="settings-status settings-status--valid">✓ API key is valid and saved</p>
        )}
        {!geminiVerifying && geminiValid === false && (
          <p className="settings-status settings-status--invalid">✗ Invalid API key</p>
        )}
      </div>

      {/* OpenRouter API Key */}
      <div className="settings-section settings-section--openrouter">
        <label className="settings-label">OpenRouter API Key</label>
        <div className="settings-input-group">
          <div className="settings-input-wrapper">
            <input
              type="text"
              value={getMaskedValue(openrouterKey, openrouterMasked)}
              onChange={e => {
                if (!openrouterMasked) {
                  setOpenrouterKey(e.target.value);
                  setOpenrouterValid(null);
                }
              }}
              onFocus={() => setOpenrouterMasked(false)}
              onBlur={() => setOpenrouterMasked(true)}
              placeholder="sk-or-..."
              className={`settings-input ${openrouterMasked && openrouterKey ? 'settings-input--masked' : ''}`}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveOpenRouter}
            disabled={!openrouterKey.trim() || openrouterVerifying}
            className="settings-button"
          >
            {openrouterVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {openrouterVerifying && (
          <p className="settings-status settings-status--verifying">Verifying API key...</p>
        )}
        {!openrouterVerifying && openrouterValid === true && (
          <p className="settings-status settings-status--valid">✓ API key is valid and saved</p>
        )}
        {!openrouterVerifying && openrouterValid === false && (
          <p className="settings-status settings-status--invalid">✗ Invalid API key</p>
        )}
      </div>

      {/* OpenAI-Compatible Providers */}
      <div className="settings-section settings-section--compat">
        <label className="settings-label">OpenAI-Compatible Provider</label>

        {/* Provider Selector */}
        <div className="settings-input-group" style={{ marginBottom: '10px' }}>
          <select
            value={selectedCompatProvider}
            onChange={e => handleCompatProviderChange(e.target.value)}
            className="settings-input"
            style={{ width: '100%' }}
          >
            <option value="deepseek">DeepSeek</option>
            <option value="qwen">Qwen</option>
            <option value="zhipu">Zhipu</option>
            <option value="kimi">Kimi</option>
          </select>
        </div>

        {/* API Key Input */}
        <div className="settings-input-group">
          <div className="settings-input-wrapper">
            <input
              type="text"
              value={getMaskedValue(compatApiKey, compatMasked)}
              onChange={e => {
                if (!compatMasked) {
                  setCompatApiKey(e.target.value);
                  setCompatValid(null);
                }
              }}
              onFocus={() => setCompatMasked(false)}
              onBlur={() => setCompatMasked(true)}
              placeholder="Enter API key..."
              className={`settings-input ${compatMasked && compatApiKey ? 'settings-input--masked' : ''}`}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveCompat}
            disabled={!compatApiKey.trim() || compatVerifying}
            className="settings-button"
          >
            {compatVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {compatVerifying && (
          <p className="settings-status settings-status--verifying">Verifying API key...</p>
        )}
        {!compatVerifying && compatValid === true && (
          <p className="settings-status settings-status--valid">✓ API key is valid and saved</p>
        )}
        {!compatVerifying && compatValid === false && (
          <p className="settings-status settings-status--invalid">✗ Invalid API key</p>
        )}
      </div>

      {/* Reset Button */}
      <div className="settings-actions">
        <button onClick={handleResetAll} className="settings-button">
          Reset All Keys
        </button>
      </div>
    </div>
  );
}

export default Settings;
