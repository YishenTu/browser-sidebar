# AI Browser Sidebar Extension - STAGE 3: STORAGE & SECURITY

## Project Overview

Building a privacy-focused browser extension that enables AI-powered chat with web content using BYOK (Bring Your Own Key) model. The project follows a UI-first approach with Test-Driven Development (TDD) methodology.

Architecture: The extension uses ONLY a custom injected React sidebar (no popup, no Chrome sidepanel) for universal browser compatibility. The sidebar is resizable (300-800px width), draggable, and injected by the content script. Communication flow: Extension Icon Click → Background Service Worker → Content Script → Sidebar React App.

## Execution Guidelines for Sub-Agents

- **Follow TDD cycle**: Write tests first (RED) → Implement code (GREEN) → Refactor (REFACTOR)
- Each task is self-contained with clear test requirements and deliverables
- Tasks marked with 🔄 can be executed in parallel
- Tasks marked with ⚡ must be executed sequentially
- Tasks marked with 🧪 require test-first development
- Check prerequisites before starting any task
- Create interface contracts for components that will integrate
- Write TypeScript with strict mode enabled
- Use functional React components with hooks
- Implement proper error boundaries and handling

## TDD Strategy

- **Unit Tests**: For all utility functions and business logic (Vitest)
- **Component Tests**: For all React components (React Testing Library)
- **Integration Tests**: For message passing and API interactions
- **E2E Tests**: For critical user journeys (Playwright)

## Progress Tracking

- [x] Stage 1: Extension Infrastructure (15/15 tasks) ✅ COMPLETED
- [x] Stage 2: Chat Panel UI (24/24 tasks) ✅ COMPLETED
- [ ] Stage 3: Storage & Security (0/18 tasks)
- [ ] Stage 4: AI Provider System (0/22 tasks)
- [ ] Stage 5: Tab Content Extraction (0/21 tasks)

**Total Progress: 39/100 tasks**

---

## STAGE 3: STORAGE & SECURITY

Deliverable highlight: Secure storage layer with encrypted API key storage, conversation persistence, and sensitive data protection. Complete Chrome storage wrapper, IndexedDB implementation, AES-256-GCM encryption, and data cleanup utilities.

### Phase 3.1: Storage Foundation

**Synchronization Point: Storage layer must be ready before encryption**

🔄 **Parallelizable Tasks:**

- [ ] **Task 3.1.1a** - Storage Types 🧪
  - Prerequisites: Task 1.1.2a
  - Tests First:
    - Test type definitions compile
    - Test serialization works
  - Description: Define storage types
  - Deliverables:
    - `src/types/storage.ts`
    - Serialization utilities
  - Acceptance: Types cover all storage needs

- [ ] **Task 3.1.1b** - Chrome Storage Wrapper 🧪
  - Prerequisites: Task 3.1.1a, Task 1.2.3
  - Tests First:
    - Test get/set operations
    - Test error handling
    - Test migrations
  - Description: Wrap chrome.storage.local
  - Deliverables:
    - `src/storage/chromeStorage.ts`
    - `tests/storage/chromeStorage.test.ts`
  - Acceptance: Storage operations work

- [ ] **Task 3.1.1c** - Storage Migrations 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test migration detection
    - Test migration execution
    - Test rollback
  - Description: Create migration system
  - Deliverables:
    - `src/storage/migrations.ts`
    - `tests/storage/migrations.test.ts`
  - Acceptance: Migrations run correctly

- [ ] **Task 3.1.2a** - IndexedDB Schema 🧪
  - Prerequisites: Task 3.1.1a
  - Tests First:
    - Test database creation
    - Test schema validation
  - Description: Define IndexedDB schema
  - Deliverables:
    - `src/storage/schema.ts`
    - Database version management
  - Acceptance: Schema is comprehensive

- [ ] **Task 3.1.2b** - IndexedDB Wrapper 🧪
  - Prerequisites: Task 3.1.2a
  - Tests First:
    - Test CRUD operations
    - Test transactions
    - Test error recovery
  - Description: Create IndexedDB utilities
  - Deliverables:
    - `src/storage/indexedDB.ts`
    - `tests/storage/indexedDB.test.ts`
  - Acceptance: Database operations work

- [ ] **Task 3.1.2c** - Database Indexes 🧪
  - Prerequisites: Task 3.1.2b
  - Tests First:
    - Test index creation
    - Test query performance
  - Description: Optimize database queries
  - Deliverables:
    - Index definitions
    - Query optimizations
  - Acceptance: Queries are fast

### Phase 3.2: Security Implementation

**Synchronization Point: Encryption must work before key storage**

⚡ **Sequential Tasks:**

- [ ] **Task 3.2.1a** - Crypto Utilities 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test key generation
    - Test encryption/decryption
    - Test different data types
  - Description: Implement Web Crypto API wrapper
  - Deliverables:
    - `src/security/crypto.ts`
    - `tests/security/crypto.test.ts`
  - Acceptance: Encryption works correctly

- [ ] **Task 3.2.1b** - Key Derivation 🧪
  - Prerequisites: Task 3.2.1a
  - Tests First:
    - Test PBKDF2 derivation
    - Test salt generation
    - Test consistent keys
  - Description: Implement key derivation
  - Deliverables:
    - `src/security/keyDerivation.ts`
    - `tests/security/keyDerivation.test.ts`
  - Acceptance: Keys derive consistently

- [ ] **Task 3.2.1c** - Encryption Service 🧪
  - Prerequisites: Task 3.2.1b
  - Tests First:
    - Test service initialization
    - Test bulk operations
    - Test error handling
  - Description: Create encryption service
  - Deliverables:
    - `src/security/encryptionService.ts`
    - `tests/security/encryptionService.test.ts`
  - Acceptance: Service encrypts data

- [ ] **Task 3.2.2a** - API Key Types 🧪
  - Prerequisites: Task 3.2.1c
  - Tests First:
    - Test type definitions
    - Test validation rules
  - Description: Define API key types
  - Deliverables:
    - `src/types/apiKeys.ts`
    - Validation schemas
  - Acceptance: Types are complete

- [ ] **Task 3.2.2b** - API Key Storage 🧪
  - Prerequisites: Task 3.2.2a
  - Tests First:
    - Test encrypted storage
    - Test key retrieval
    - Test key deletion
  - Description: Implement secure key storage
  - Deliverables:
    - `src/storage/apiKeys.ts`
    - `tests/storage/apiKeys.test.ts`
  - Acceptance: Keys stored securely

- [ ] **Task 3.2.2c** - API Key Validation 🧪
  - Prerequisites: Task 3.2.2b
  - Tests First:
    - Test format validation
    - Test provider validation
  - Description: Validate API keys
  - Deliverables:
    - `src/utils/apiKeyValidation.ts`
    - `tests/utils/apiKeyValidation.test.ts`
  - Acceptance: Invalid keys rejected

### Phase 3.3: Data Management

**Synchronization Point: Complete storage system ready**

🔄 **Parallelizable Tasks:**

- [ ] **Task 3.3.1a** - Conversation Types 🧪
  - Prerequisites: Task 3.1.2b
  - Tests First:
    - Test type definitions
    - Test serialization
  - Description: Define conversation types
  - Deliverables:
    - `src/types/conversation.ts`
  - Acceptance: Types are comprehensive

- [ ] **Task 3.3.1b** - Conversation Storage 🧪
  - Prerequisites: Task 3.3.1a
  - Tests First:
    - Test save/load operations
    - Test search functionality
    - Test pagination
  - Description: Implement conversation persistence
  - Deliverables:
    - `src/storage/conversations.ts`
    - `tests/storage/conversations.test.ts`
  - Acceptance: Conversations persist

- [ ] **Task 3.3.2** - Cache Implementation 🧪
  - Prerequisites: Task 3.1.1b
  - Tests First:
    - Test TTL expiration
    - Test size limits
    - Test invalidation
  - Description: Create caching system
  - Deliverables:
    - `src/storage/cache.ts`
    - `tests/storage/cache.test.ts`
  - Acceptance: Cache expires correctly

- [ ] **Task 3.3.3** - Data Cleanup 🧪
  - Prerequisites: Task 3.3.1b, Task 3.3.2
  - Tests First:
    - Test complete cleanup
    - Test selective cleanup
  - Description: Implement data cleanup
  - Deliverables:
    - `src/storage/cleanup.ts`
    - `tests/storage/cleanup.test.ts`
  - Acceptance: Data clears completely

- [ ] **Task 3.3.4a** - Sensitive Pattern Detection 🧪
  - Prerequisites: Task 3.2.1c
  - Tests First:
    - Test SSN detection
    - Test credit card detection
    - Test email detection
  - Description: Create pattern matchers
  - Deliverables:
    - `src/security/patterns.ts`
    - `tests/security/patterns.test.ts`
  - Acceptance: Patterns detected

- [ ] **Task 3.3.4b** - Data Masking 🧪
  - Prerequisites: Task 3.3.4a
  - Tests First:
    - Test masking functions
    - Test unmask with permission
  - Description: Implement data masking
  - Deliverables:
    - `src/security/masking.ts`
    - `tests/security/masking.test.ts`
  - Acceptance: Data masked correctly

---

## Synchronization Points

### Critical Review Points:

1. **After Phase 3.1**: Storage layer and database ready
2. **After Phase 3.2**: Encryption and key storage secure
3. **After Phase 3.3**: Complete data management system tested

### Test Coverage Requirements:

- Unit Tests: > 90% coverage
- Component Tests: All storage components tested
- Integration Tests: All storage APIs tested
- Security Tests: Encryption and key management audited

## Risk Mitigation

### Testing Strategy:

1. **Security Tests First**: Write failing tests before encryption implementation
2. **Mock External Dependencies**: Mock Chrome APIs, IndexedDB
3. **Crypto Testing**: Test encryption/decryption round trips
4. **Storage Testing**: Test data persistence and retrieval
5. **Performance Testing**: Test with large datasets

### Potential Blockers:

1. **Chrome API Mocking**: Use chrome-mock library
2. **Crypto API Testing**: Use proper Web Crypto testing patterns
3. **IndexedDB Testing**: Use fake-indexeddb for testing
4. **Storage Migrations**: Test upgrade/downgrade scenarios
5. **Security Auditing**: Validate encryption implementations

## Completion Criteria

### Task Completion:

- [ ] All tests written and passing
- [ ] Code implementation complete
- [ ] Security audit passed
- [ ] Performance benchmarks met
- [ ] No linting errors

### Stage Completion:

- [ ] All 18 tasks marked complete
- [ ] Integration tests pass
- [ ] Test coverage > 90%
- [ ] Security audit complete
- [ ] Performance metrics met
- [ ] Data cleanup verified

---

_Task Blueprint Version: 2.0 (TDD Edition)_  
_Stage 3 Tasks: 18_  
_Test-First Tasks: 18 (100%)_  
_Parallelizable: 10 (56%)_  
_Sequential: 8 (44%)_  
_Estimated Parallel Execution Paths: 3_
