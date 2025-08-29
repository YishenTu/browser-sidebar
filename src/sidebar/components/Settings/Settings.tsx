import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@store/settings';
import '../../styles/3-components/settings.css';

export function Settings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openaiValid, setOpenaiValid] = useState<boolean | null>(null);
  const [geminiValid, setGeminiValid] = useState<boolean | null>(null);
  const [openaiVerifying, setOpenaiVerifying] = useState(false);
  const [geminiVerifying, setGeminiVerifying] = useState(false);
  const [openaiMasked, setOpenaiMasked] = useState(true);
  const [geminiMasked, setGeminiMasked] = useState(true);

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
  }, []);

  const handleVerifyAndSaveOpenAI = useCallback(async () => {
    if (!openaiKey.trim()) return;

    setOpenaiVerifying(true);
    setOpenaiValid(null);

    try {
      // Test the OpenAI API key with a minimal request
      const response = await fetch('https://api.openai.com/v1/models', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${openaiKey}`,
        },
      });

      const isValid = response.ok;
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
      // Test the Gemini API key with a minimal request
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${geminiKey}`,
        {
          method: 'GET',
        }
      );

      const isValid = response.ok;
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

  const handleResetAll = useCallback(async () => {
    if (confirm('Are you sure you want to remove all saved API keys?')) {
      // Clear the input fields
      setOpenaiKey('');
      setGeminiKey('');
      setOpenaiValid(null);
      setGeminiValid(null);

      // Reset settings to defaults
      const resetToDefaults = useSettingsStore.getState().resetToDefaults;
      await resetToDefaults();
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
