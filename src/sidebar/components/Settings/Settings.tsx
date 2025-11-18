import { useState, useCallback, useEffect, useRef } from 'react';
import { useSettingsStore } from '@store/settings';
import type { DomainExtractionRuleSetting } from '@/types/settings';
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
  validateGrokKey,
  validateCompatProvider,
} from '@services/engine';

export function Settings() {
  const [openaiKey, setOpenaiKey] = useState('');
  const [geminiKey, setGeminiKey] = useState('');
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [grokKey, setGrokKey] = useState('');
  const [openaiValid, setOpenaiValid] = useState<boolean | null>(null);
  const [geminiValid, setGeminiValid] = useState<boolean | null>(null);
  const [openrouterValid, setOpenrouterValid] = useState<boolean | null>(null);
  const [grokValid, setGrokValid] = useState<boolean | null>(null);
  const [openaiVerifying, setOpenaiVerifying] = useState(false);
  const [geminiVerifying, setGeminiVerifying] = useState(false);
  const [openrouterVerifying, setOpenrouterVerifying] = useState(false);
  const [grokVerifying, setGrokVerifying] = useState(false);
  const [openaiMasked, setOpenaiMasked] = useState(true);
  const [geminiMasked, setGeminiMasked] = useState(true);
  const [openrouterMasked, setOpenrouterMasked] = useState(true);
  const [grokMasked, setGrokMasked] = useState(true);

  // Debug mode state
  const [debugMode, setDebugMode] = useState(false);

  // Auto-scroll state
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);

  const updateUIPreferences = useSettingsStore(state => state.updateUIPreferences);

  // OpenAI-compatible provider states
  const [selectedCompatProvider, setSelectedCompatProvider] = useState<string>('deepseek');
  const [compatApiKey, setCompatApiKey] = useState('');
  const [compatValid, setCompatValid] = useState<boolean | null>(null);
  const [compatVerifying, setCompatVerifying] = useState(false);
  const [compatMasked, setCompatMasked] = useState(true);
  const [savedCompatProviders, setSavedCompatProviders] = useState<string[]>([]);

  // Extraction rules state (domain → default mode)
  const [domainRules, setDomainRules] = useState<DomainExtractionRuleSetting[]>([]);
  const updateExtractionPreferences = useSettingsStore(state => state.updateExtractionPreferences);
  const [rulesLoaded, setRulesLoaded] = useState(false);

  // Screenshot hotkey state
  const [screenshotHotkey, setScreenshotHotkey] = useState<{
    enabled: boolean;
    modifiers: string[];
    key: string;
  }>({
    enabled: true,
    modifiers: [],
    key: '',
  });
  const [recordingHotkey, setRecordingHotkey] = useState(false);
  const recordingHotkeyRef = useRef(false);
  const [hotkeyDisplay, setHotkeyDisplay] = useState('');

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

    if (apiKeys?.grok) {
      setGrokKey(apiKeys.grok);
      setGrokValid(true); // Mark as valid if already saved
    }

    // Load debug mode setting
    setDebugMode(settings.settings.ui?.debugMode || false);

    // Load auto-scroll setting
    setAutoScrollEnabled(settings.settings.ui?.autoScrollEnabled ?? true);

    // Load screenshot hotkey setting
    if (settings.settings.ui?.screenshotHotkey) {
      setScreenshotHotkey(settings.settings.ui.screenshotHotkey);
      updateHotkeyDisplay(settings.settings.ui.screenshotHotkey);
    }

    // Load saved compat providers
    loadCompatProviders();

    // Load extraction rules
    const rules = settings.settings.extraction?.domainRules || [];
    setDomainRules(rules);
    setRulesLoaded(true);
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

  const handleVerifyAndSaveGrok = useCallback(async () => {
    if (!grokKey.trim()) return;

    setGrokVerifying(true);
    setGrokValid(null);

    try {
      // Validate via service
      const isValid = await validateGrokKey(grokKey);
      setGrokValid(isValid);

      // If valid, save the key
      if (isValid) {
        const state = useSettingsStore.getState();
        const currentApiKeys = state.settings.apiKeys || {};
        const updatedApiKeys = { ...currentApiKeys, grok: grokKey };
        await state.updateAPIKeyReferences(updatedApiKeys);
      }
    } catch (error) {
      setGrokValid(false);
    } finally {
      setGrokVerifying(false);
    }
  }, [grokKey]);

  // Extraction rules handlers
  const handleAddRule = () => {
    setDomainRules(prev => [...prev, { domain: '', mode: 'readability' }]);
  };

  const handleRuleChange = (index: number, field: 'domain' | 'mode', value: string) => {
    setDomainRules(prev =>
      prev.map((r, i) =>
        i === index
          ? {
              ...r,
              [field]: field === 'mode' ? (value as DomainExtractionRuleSetting['mode']) : value,
            }
          : r
      )
    );
  };

  const handleRemoveRule = (index: number) => {
    setDomainRules(prev => prev.filter((_, i) => i !== index));
  };

  // Update hotkey display text
  const updateHotkeyDisplay = useCallback((hotkey: typeof screenshotHotkey) => {
    if (!hotkey.enabled) {
      setHotkeyDisplay('Disabled');
      return;
    }

    if (!hotkey.key) {
      setHotkeyDisplay('');
      return;
    }

    const parts = [];
    // Detect if we're on macOS
    const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;

    if (hotkey.modifiers.includes('ctrl')) parts.push('Ctrl');
    if (hotkey.modifiers.includes('alt')) parts.push(isMac ? 'Option' : 'Alt');
    if (hotkey.modifiers.includes('shift')) parts.push('Shift');
    if (hotkey.modifiers.includes('meta')) parts.push(isMac ? 'Cmd' : 'Win');
    parts.push(hotkey.key.toUpperCase());

    setHotkeyDisplay(parts.join(' + '));
  }, []);

  // Handle hotkey recording
  const handleStartRecording = () => {
    setRecordingHotkey(true);
    recordingHotkeyRef.current = true;
    setHotkeyDisplay('Press your hotkey combination...');
    // Blur any focused element to ensure keyboard events go to document
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  };

  // Handle hotkey toggle
  const handleToggleHotkey = async () => {
    const newHotkey = {
      ...screenshotHotkey,
      enabled: !screenshotHotkey.enabled,
    };

    setScreenshotHotkey(newHotkey);
    updateHotkeyDisplay(newHotkey);

    // Save to settings
    const settings = useSettingsStore.getState();
    const currentUI = settings.settings.ui || {};
    await updateUIPreferences({
      ...currentUI,
      screenshotHotkey: newHotkey,
    });
  };

  // Listen for hotkey recording
  useEffect(() => {
    if (!recordingHotkey) return;

    const handleHotkeyRecord = (e: KeyboardEvent) => {
      // Check ref instead of state to avoid stale closures
      if (!recordingHotkeyRef.current) return;

      e.preventDefault();
      e.stopPropagation();

      // Allow ESC to cancel recording
      if (e.key === 'Escape') {
        setRecordingHotkey(false);
        recordingHotkeyRef.current = false;
        updateHotkeyDisplay(screenshotHotkey);
        return;
      }

      // Ignore modifier-only keypresses
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(e.key)) {
        return;
      }

      const modifiers: string[] = [];
      if (e.ctrlKey) modifiers.push('ctrl');
      if (e.altKey) modifiers.push('alt');
      if (e.shiftKey) modifiers.push('shift');
      if (e.metaKey) modifiers.push('meta');

      // Use e.code for digit keys to avoid character variations
      let key = e.key;

      // Handle digit keys using event.code for consistency
      if (e.code.startsWith('Digit')) {
        key = e.code.replace('Digit', '');
      } else if (e.code.startsWith('Numpad')) {
        key = e.code.replace('Numpad', '');
      }

      // Handle special cases where the key might be a special character
      // but we want to store the actual key code
      if (e.code === 'Digit2' && (e.key === '€' || e.key === '@' || e.key === '™')) {
        key = '2';
      }

      // Handle function keys
      if (e.code.startsWith('F') && e.code.match(/^F([1-9]|1[0-2])$/)) {
        key = e.code; // F1-F12
      }

      const newHotkey = {
        enabled: true,
        modifiers,
        key,
      };

      setScreenshotHotkey(newHotkey);
      updateHotkeyDisplay(newHotkey);
      setRecordingHotkey(false);
      recordingHotkeyRef.current = false;

      // Save to settings
      const settings = useSettingsStore.getState();
      const currentUI = settings.settings.ui || {};
      updateUIPreferences({
        ...currentUI,
        screenshotHotkey: newHotkey,
      });
    };

    document.addEventListener('keydown', handleHotkeyRecord);
    return () => {
      document.removeEventListener('keydown', handleHotkeyRecord);
    };
  }, [recordingHotkey, screenshotHotkey, updateHotkeyDisplay, updateUIPreferences]);

  const handleDebugToggle = async () => {
    const newDebugMode = !debugMode;
    setDebugMode(newDebugMode);

    // Update the UI preferences in the store
    const settings = useSettingsStore.getState();
    const currentUI = settings.settings.ui || {};
    await updateUIPreferences({
      ...currentUI,
      debugMode: newDebugMode,
    });
  };

  const handleAutoScrollToggle = async () => {
    const newAutoScrollEnabled = !autoScrollEnabled;
    setAutoScrollEnabled(newAutoScrollEnabled);

    // Update the UI preferences in the store
    const settings = useSettingsStore.getState();
    const currentUI = settings.settings.ui || {};
    await updateUIPreferences({
      ...currentUI,
      autoScrollEnabled: newAutoScrollEnabled,
    });
  };

  // Auto-save rules on change (debounced) after initial load
  useEffect(() => {
    if (!rulesLoaded) return;
    const allowed = ['defuddle', 'readability', 'raw'] as const;
    const t = setTimeout(() => {
      const cleaned: DomainExtractionRuleSetting[] = domainRules
        .map(r => ({ domain: r.domain.trim().toLowerCase(), mode: r.mode }))
        .filter(r => r.domain && (allowed as readonly string[]).includes(r.mode));
      updateExtractionPreferences({ domainRules: cleaned });
    }, 300);
    return () => clearTimeout(t);
  }, [domainRules, rulesLoaded, updateExtractionPreferences]);

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
      setGrokKey('');
      setOpenaiValid(null);
      setGeminiValid(null);
      setOpenrouterValid(null);
      setGrokValid(null);

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

      {/* Grok API Key */}
      <div className="settings-section settings-section--grok">
        <label className="settings-label">Grok (xAI) API Key</label>
        <div className="settings-input-group">
          <div className="settings-input-wrapper">
            <input
              type="text"
              value={getMaskedValue(grokKey, grokMasked)}
              onChange={e => {
                if (!grokMasked) {
                  setGrokKey(e.target.value);
                  setGrokValid(null);
                }
              }}
              onFocus={() => setGrokMasked(false)}
              onBlur={() => setGrokMasked(true)}
              placeholder="xai-..."
              className={`settings-input ${grokMasked && grokKey ? 'settings-input--masked' : ''}`}
            />
          </div>
          <button
            onClick={handleVerifyAndSaveGrok}
            disabled={!grokKey.trim() || grokVerifying}
            className="settings-button"
          >
            {grokVerifying ? 'Verifying...' : 'Verify & Save'}
          </button>
        </div>
        {grokVerifying && (
          <p className="settings-status settings-status--verifying">Verifying API key...</p>
        )}
        {!grokVerifying && grokValid === true && (
          <p className="settings-status settings-status--valid">✓ API key is valid and saved</p>
        )}
        {!grokVerifying && grokValid === false && (
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
      <div className="settings-actions settings-wide-wrap">
        <button onClick={handleResetAll} className="settings-button settings-button--wide">
          Reset All Keys
        </button>
      </div>

      {/* Extraction Defaults */}
      <div className="settings-section settings-section--extraction">
        <h2 className="settings-title">Extraction Defaults by Domain</h2>
        <div className="settings-domain-rules">
          {domainRules.map((rule, idx) => (
            <div key={idx} className="settings-domain-rule-row">
              <input
                type="text"
                value={rule.domain}
                onChange={e => handleRuleChange(idx, 'domain', e.target.value)}
                placeholder="example.com"
                className="settings-input settings-domain-input"
              />
              <select
                value={rule.mode}
                onChange={e => handleRuleChange(idx, 'mode', e.target.value)}
                className="settings-input settings-domain-mode-select"
              >
                <option value="readability">Readability</option>
                <option value="defuddle">Defuddle</option>
                <option value="raw">Raw</option>
              </select>
              <button
                onClick={() => handleRemoveRule(idx)}
                className="settings-button settings-domain-remove-button"
                aria-label="Remove rule"
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
          <div className="settings-domain-actions settings-wide-wrap">
            <button onClick={handleAddRule} className="settings-button settings-button--wide">
              Add Rule
            </button>
          </div>
          <p className="settings-hint">
            Rules match the base domain and all subdomains. First match wins.
          </p>
        </div>
      </div>

      {/* Screenshot Hotkey Settings */}
      <div className="settings-section settings-section--hotkey">
        <h2 className="settings-title">Full Page Capture Hotkey</h2>
        <div className="settings-input-group">
          <label
            className="settings-label"
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <input
              type="checkbox"
              checked={screenshotHotkey.enabled}
              onChange={handleToggleHotkey}
              className="settings-checkbox"
            />
            <span>Enable Screenshot Hotkey</span>
          </label>
        </div>

        {screenshotHotkey.enabled && (
          <div className="settings-input-group" style={{ marginTop: '10px' }}>
            <div className="settings-input-wrapper" style={{ flex: 1 }}>
              <div
                className={`settings-input settings-hotkey-input ${recordingHotkey ? 'recording' : ''}`}
                onClick={!recordingHotkey ? handleStartRecording : undefined}
                tabIndex={0}
                role="button"
                aria-label="Click to set hotkey"
                style={{
                  cursor: 'pointer',
                  backgroundColor: recordingHotkey ? '#f0f0f0' : '',
                  userSelect: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <span>{hotkeyDisplay}</span>
              </div>
            </div>
            {screenshotHotkey.enabled && !recordingHotkey && screenshotHotkey.key && (
              <button
                onClick={() => {
                  const emptyHotkey = {
                    enabled: true,
                    modifiers: [],
                    key: '',
                  };
                  setScreenshotHotkey(emptyHotkey);
                  setHotkeyDisplay('');

                  // Save to settings
                  const settings = useSettingsStore.getState();
                  const currentUI = settings.settings.ui || {};
                  updateUIPreferences({
                    ...currentUI,
                    screenshotHotkey: emptyHotkey,
                  });
                }}
                className="settings-button"
                style={{ marginLeft: '8px' }}
              >
                Clear
              </button>
            )}
          </div>
        )}

        {screenshotHotkey.enabled && (
          <p className="settings-hint">
            {recordingHotkey
              ? 'Press any key combination (ESC to cancel)'
              : 'Click the field above to record a new hotkey combination.'}
          </p>
        )}
      </div>

      {/* Auto-scroll Settings */}
      <div className="settings-section">
        <h2 className="settings-title">Chat Behavior</h2>
        <div className="settings-input-group">
          <label
            className="settings-label"
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <input
              type="checkbox"
              checked={autoScrollEnabled}
              onChange={handleAutoScrollToggle}
              className="settings-checkbox"
            />
            <span>Auto-scroll during streaming</span>
          </label>
        </div>
        <p className="settings-hint" style={{ marginTop: '8px' }}>
          When enabled, automatically scrolls to show new content as the AI responds.
        </p>
      </div>

      {/* Debug Settings */}
      <div className="settings-section settings-section--debug">
        <h2 className="settings-title">Developer Options</h2>
        <div className="settings-input-group">
          <label
            className="settings-label"
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <input
              type="checkbox"
              checked={debugMode}
              onChange={handleDebugToggle}
              className="settings-checkbox"
            />
            <span>Enable Debug Mode</span>
          </label>
        </div>
        <p className="settings-hint" style={{ marginTop: '8px' }}>
          When enabled, outputs detailed console logs for debugging purposes.
        </p>
      </div>
    </div>
  );
}

export default Settings;
