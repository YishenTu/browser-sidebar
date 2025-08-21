# Security Model

## Overview

The AI Browser Sidebar Extension implements a comprehensive security model focused on protecting user data, API keys, and maintaining privacy.

## Security Principles

1. **Local-First**: All data stays on user's device
2. **Zero-Trust**: Never trust external input
3. **Defense in Depth**: Multiple security layers
4. **Least Privilege**: Minimal permissions required
5. **Transparency**: Clear about data handling

## API Key Security

### Storage Encryption

```typescript
// AES-256-GCM Encryption
interface EncryptedStorage {
  algorithm: 'AES-GCM';
  keyLength: 256;
  ivLength: 12; // 96 bits
  tagLength: 16; // 128 bits
  saltLength: 32; // 256 bits
}
```

### Key Derivation

- **Algorithm**: PBKDF2
- **Iterations**: 100,000
- **Hash**: SHA-256
- **Salt**: Unique per key

### Implementation

```typescript
class KeyManager {
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  async encryptApiKey(apiKey: string, masterPassword: string): Promise<EncryptedData> {
    const salt = crypto.getRandomValues(new Uint8Array(32));
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await this.deriveKey(masterPassword, salt);

    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      new TextEncoder().encode(apiKey)
    );

    return { encrypted, salt, iv };
  }
}
```

## Content Security

### XSS Prevention

- Content sanitization before rendering
- CSP headers in extension pages
- No `eval()` or dynamic code execution
- React's built-in XSS protection

### Content Script Isolation

Content scripts in MV3 execute in an isolated world by default. For programmatic injection via `chrome.scripting.executeScript`, specify the world as needed.

```json
{
  "content_scripts": [
    {
      "matches": ["<all_urls>"],
      "js": ["src/tabext/index.ts"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ]
}
```

### Input Validation

```typescript
// Sanitize user input
function sanitizeInput(input: string): string {
  return DOMPurify.sanitize(input, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'code', 'pre'],
    ALLOWED_ATTR: [],
  });
}

// Validate API responses
function validateApiResponse(response: any): boolean {
  return (
    typeof response === 'object' &&
    typeof response.content === 'string' &&
    response.content.length < MAX_CONTENT_LENGTH
  );
}
```

## Data Privacy

### Storage Isolation

```
┌─────────────────────────────────┐
│     Browser Storage Layers       │
├─────────────────────────────────┤
│  Session Storage (temporary)     │
│  - Current conversation          │
│  - Tab context cache             │
├─────────────────────────────────┤
│  Chrome Storage (persistent)     │
│  - Settings (non-sensitive)      │
│  - Encrypted API keys            │
├─────────────────────────────────┤
│  IndexedDB (persistent)          │
│  - Conversation history          │
│  - Extracted content cache       │
└─────────────────────────────────┘
```

### Data Lifecycle

1. **Creation**: Data encrypted before storage
2. **Access**: Decryption only in memory
3. **Transmission**: HTTPS only to API providers
4. **Deletion**: Secure overwrite when deleted

### Sensitive Data Detection

```typescript
const SENSITIVE_PATTERNS = {
  SSN: /\b\d{3}-\d{2}-\d{4}\b/,
  CREDIT_CARD: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/,
  EMAIL: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/,
  PHONE: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/,
  API_KEY: /\b(sk|pk|api[_-]?key)[_-][A-Za-z0-9]{20,}\b/i,
};

function detectSensitiveData(text: string): SensitiveDataWarning[] {
  const warnings: SensitiveDataWarning[] = [];

  Object.entries(SENSITIVE_PATTERNS).forEach(([type, pattern]) => {
    if (pattern.test(text)) {
      warnings.push({
        type,
        message: `Potential ${type} detected`,
        severity: 'high',
      });
    }
  });

  return warnings;
}
```

## Permission Model

### Manifest Permissions

```json
{
  "permissions": [
    "storage", // Store settings and data
    "tabs", // Access tab information
    "activeTab", // Access current tab only
    "scripting" // Programmatic injection
  ],
  "host_permissions": [
    "<all_urls>" // Required for content extraction
  ],
  "optional_permissions": [
    "downloads", // Export conversations
    "clipboardWrite" // Copy to clipboard
  ]
}
```

### Runtime Permission Checks

```typescript
async function checkPermission(permission: string): Promise<boolean> {
  return chrome.permissions.contains({ permissions: [permission] });
}

async function requestPermission(permission: string): Promise<boolean> {
  try {
    return await chrome.permissions.request({ permissions: [permission] });
  } catch (error) {
    console.error('Permission request failed:', error);
    return false;
  }
}
```

## Network Security

### API Communication

- **Protocol**: HTTPS only
- **Headers**: Proper CORS handling
- **Timeouts**: 30 second default
- **Retry**: Exponential backoff

### Request Validation

```typescript
class SecureRequest {
  private validateUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'https:';
    } catch {
      return false;
    }
  }

  async fetch(url: string, options: RequestInit): Promise<Response> {
    if (!this.validateUrl(url)) {
      throw new Error('Only HTTPS URLs allowed');
    }

    const secureOptions: RequestInit = {
      ...options,
      credentials: 'omit', // Never send cookies
      redirect: 'error', // Don't follow redirects
      referrerPolicy: 'no-referrer',
    };

    return fetch(url, secureOptions);
  }
}
```

## Security Headers

### Content Security Policy

```typescript
const CSP = {
  'default-src': ["'self'"],
  'script-src': ["'self'"],
  'style-src': ["'self'", "'unsafe-inline'"], // For Tailwind
  'img-src': ["'self'", 'data:', 'https:'],
  'connect-src': [
    "'self'",
    'https://api.openai.com',
    'https://generativelanguage.googleapis.com',
    'https://openrouter.ai',
  ],
  'font-src': ["'self'"],
  'object-src': ["'none'"],
  'base-uri': ["'self'"],
  'form-action': ["'self'"],
  'frame-ancestors': ["'none'"],
  'upgrade-insecure-requests': [],
};
```

## Threat Model

### Potential Threats

1. **API Key Theft**: Mitigated by encryption
2. **XSS Attacks**: Prevented by CSP and sanitization
3. **Data Leakage**: Local-only storage
4. **MITM Attacks**: HTTPS enforcement
5. **Malicious Extensions**: Permission isolation

### Security Boundaries

```
┌─────────────────────────┐
│   Untrusted Zone        │
│   - Web pages           │
│   - External APIs       │
└───────────┬─────────────┘
            │ Sanitization
┌───────────▼─────────────┐
│   Semi-trusted Zone     │
│   - Content scripts     │
│   - API responses       │
└───────────┬─────────────┘
            │ Validation
┌───────────▼─────────────┐
│   Trusted Zone          │
│   - Background worker   │
│   - Extension UI        │
│   - Encrypted storage   │
└─────────────────────────┘
```

## Audit Logging

### Security Events

```typescript
enum SecurityEvent {
  API_KEY_ADDED = 'API_KEY_ADDED',
  API_KEY_ACCESSED = 'API_KEY_ACCESSED',
  SENSITIVE_DATA_DETECTED = 'SENSITIVE_DATA_DETECTED',
  PERMISSION_GRANTED = 'PERMISSION_GRANTED',
  PERMISSION_DENIED = 'PERMISSION_DENIED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
}

class SecurityLogger {
  log(event: SecurityEvent, details?: any): void {
    const entry = {
      timestamp: Date.now(),
      event,
      details: this.sanitizeDetails(details),
    };

    // Store in circular buffer (last 100 events)
    this.addToBuffer(entry);
  }

  private sanitizeDetails(details: any): any {
    // Remove sensitive information before logging
    const sanitized = { ...details };
    delete sanitized.apiKey;
    delete sanitized.password;
    return sanitized;
  }
}
```

## Compliance Considerations

### GDPR Compliance

- No personal data collection by default
- User control over data lifecycle
- Clear data deletion options
- Transparent privacy policy

### Security Best Practices

- Regular security updates
- Dependency vulnerability scanning
- Code review for security issues
- Penetration testing before release

---

_Security Model Version: 1.0_  
_Last Updated: 2025-08-19_
