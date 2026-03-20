# 📡 API Reference

Complete reference for all Backend Ledger REST API endpoints.

**Base URL:** `http://localhost:3000`

---

## Table of Contents

- [Authentication](#authentication)
  - [Register](#post-apiauthregister)
  - [Login](#post-apiauthlogin)
  - [Logout](#get-apiauthlogout)
- [Accounts](#accounts)
  - [Create Account](#post-apiaccounts)
  - [List Accounts](#get-apiaccounts)
  - [Get Balance](#get-apiaccountsbalanceaccountid)
- [Transactions](#transactions)
  - [Transfer Funds](#post-apitransactions)
  - [Initial Funds (System)](#post-apitransactionssysteminitial-funds)
- [Error Reference](#error-reference)

---

## Authentication

### `POST /api/auth/register`

Register a new user account.

**Access:** Public

**Request Body**

```json
{
  "email": "user@example.com",
  "name": "Jane Doe",
  "password": "secret123"
}
```

| Field | Type | Required | Constraints |
|-------|------|----------|-------------|
| `email` | string | ✅ | Valid email format, stored lowercase |
| `name` | string | ✅ | — |
| `password` | string | ✅ | 6–22 characters |

**Response `201 Created`**

```json
{
  "msg": "User registered successfully"
}
```

A `Set-Cookie` header is included in the response with an `access_token` JWT cookie (HttpOnly, 3-day expiry).

**Error Responses**

| Status | Description |
|--------|-------------|
| `400` | Missing or invalid fields |
| `409` | Email already in use |

---

### `POST /api/auth/login`

Authenticate an existing user and receive a JWT cookie.

**Access:** Public

**Request Body**

```json
{
  "email": "user@example.com",
  "password": "secret123"
}
```

| Field | Type | Required |
|-------|------|----------|
| `email` | string | ✅ |
| `password` | string | ✅ |

**Response `200 OK`**

```json
{
  "msg": "User logged in successfully"
}
```

A `Set-Cookie` header sets the `access_token` JWT cookie.

**Error Responses**

| Status | Description |
|--------|-------------|
| `400` | Missing fields |
| `401` | Invalid email or password |

---

### `GET /api/auth/logout`

Invalidate the current session by blacklisting the JWT token and clearing the cookie.

**Access:** Public (token is used if present)

**Response `200 OK`**

```json
{
  "msg": "User logged out successfully"
}
```

The `access_token` cookie is cleared. The token is added to the database blacklist with a 3-day TTL (matching the token expiry).

---

## Accounts

> All account endpoints require authentication. Send the `access_token` cookie or an `Authorization: Bearer <token>` header.

---

### `POST /api/accounts`

Create a new bank account linked to the authenticated user.

**Access:** 🔒 Authenticated User

**Request Body**

None required.

**Response `201 Created`**

```json
{
  "_id": "664abc123def4567890abcde",
  "user": "664abc000def0000890abcde",
  "status": "ACTIVE",
  "currency": "INR",
  "createdAt": "2024-05-20T10:00:00.000Z",
  "updatedAt": "2024-05-20T10:00:00.000Z"
}
```

| Field | Type | Description |
|-------|------|-------------|
| `_id` | string | Account ID (MongoDB ObjectId) |
| `user` | string | Owner's user ID |
| `status` | string | Always `"ACTIVE"` on creation |
| `currency` | string | Always `"INR"` (default) |
| `createdAt` | ISO 8601 | Creation timestamp |
| `updatedAt` | ISO 8601 | Last update timestamp |

**Error Responses**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid token |

---

### `GET /api/accounts`

Retrieve all accounts belonging to the authenticated user.

**Access:** 🔒 Authenticated User

**Response `200 OK`**

```json
{
  "accounts": [
    {
      "_id": "664abc123def4567890abcde",
      "user": "664abc000def0000890abcde",
      "status": "ACTIVE",
      "currency": "INR",
      "createdAt": "2024-05-20T10:00:00.000Z",
      "updatedAt": "2024-05-20T10:00:00.000Z"
    }
  ]
}
```

Returns an empty array `[]` if the user has no accounts.

**Error Responses**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid token |

---

### `GET /api/accounts/balance/:accountId`

Get the current balance of a specific account. Balance is calculated in real time from the ledger (sum of CREDITs minus sum of DEBITs).

**Access:** 🔒 Authenticated User

**URL Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `accountId` | string | MongoDB ObjectId of the account |

**Response `200 OK`**

```json
{
  "id": "664abc123def4567890abcde",
  "balance": 5000
}
```

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Account ID |
| `balance` | number | Current balance in INR (paise not used; whole numbers) |

**Error Responses**

| Status | Description |
|--------|-------------|
| `401` | Missing or invalid token |
| `404` | Account not found |

---

## Transactions

> All transaction endpoints require authentication.

---

### `POST /api/transactions`

Transfer funds from one account to another. The transfer is ACID-compliant and protected by an idempotency key.

**Access:** 🔒 Authenticated User

**Request Body**

```json
{
  "fromAccount": "664abc111def1111890ab001",
  "toAccount":   "664abc222def2222890ab002",
  "amount":      1000,
  "idempotencyKey": "txn-2024-05-20-user42-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fromAccount` | string | ✅ | Sender's account ID |
| `toAccount` | string | ✅ | Recipient's account ID |
| `amount` | number | ✅ | Amount to transfer (must be ≥ 0) |
| `idempotencyKey` | string | ✅ | Unique key to prevent duplicate transfers |

> **Idempotency Key:** Use a unique string per transfer attempt (e.g., `"user-<userId>-transfer-<uuid>"`). Re-sending the same key returns the original result instead of creating a duplicate.

**Response `201 Created`**

```json
{
  "msg": "Transaction successful",
  "transaction": {
    "_id": "664abc333def3333890ab003",
    "fromAccount": "664abc111def1111890ab001",
    "toAccount":   "664abc222def2222890ab002",
    "amount": 1000,
    "status": "PENDING",
    "idempotencyKey": "txn-2024-05-20-user42-001",
    "createdAt": "2024-05-20T12:00:00.000Z",
    "updatedAt": "2024-05-20T12:00:00.000Z"
  }
}
```

> **Note:** The `transaction` object in the response is the document as it was created, so `status` shows `"PENDING"`. The database record is updated to `"COMPLETED"` within the same MongoDB session before the response is returned. To confirm the final status, fetch the transaction by its `_id`.

**Error Responses**

| Status | Body | Description |
|--------|------|-------------|
| `400` | `{"msg": "All fields are required"}` | One or more required fields missing |
| `400` | `{"msg": "Insufficient funds"}` | Sender's balance is lower than the requested amount |
| `403` | `{"msg": "Both accounts must be active to perform a transaction"}` | One or both accounts are FROZEN or CLOSED |
| `404` | `{"msg": "Account not found"}` | `fromAccount` or `toAccount` does not exist |
| `200` | `{"msg": "Transaction already completed"}` | Idempotency key was already used for a COMPLETED transaction |
| `409` | `{"msg": "Transaction already in progress"}` | Idempotency key belongs to a PENDING transaction |
| `409` | `{"msg": "Previous transaction attempt failed. Please try again."}` | Key belongs to a FAILED transaction |
| `409` | `{"msg": "Previous transaction attempt was reversed. Please try again."}` | Key belongs to a REVERSED transaction |
| `401` | — | Missing or invalid token |

---

### `POST /api/transactions/system/initial-funds`

Seed initial funds from the system user's account to any target account. Only users with `systemUser: true` can call this endpoint.

**Access:** 🔒 System User Only

**Request Body**

```json
{
  "toAccount": "664abc222def2222890ab002",
  "amount": 100000,
  "idempotencyKey": "system-seed-account-002-001"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `toAccount` | string | ✅ | Recipient's account ID |
| `amount` | number | ✅ | Amount to credit |
| `idempotencyKey` | string | ✅ | Unique key for this seed operation |

**Response `201 Created`**

```json
{
  "msg": "Initial funds transaction successful",
  "transaction": {
    "_id": "664abc444def4444890ab004",
    "fromAccount": "664abc555def5555890ab005",
    "toAccount":   "664abc222def2222890ab002",
    "amount": 100000,
    "status": "PENDING",
    "idempotencyKey": "system-seed-account-002-001",
    "createdAt": "2024-05-20T08:00:00.000Z",
    "updatedAt": "2024-05-20T08:00:00.000Z"
  }
}
```

> **Note:** Same as the regular transfer — the `transaction` object reflects the initial `"PENDING"` state at creation time. The database record is atomically updated to `"COMPLETED"` within the same MongoDB session before the response is sent.

**Error Responses**

| Status | Description |
|--------|-------------|
| `400` | Missing required fields |
| `401` | Missing or invalid token |
| `403` | Authenticated user is not a system user |
| `404` | Target account not found |
| `404` | System user has no account |

---

## Error Reference

### Common HTTP Status Codes

| Status | Meaning |
|--------|---------|
| `200` | Success |
| `201` | Resource created successfully |
| `400` | Bad request — validation error or insufficient funds |
| `401` | Unauthorized — missing, expired, or blacklisted JWT |
| `403` | Forbidden — insufficient privileges (e.g., non-system user) |
| `404` | Resource not found |
| `409` | Conflict — idempotency key collision |
| `500` | Internal server error |

### Standard Error Response Shape

```json
{
  "msg": "Human-readable error description"
}
```

---

## Quick Start Examples

### 1. Register and log in

```bash
# Register
curl -c cookies.txt -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice","password":"password123"}'

# Login (if already registered)
curl -c cookies.txt -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","password":"password123"}'
```

### 2. Create an account and check balance

```bash
# Create account
curl -b cookies.txt -X POST http://localhost:3000/api/accounts

# List accounts
curl -b cookies.txt http://localhost:3000/api/accounts

# Check balance (replace <accountId> with the returned _id)
curl -b cookies.txt http://localhost:3000/api/accounts/balance/<accountId>
```

### 3. Transfer funds

```bash
curl -b cookies.txt -X POST http://localhost:3000/api/transactions \
  -H "Content-Type: application/json" \
  -d '{
    "fromAccount": "<senderAccountId>",
    "toAccount":   "<recipientAccountId>",
    "amount": 500,
    "idempotencyKey": "unique-transfer-key-001"
  }'
```

### 4. Logout

```bash
curl -b cookies.txt http://localhost:3000/api/auth/logout
```
