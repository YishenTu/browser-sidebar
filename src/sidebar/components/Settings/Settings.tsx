import { useState, useCallback, useEffect } from 'react';
import { useSettingsStore } from '@store/settings';

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
        const settings = useSettingsStore.getState();
        const currentApiKeys = settings.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, openai: openaiKey };
        await settings.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      console.error('OpenAI verification error:', error);
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
        const settings = useSettingsStore.getState();
        const currentApiKeys = settings.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, google: geminiKey };
        await settings.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      console.error('Gemini verification error:', error);
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
    <div
      style={{
        padding: '20px',
        maxWidth: '100%',
      }}
    >
      <h2
        style={{
          fontSize: '18px',
          fontWeight: '600',
          marginBottom: '24px',
          color: '#e5e7eb',
        }}
      >
        API Configuration
      </h2>

      {/* OpenAI API Key */}
      <div style={{ marginBottom: '20px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#9ca3af',
          }}
        >
          OpenAI API Key
        </label>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              flex: '1',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
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
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(75, 85, 99, 0.3)',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#e5e7eb',
                outline: 'none',
                fontFamily: openaiMasked && openaiKey ? 'monospace' : 'inherit',
              }}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveOpenAI}
            disabled={!openaiKey.trim() || openaiVerifying}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(75, 85, 99, 0.3)',
              color: openaiVerifying || !openaiKey.trim() ? '#6b7280' : '#e5e7eb',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: openaiVerifying || !openaiKey.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {openaiVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {openaiVerifying && (
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>
            Verifying API key...
          </p>
        )}
        {!openaiVerifying && openaiValid === true && (
          <p style={{ color: '#34d399', fontSize: '12px', marginTop: '6px' }}>
            ✓ API key is valid and saved
          </p>
        )}
        {!openaiVerifying && openaiValid === false && (
          <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>✗ Invalid API key</p>
        )}
      </div>

      {/* Gemini API Key */}
      <div style={{ marginBottom: '24px' }}>
        <label
          style={{
            display: 'block',
            fontSize: '14px',
            fontWeight: '500',
            marginBottom: '8px',
            color: '#9ca3af',
          }}
        >
          Google Gemini API Key
        </label>
        <div
          style={{
            display: 'flex',
            gap: '8px',
            alignItems: 'stretch',
          }}
        >
          <div
            style={{
              flex: '1',
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
            }}
          >
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
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: 'rgba(31, 41, 55, 0.5)',
                border: '1px solid rgba(75, 85, 99, 0.3)',
                borderRadius: '6px',
                fontSize: '14px',
                color: '#e5e7eb',
                outline: 'none',
                fontFamily: geminiMasked && geminiKey ? 'monospace' : 'inherit',
              }}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveGemini}
            disabled={!geminiKey.trim() || geminiVerifying}
            style={{
              padding: '8px 16px',
              backgroundColor: 'rgba(75, 85, 99, 0.3)',
              color: geminiVerifying || !geminiKey.trim() ? '#6b7280' : '#e5e7eb',
              border: '1px solid rgba(75, 85, 99, 0.3)',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '500',
              cursor: geminiVerifying || !geminiKey.trim() ? 'not-allowed' : 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {geminiVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {geminiVerifying && (
          <p style={{ color: '#9ca3af', fontSize: '12px', marginTop: '6px' }}>
            Verifying API key...
          </p>
        )}
        {!geminiVerifying && geminiValid === true && (
          <p style={{ color: '#34d399', fontSize: '12px', marginTop: '6px' }}>
            ✓ API key is valid and saved
          </p>
        )}
        {!geminiVerifying && geminiValid === false && (
          <p style={{ color: '#f87171', fontSize: '12px', marginTop: '6px' }}>✗ Invalid API key</p>
        )}
      </div>

      {/* Reset Button */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          justifyContent: 'flex-start',
        }}
      >
        <button
          onClick={handleResetAll}
          style={{
            padding: '10px 24px',
            backgroundColor: 'rgba(75, 85, 99, 0.3)',
            color: '#e5e7eb',
            border: '1px solid rgba(75, 85, 99, 0.3)',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            cursor: 'pointer',
          }}
        >
          Reset All Keys
        </button>
      </div>
    </div>
  );
}

export default Settings;
