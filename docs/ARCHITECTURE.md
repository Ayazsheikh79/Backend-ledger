# 🏗️ Architecture & Data Models

This document describes the internal design of the Backend Ledger API: how the layers interact, what each data model represents, and how money moves through the system.

---

## Table of Contents

- [System Overview](#system-overview)
- [Layer Architecture](#layer-architecture)
- [Data Models](#data-models)
  - [User](#user-model)
  - [Account](#account-model)
  - [Transaction](#transaction-model)
  - [Ledger](#ledger-model)
  - [Token Blacklist](#token-blacklist-model)
- [Double-Entry Bookkeeping](#double-entry-bookkeeping)
- [Transaction Flow](#transaction-flow)
- [Authentication Flow](#authentication-flow)
- [Balance Calculation](#balance-calculation)
- [Email Service](#email-service)
- [Key Design Decisions](#key-design-decisions)

---

## System Overview

```
┌─────────────────────────────────────────────┐
│                  Client                     │
│  (Browser / Mobile App / Postman / cURL)    │
└───────────────────┬─────────────────────────┘
                    │ HTTP + JSON
                    ▼
┌─────────────────────────────────────────────┐
│              Express.js API                 │
│  ┌──────────┐  ┌────────────┐  ┌─────────┐ │
│  │  Routes  │→ │ Middleware │→ │Controllers│ │
│  └──────────┘  └────────────┘  └─────────┘ │
└───────────────────┬─────────────────────────┘
                    │ Mongoose ODM
                    ▼
┌─────────────────────────────────────────────┐
│              MongoDB Atlas                  │
│  users │ accounts │ transactions │ ledgers  │
│  blacklists                                 │
└─────────────────────────────────────────────┘
                    │ OAuth2
                    ▼
┌─────────────────────────────────────────────┐
│              Gmail / SMTP                   │
│  (Nodemailer + Google OAuth2)               │
└─────────────────────────────────────────────┘
```

---

## Layer Architecture

### `server.js` — Entry Point

Bootstraps the application:
- Loads `.env` via `dotenv/config.js`
- Connects to MongoDB via `connectDB()`
- Starts the Express HTTP server on port **3000**

### `src/app.js` — Application

Configures Express:
- `express.json()` — parses JSON request bodies
- `cookie-parser` — parses HTTP cookies (for JWT extraction)
- Mounts route handlers at `/api/auth`, `/api/accounts`, `/api/transactions`

### `src/routes/` — Routing

Maps HTTP methods + paths to controller functions, with middleware applied per route:

| File | Prefix | Middleware |
|------|--------|-----------|
| `auth.routes.js` | `/api/auth` | None (public) |
| `account.routes.js` | `/api/accounts` | `authMiddleware` |
| `transaction.routes.js` | `/api/transactions` | `authMiddleware` / `authSystemUserMiddleware` |

### `src/controllers/` — Business Logic

Contains all request handling logic. Controllers validate input, interact with models, orchestrate multi-step operations, and return HTTP responses.

### `src/models/` — Data Layer

Mongoose schemas define the shape of data stored in MongoDB. Models expose query methods and hooks (e.g., password hashing on save).

### `src/middleware/` — Auth Guards

Two middleware functions gate protected routes:
- `authMiddleware` — validates JWT, attaches `req.user`
- `authSystemUserMiddleware` — same as above plus checks `req.user.systemUser === true`

### `src/services/` — External Services

`email.service.js` wraps Nodemailer with Gmail OAuth2 and exposes typed functions (`sendRegistrationEmail`, `sendTransactionEmail`, `sendTransactionFailedEmail`).

### `src/config/` — Configuration

`db.js` establishes the Mongoose connection to MongoDB using `process.env.DATABASE_URL`.

---

## Data Models

### User Model

**Collection:** `users`

```
┌──────────────────────────────────────────┐
│  User                                    │
├──────────────┬───────────────────────────┤
│ _id          │ ObjectId (auto)           │
│ email        │ String, unique, indexed   │
│ name         │ String                    │
│ password     │ String (bcrypt hash)      │  ← select: false
│ systemUser   │ Boolean (default: false)  │  ← select: false, immutable
│ createdAt    │ Date                      │
│ updatedAt    │ Date                      │
└──────────────┴───────────────────────────┘
```

**Key behaviours:**
- `password` is hashed with bcrypt (12 salt rounds) in a `pre('save')` hook
- `password` and `systemUser` are excluded from query results by default (`select: false`) to prevent accidental exposure
- `comparePassword(candidate)` method for safe password verification
- `systemUser` is immutable after creation

---

### Account Model

**Collection:** `accounts`

```
┌──────────────────────────────────────────┐
│  Account                                 │
├──────────────┬───────────────────────────┤
│ _id          │ ObjectId (auto)           │
│ user         │ ObjectId → User, indexed  │
│ status       │ ACTIVE | FROZEN | CLOSED  │
│ currency     │ String (default: "INR")   │
│ createdAt    │ Date                      │
│ updatedAt    │ Date                      │
└──────────────┴───────────────────────────┘
```

**Indexes:**
- `{ user: 1 }` — fast lookup of accounts by user
- `{ user: 1, status: 1 }` — compound index for filtered account queries

**Key behaviours:**
- `getBalance()` — instance method that aggregates the ledger to compute `totalCredit − totalDebit`. Returns `0` if no ledger entries exist yet.
- Balance is **never stored** on the account document; it is always derived from ledger entries.

---

### Transaction Model

**Collection:** `transactions`

```
┌──────────────────────────────────────────────────┐
│  Transaction                                     │
├───────────────────┬──────────────────────────────┤
│ _id               │ ObjectId (auto)              │
│ fromAccount       │ ObjectId → Account, indexed  │
│ toAccount         │ ObjectId → Account, indexed  │
│ amount            │ Number (≥ 0)                 │
│ status            │ PENDING|COMPLETED|FAILED     │
│                   │ |REVERSED                    │
│ idempotencyKey    │ String, unique, indexed      │
│ createdAt         │ Date                         │
│ updatedAt         │ Date                         │
└───────────────────┴──────────────────────────────┘
```

**Status lifecycle:**

```
              ┌─────────┐
              │ PENDING │
              └────┬────┘
       ┌───────────┴───────────┐
       ▼                       ▼
  ┌─────────┐            ┌──────────┐
  │COMPLETED│            │  FAILED  │
  └─────────┘            └────┬─────┘
                              ▼
                         ┌──────────┐
                         │ REVERSED │
                         └──────────┘
```

**Idempotency:** The unique index on `idempotencyKey` prevents two concurrent writes with the same key. The controller also reads the existing record to return deterministic responses.

---

### Ledger Model

**Collection:** `ledgers`

```
┌──────────────────────────────────────────────────┐
│  Ledger Entry                                    │
├───────────────────┬──────────────────────────────┤
│ _id               │ ObjectId (auto)              │
│ account           │ ObjectId → Account, indexed  │  ← immutable
│ transaction       │ ObjectId → Transaction, idx  │  ← immutable
│ type              │ CREDIT | DEBIT               │  ← immutable
│ amount            │ Number                       │  ← immutable
│ createdAt         │ Date                         │
│ updatedAt         │ Date                         │
└───────────────────┴──────────────────────────────┘
```

**All fields are marked `immutable: true`**. Once written, a ledger entry cannot be modified. This enforces the integrity of the double-entry bookkeeping audit trail.

Every transfer creates exactly **two** ledger entries:
1. `DEBIT` on `fromAccount` (money leaves)
2. `CREDIT` on `toAccount` (money arrives)

---

### Token Blacklist Model

**Collection:** `blacklists`

```
┌──────────────────────────────────────────┐
│  BlackList                               │
├──────────────┬───────────────────────────┤
│ _id          │ ObjectId (auto)           │
│ token        │ String, unique            │
│ createdAt    │ Date (TTL: 3 days)        │
│ updatedAt    │ Date                      │
└──────────────┴───────────────────────────┘
```

MongoDB TTL index on `createdAt` automatically purges expired tokens after **3 days** — matching the JWT expiry — so the collection never grows unboundedly.

---

## Double-Entry Bookkeeping

The ledger implements a simplified **double-entry** system:

```
Transfer ₹500 from Account A → Account B

  Account A Ledger           Account B Ledger
  ┌──────────────────┐       ┌──────────────────┐
  │ type:  DEBIT     │       │ type:  CREDIT    │
  │ amount: 500      │       │ amount: 500      │
  │ txn:  <txnId>    │       │ txn:  <txnId>    │
  └──────────────────┘       └──────────────────┘

  Balance A = ΣCredit - ΣDebit   Balance B = ΣCredit - ΣDebit
```

**Properties:**
- The total sum across all ledger entries always nets to zero (double-entry).
- There is no separate "balance" field — the authoritative balance is always the aggregate.
- Ledger entries are immutable and append-only, providing a complete audit trail.

---

## Transaction Flow

```
POST /api/transactions
        │
        ▼
 1. Validate fields ──────────────────────────────────► 400 if missing
        │
        ▼
 2. Lookup accounts ──────────────────────────────────► 404 if not found
        │
        ▼
 3. Check idempotency key ────────────────────────────► 200/409 if key exists
        │
        ▼
 4. Check account statuses ───────────────────────────► 403 if not ACTIVE
        │
        ▼
 5. Calculate sender balance ─────────────────────────► 400 if insufficient
        │
        ▼
 6. ┌── MongoDB session.startTransaction() ──┐
    │  a. Create Transaction (PENDING)        │
    │  b. Create DEBIT ledger entry           │
    │  c. Create CREDIT ledger entry          │
    │  d. Update Transaction → COMPLETED      │
    └── session.commitTransaction() ─────────┘
        │                         │
        │                  ► rollback + error
        ▼
 7. Return 201 + transaction object
        │
        ▼
 8. (Send email notification — currently disabled)
```

---

## Authentication Flow

```
Registration / Login
        │
        ▼
  Validate credentials
        │
        ▼
  Sign JWT (3-day expiry, JWT_SECRET)
        │
        ▼
  Set access_token cookie (HttpOnly)
        │
        ▼
  Return 200/201

─────────────────────────────────────────

Protected Request
        │
        ▼
  Extract token from cookie OR
  Authorization: Bearer <token>
        │
        ▼
  Check blacklist ──────────────────────► 401 if blacklisted
        │
        ▼
  Verify JWT signature ─────────────────► 401 if invalid/expired
        │
        ▼
  Fetch user from DB ───────────────────► 401 if user deleted
        │
        ▼
  req.user = user → next()

─────────────────────────────────────────

Logout
        │
        ▼
  Add token to blacklist (TTL: 3 days)
        │
        ▼
  Clear cookie → 200
```

---

## Balance Calculation

Balance is computed on demand using a MongoDB aggregation pipeline:

```javascript
// Pseudo-aggregation run on account.getBalance()
[
  { $match: { account: <accountId> } },
  {
    $group: {
      _id: null,
      totalDebit:  { $sum: { $cond: [{ $eq: ["$type", "DEBIT"]  }, "$amount", 0] } },
      totalCredit: { $sum: { $cond: [{ $eq: ["$type", "CREDIT"] }, "$amount", 0] } }
    }
  },
  {
    $project: {
      balance: { $subtract: ["$totalCredit", "$totalDebit"] }
    }
  }
]
```

No caching layer is used; every balance request hits the ledger. For high-traffic production systems, consider adding a Redis cache or a pre-computed `balance` field updated within the transaction session.

---

## Email Service

The email service uses **Nodemailer** with **Gmail OAuth2** (not App Passwords) for secure SMTP authentication.

### Configured Templates

| Function | Trigger | Subject |
|----------|---------|---------|
| `sendRegistrationEmail(email, name)` | After registration | "Welcome to Backend Ledger" |
| `sendTransactionEmail(email, name, amount, to, from)` | After transfer completes | "Transaction Successful" |
| `sendTransactionFailedEmail(email, name, amount, to, from)` | After transfer fails | "Transaction Failed" |

> `sendTransactionEmail` is currently commented out in `transaction.controller.js`. To enable it, uncomment the call after `session.commitTransaction()`.

---

## Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **ES Modules** | Modern Node.js standard; enables static analysis and tree-shaking |
| **Mongoose 9 + MongoDB sessions** | ACID transactions require a replica set; prevents partial writes in multi-document operations |
| **Immutable ledger entries** | Preserves audit integrity; aligns with double-entry bookkeeping principles |
| **Balance derived from ledger** | Source of truth is the ledger, not a denormalized field; eliminates balance drift |
| **JWT blacklist for logout** | Stateless JWTs cannot be revoked by default; blacklist adds true invalidation at the cost of one DB lookup per request |
| **Idempotency keys** | Enables safe retries for network failures without double-charging |
| **`select: false` on sensitive fields** | Prevents accidental exposure of `password` and `systemUser` in API responses |
| **System user pattern** | Allows trusted initial fund distribution without manual DB seeding scripts |
| **Google OAuth2 for email** | More secure than plain SMTP passwords; tokens can be revoked independently |
