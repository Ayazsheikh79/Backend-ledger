# 🏦 Backend Ledger API

A production-ready **Banking & Financial Ledger REST API** built with **Node.js**, **Express**, and **MongoDB**. It implements a double-entry bookkeeping system with ACID-compliant money transfers, JWT-based authentication, and email notifications.

---

## 📋 Table of Contents

- [Features](#-features)
- [Tech Stack](#-tech-stack)
- [Project Structure](#-project-structure)
- [Getting Started](#-getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Environment Variables](#environment-variables)
  - [Running the App](#running-the-app)
- [API Overview](#-api-overview)
- [How Transactions Work](#-how-transactions-work)
- [Authentication](#-authentication)
- [Email Notifications](#-email-notifications)
- [Documentation](#-documentation)

---

## ✨ Features

- 🔐 **Secure JWT Authentication** — Cookie-based tokens with logout blacklisting and 3-day TTL
- 💳 **Account Management** — Create and manage user bank accounts with status tracking
- 💸 **ACID-Compliant Transfers** — Money transfers backed by MongoDB sessions & transactions
- 📒 **Double-Entry Bookkeeping** — Every transfer creates immutable DEBIT and CREDIT ledger entries
- 🔑 **Idempotency Support** — Safe transaction retries via unique idempotency keys
- 🤖 **System User** — Special privileged user for seeding initial funds to accounts
- 📧 **Email Notifications** — Gmail OAuth2 transactional emails for registration and transfers
- ⚡ **Real-time Balance** — Balance derived from ledger aggregation, never stored as a field

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| Runtime | Node.js (ES Modules) |
| Framework | Express.js v5 |
| Database | MongoDB via Mongoose v9 |
| Authentication | JSON Web Tokens (JWT) |
| Password Hashing | bcryptjs |
| Email | Nodemailer + Gmail OAuth2 |
| Dev Tools | nodemon |

---

## 📁 Project Structure

```
Backend-ledger/
├── server.js                    # Entry point — starts HTTP server
├── package.json
└── src/
    ├── app.js                   # Express app setup, middleware, routes
    ├── config/
    │   └── db.js                # MongoDB connection
    ├── controllers/
    │   ├── auth.controller.js   # Register, login, logout
    │   ├── account.controller.js  # Create account, list accounts, get balance
    │   └── transaction.controller.js  # Transfer funds, initial funds
    ├── middleware/
    │   └── auth.middleware.js   # JWT verification, system-user guard
    ├── models/
    │   ├── user.model.js        # User schema + password hashing
    │   ├── account.model.js     # Account schema + getBalance() method
    │   ├── transaction.model.js # Transaction schema
    │   ├── ledger.model.js      # Immutable ledger entries (CREDIT/DEBIT)
    │   └── blackList.model.js   # Revoked JWT tokens (auto-expire in 3 days)
    ├── routes/
    │   ├── auth.routes.js       # /api/auth/*
    │   ├── account.routes.js    # /api/accounts/*
    │   └── transaction.routes.js  # /api/transactions/*
    └── services/
        └── email.service.js     # Nodemailer OAuth2 helpers
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** v18+ (ES Modules support required)
- **npm** v8+
- **MongoDB** — local instance or [MongoDB Atlas](https://www.mongodb.com/atlas) cluster
  > ⚠️ MongoDB replica set required for ACID transactions (Atlas free tier qualifies)
- **Google Cloud Project** with Gmail API enabled (for email notifications)

---

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/Ayazsheikh79/Backend-ledger.git
cd Backend-ledger

# 2. Install dependencies
npm install
```

---

### Environment Variables

Create a `.env` file in the project root:

```env
# ─── Database ───────────────────────────────────────────
DATABASE_URL=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/backend-ledger

# ─── JWT ────────────────────────────────────────────────
JWT_SECRET=your-super-secret-key-at-least-32-chars

# ─── Gmail OAuth2 (for email notifications) ─────────────
EMAIL_USER=your-email@gmail.com
GOOGLE_CLIENT_ID=xxxxxxxxxxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxxxxxxxxxxxxxxxxxxxxxxx
GOOGLE_REFRESH_TOKEN=1//xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

#### Obtaining Google OAuth2 Credentials

1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (or use an existing one).
3. Navigate to **APIs & Services → Library** and enable the **Gmail API**.
4. Go to **APIs & Services → Credentials** and create an **OAuth 2.0 Client ID** (Desktop app type).
5. Use the [Google OAuth 2.0 Playground](https://developers.google.com/oauthplayground/) to generate a `refresh_token`:
   - In Settings, check **Use your own OAuth credentials** and enter your Client ID and Secret.
   - Authorise `https://mail.google.com/`.
   - Exchange for a Refresh Token.
6. Copy all values into your `.env` file.

---

### Running the App

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

The server starts on **http://localhost:3000**.

#### Verify the server is running

```bash
curl http://localhost:3000/
# → "Welcome to the Banking API"
```

Expected startup logs:
```
Server is running on port 3000
Email server is ready to send message
DB Connected
```

---

### Database Initialisation

MongoDB collections are created automatically when first accessed. No manual setup needed.

To bootstrap a **system user** (needed for initial fund distribution):

1. Register a regular user via `POST /api/auth/register`.
2. In MongoDB, manually update that user's document: `{ systemUser: true }`.
3. Create an account for this system user via `POST /api/accounts`.
4. Use `POST /api/transactions/system/initial-funds` to seed funds to other accounts.

---

## 📡 API Overview

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `POST` | `/api/auth/register` | Public | Register a new user |
| `POST` | `/api/auth/login` | Public | Login and receive JWT cookie |
| `GET` | `/api/auth/logout` | Public | Logout and revoke token |
| `POST` | `/api/accounts` | 🔒 User | Create a new bank account |
| `GET` | `/api/accounts` | 🔒 User | List all accounts for current user |
| `GET` | `/api/accounts/balance/:accountId` | 🔒 User | Get account balance |
| `POST` | `/api/transactions` | 🔒 User | Transfer funds between accounts |
| `POST` | `/api/transactions/system/initial-funds` | 🔒 System | Seed initial funds to an account |

> See [docs/API.md](docs/API.md) for full request/response schemas.

---

## 💸 How Transactions Work

Every money transfer follows a **10-step atomic flow**:

```
1. Validate request fields
2. Check idempotency key (prevent duplicates)
3. Verify both accounts are ACTIVE
4. Calculate sender balance from ledger (CREDIT − DEBIT)
5. Open MongoDB session → startTransaction()
6. Create Transaction record (status: PENDING)
7. Create DEBIT ledger entry (sender account)
8. Create CREDIT ledger entry (recipient account)
9. Mark Transaction as COMPLETED
10. commitTransaction() → send email notification
```

If any step fails, the MongoDB session is rolled back. The ledger entries are **immutable** — they can never be updated or deleted, which guarantees a complete audit trail.

---

## 🔐 Authentication

Authentication uses **JWT tokens** stored as HTTP-only cookies.

| Property | Value |
|----------|-------|
| Cookie name | `access_token` |
| Token expiry | 3 days |
| Signing algorithm | HS256 |
| Logout strategy | Token blacklist (MongoDB TTL index) |

**Sending requests:**

Option A — Cookie (browser / Postman with cookies enabled):
```
Cookie: access_token=<token>
```

Option B — Authorization header:
```
Authorization: Bearer <token>
```

---

## 📧 Email Notifications

The email service sends transactional emails via Gmail OAuth2:

| Trigger | Email Sent |
|---------|-----------|
| User registers | Welcome email |
| Transaction completes | Transfer confirmation |
| Transaction fails | Failure notification |

> **Note:** Transaction emails are currently disabled in code (commented out in `transaction.controller.js`) and will be re-enabled in a future release.

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [docs/API.md](docs/API.md) | Full API reference with request/response examples |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design, data models, and flow diagrams |

---

## 📄 License

ISC © [Ayaz Sheikh](https://github.com/Ayazsheikh79)
