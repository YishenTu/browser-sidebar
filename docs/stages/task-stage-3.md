# Stage 3: Storage & Security

## Overview
**Goal:** Secure storage layer with API key encryption and conversation persistence.

**Duration:** 1.5 weeks | **Tasks:** 18 (10 parallel, 8 sequential)

**Prerequisites:** Stages 1-2 complete

**Deliverables:**
- Chrome storage wrapper with migrations
- IndexedDB for conversation storage  
- AES-256-GCM encryption for API keys
- Sensitive data detection and masking
- Cache management with TTL
- Data cleanup utilities
- Complete test coverage

---

## Phase 3.1: Storage Foundation (6 tasks)

### 🔄 Parallel Block A: Chrome Storage (3 tasks)

#### Task 3.1.1a - Storage Types 🧪
**Dependencies:** Stage 1 complete

**Deliverables:**
- `src/types/storage.ts` with StorageSchema interface
- Validation functions for data integrity
- Serialization utilities for complex types (Map, Set, Date)
- Default storage factory

**Key Tests:**
- Schema validation (valid/invalid data)
- Serialization/deserialization of complex types
- Circular reference handling

**Acceptance Criteria:**
- [ ] Complete type coverage for storage
- [ ] Serialization handles all complex types
- [ ] Tests pass (validation, serialization)

---

#### Task 3.1.1b - Chrome Storage Wrapper 🧪
**Dependencies:** Task 3.1.1a, Chrome API mocks

**Deliverables:**
- `src/storage/chromeStorage.ts` with ChromeStorage class
- CRUD operations (get, set, remove, clear)
- Change listeners and caching layer
- Storage usage tracking and quota handling

**Key Tests:**
- Basic CRUD operations
- Multiple key operations
- Change event emission
- Quota error handling
- Storage usage calculation

**Acceptance Criteria:**
- [ ] All CRUD operations functional
- [ ] Change events fire correctly
- [ ] Cache improves performance
- [ ] Quota errors handled gracefully


---

#### Task 3.1.1c - Storage Migrations 🧪
**Dependencies:** Task 3.1.1b

**Deliverables:**
- `src/storage/migrations.ts` with MigrationManager class
- Version detection and migration registration
- Backup/restore functionality with rollback on failure
- Built-in migrations for schema evolution

**Key Tests:**
- Version detection and migration ordering
- Skip already applied migrations
- Rollback on migration failure
- Backup creation before migration

**Acceptance Criteria:**
- [ ] Migrations run in correct order
- [ ] Failed migrations rollback properly
- [ ] Backups created before migration
- [ ] Version tracking functional


---

### 🔄 Parallel Block B: IndexedDB (3 tasks)

#### Task 3.1.2a - IndexedDB Schema 🧪
**Dependencies:** Task 3.1.1a

**Deliverables:**
- `src/storage/schema.ts` with Conversation, Message, TabContext interfaces
- Validation functions for schema integrity
- Index definitions for query optimization
- Database migration structure

**Key Tests:**
- Schema validation (valid/invalid data)
- Index creation and structure
- Migration setup

**Acceptance Criteria:**
- [ ] Schemas well-defined and validated
- [ ] Indexes optimize common queries
- [ ] Migration structure ready


---

#### Task 3.1.2b - IndexedDB Wrapper 🧪
**Dependencies:** Task 3.1.2a

**Deliverables:**
- `src/storage/indexedDB.ts` with IndexedDBWrapper class
- CRUD operations (add, get, update, delete)
- Index queries and transaction support
- Database versioning and error handling

**Key Tests:**
- Database connection lifecycle
- CRUD operations and index queries
- Transaction handling
- Item counting and bulk operations

**Acceptance Criteria:**
- [ ] Database opens/closes correctly
- [ ] CRUD operations functional
- [ ] Index queries work properly
- [ ] Transactions complete successfully

---

## Phase 3.2: Security (6 tasks)

### 🔄 Parallel Block C: Encryption (3 tasks)

#### Task 3.2.1a - AES Encryption 🧪
**Dependencies:** Phase 3.1 complete

**Deliverables:**
- `src/security/encryption.ts` with AES-256-GCM implementation
- Key derivation and secure random generation
- Encrypt/decrypt functions with IV handling

**Key Tests:**
- Encryption/decryption round-trip
- Different data types and sizes
- Key derivation consistency

**Acceptance Criteria:**
- [ ] AES-256-GCM encryption working
- [ ] Secure key derivation implemented
- [ ] IV properly randomized per operation

#### Task 3.2.1b - Sensitive Data Detection 🧪
**Dependencies:** Task 3.2.1a

**Deliverables:**
- `src/security/dataClassification.ts` with pattern detection
- API key, password, token detection
- Data masking and redaction utilities

**Key Tests:**
- Detection of common sensitive patterns
- Masking preserves data structure
- Performance with large content

**Acceptance Criteria:**
- [ ] Detects API keys, passwords, tokens
- [ ] Masking preserves functionality
- [ ] Low false positive rate

#### Task 3.2.1c - Security Manager 🧪
**Dependencies:** Tasks 3.2.1a, 3.2.1b

**Deliverables:**
- `src/security/securityManager.ts` orchestrating security features
- API key storage with encryption
- Secure data persistence layer

**Key Tests:**
- End-to-end API key storage
- Data encryption before persistence
- Secure data retrieval and decryption

**Acceptance Criteria:**
- [ ] API keys encrypted at rest
- [ ] Seamless encryption/decryption
- [ ] Security policies enforced

---

## Phase 3.3: Data Management (6 tasks)

### 🔄 Parallel Block D: Cache & Cleanup (3 tasks)

#### Task 3.3.1a - Cache Manager 🧪
**Dependencies:** Phase 3.1 complete

**Deliverables:**
- `src/storage/cacheManager.ts` with TTL support
- LRU eviction policy
- Configurable cache policies

#### Task 3.3.1b - Data Cleanup Utilities 🧪
**Dependencies:** Task 3.3.1a

**Deliverables:**
- `src/storage/cleanup.ts` with conversation pruning
- Old cache entry removal
- Storage quota management

#### Task 3.3.1c - Storage Service Integration 🧪
**Dependencies:** All previous tasks

**Deliverables:**
- `src/storage/storageService.ts` unified storage API
- High-level operations for conversations
- Background cleanup scheduling

---

## Completion Checklist

**Testing:** All tests passing, >95% coverage, security audited
**Quality:** No TS/ESLint errors, code reviewed
**Deliverables:** Chrome storage, IndexedDB, encryption, cache management

**Ready for Stage 4:** Storage layer tested, API keys secure, conversations persist

---

*18 tasks | 1.5 weeks | Requires Stages 1-2*