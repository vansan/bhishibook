# BhishiBook (भिशीबुक) 💰

> **Modern, Multi-Tenant Bhishi & Group Fund Management Platform**  
> Tailored for friend circles, alumni batches, self-help groups (SHG / बचत गट), and community rotating savings & credit associations (ROSCAs).

[![Next.js](https://img.shields.io/badge/Next.js-16.3-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.1-blue?logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6.15-2D3748?logo=prisma)](https://www.prisma.io/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.1-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-orange?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Tests](https://img.shields.io/badge/Tests-88%2F88%20Passing-brightgreen?logo=vitest)](https://vitest.dev/)

---

## 📖 Overview

**BhishiBook** replaces error-prone physical notebooks, Excel sheets, and manual WhatsApp calculations with an automated, transparent, double-entry financial platform.

The system is currently running for its flagship community group:
**`96/97 KH भिशी - MaitriNidhi`** (33 active members, 35 shares, ₹3,85,000+ corpus, ₹4,11,000 distributed loans).

---

## ✨ Core Features

### 🌐 1. Full Bilingual Localization (English & मराठी)
- **Devanagari Script Support**: All 33 member names, financial terminology, labels, and receipts adapt instantly between **English** and **मराठी**.
- **1-Tap Language Switcher**: Easily switch between `EN` and `मराठी` from any screen or device.
- Standardized phone numbers (`+91 XXXXX XXXXX`) and localized currency formatting (`₹`).

### 🔐 2. Dual Login & Auto-Provisioning
- **Login with Mobile Number OR Email**: Members and Admins can sign in using their registered 10-digit mobile number (`8208059375`) or their login email (`admin@maitrinidhi.local`) with the same password.
- **First-Time Provisioning**: When an existing member logs in with the default group password (`bhishi1234`), their user account is automatically provisioned and linked to their membership record.
- **My Profile & Security**: Users can update their name, phone number, and change passwords (`/profile`) secured with `scrypt` cryptographic hashing.

### 🛡️ 3. Multi-Admin Group Management
- Groups can designate multiple Admins with equal operational privileges.
- Existing Admins can promote any member to Admin (or demote an Admin back to Member) with a single click in `/group/members`.
- Built-in guard protection prevents demoting the last remaining Admin of a group.

### 🤝 4. Loan Application & 3-Step Democratic Approval Workflow
1. **Member Application (`/member`)**:
   - Member enters requested loan amount, repayment term (months), and purpose.
   - **Guarantors (Jamin)**: Minimum **2 guarantors** are mandatory.
2. **Tier-1 Guarantor Acceptance**:
   - Nominated guarantors receive real-time request notifications in their member portal to accept or decline being a Jamin.
   - Minimum **2 guarantors must accept** before moving to group voting.
3. **Tier-2 Group Member Voting**:
   - All group members review the application and cast an **Approve** or **Reject** vote.
   - Minimum **50% of the group** ($\ge 17$ members out of 33) must approve.
4. **Smart Disbursement (`/group/loans`)**:
   - Admin monitors live approval progress (`Guarantors 2/2 ✓`, `Members 18/33 ✓`, `Treasury Balance vs. Amount`).
   - The **"Disburse Loan"** button becomes active **only when all approvals are met AND sufficient treasury cash is available**.

### 🧾 5. Digital Receipts & Direct WhatsApp Sharing
- **Instant Receipts**: Generated automatically for every Hafta contribution, fine payment, and loan repayment with unique sequential receipt numbers.
- **Direct WhatsApp Messaging**: Click the WhatsApp button to open a pre-filled, localized chat directly with the member.
- **In-App Preview Modal**: Admins can preview the exact WhatsApp message in a chat-bubble card, copy text with 1 click, or download a printable PDF receipt.

### 📱 6. Progressive Web App (PWA) & Mobile-First UX
- **No App Store Required**: Members and Admins can install BhishiBook directly to their smartphone home screen (Android & iOS) from the browser.
- **Standalone App Experience**: Launches full-screen without browser address bars or navigation clutter.
- **1-Tap Install Button**: Interactive in-app install prompt for Android/Chrome and home-screen guidance for iOS Safari.
- **Responsive Tables**: Complex financial tables feature smooth horizontal finger scrolling (`overflow-x-auto`) without breaking page width.
- **Mobile Drawer Navigation**: Slide-down menu tailored for quick thumb access on mobile devices.

### 📊 7. Double-Entry Accounting & Year-End Distribution
- Immutable, double-entry transaction ledger tracking all inflows (Hafta, interest, fines) and outflows (disbursements, payouts).
- Automated monthly penalty/fine calculations for overdue contributions past the cycle grace day.
- **Year-End Distribution**: Automated calculation of total corpus, accumulated loan interest, fine distribution, and dividend shares with individual payout options (*Full Return, Carry Forward, Partial Return*).

---

## 🛠️ Tech Stack

- **Framework**: [Next.js 16](https://nextjs.org/) (App Router, Turbopack, Server Actions)
- **Frontend**: [React 19](https://react.dev/), [Tailwind CSS v4](https://tailwindcss.com/), [Lucide React](https://lucide.dev/)
- **Database & ORM**: [PostgreSQL](https://www.postgresql.org/), [Prisma ORM 6](https://www.prisma.io/)
- **Authentication**: JWT cookie sessions via [jose](https://github.com/panva/jose), Password hashing with Node `crypto.scrypt`
- **PDF Generation**: [pdf-lib](https://pdf-lib.js.org/)
- **Testing**: [Vitest](https://vitest.dev/) (88 unit tests + integration test suite)

---

## 📂 Project Structure

```text
bhisi/
├── prisma/
│   ├── schema.prisma            # Database schema (Groups, Members, Loans, Dues, Ledger, etc.)
│   ├── import-accurate.js       # Master migration script from Excel records
│   └── seed.ts                  # Seed script
├── public/
│   ├── logo.png                 # Platform logo with text
│   ├── logo-icon.png            # High-res emblem & PWA icon
│   ├── maitrinidhi.png          # MaitriNidhi group emblem
│   ├── manifest.webmanifest     # PWA standalone manifest
│   └── sw.js                    # Service Worker with offline caching
├── src/
│   ├── app/
│   │   ├── (auth)/login/        # Dual authentication (Email/Mobile)
│   │   ├── group/               # Group Admin management portal
│   │   │   ├── contributions/   # Monthly hafta tracker & dues generator
│   │   │   ├── loans/           # Active loans & loan application approvals
│   │   │   ├── fines/           # Penalty tracking & waiver controls
│   │   │   ├── members/         # Member roster & multi-admin management
│   │   │   ├── receipts/        # Receipts register with WhatsApp modal
│   │   │   ├── ledger/          # Double-entry audit ledger
│   │   │   ├── distribution/    # Year-end profit & corpus distribution
│   │   │   └── settings/        # Cycle rules, interest rate & limits
│   │   ├── member/              # Member passbook, loan applications & voting
│   │   ├── profile/             # Profile details & password change
│   │   └── superadmin/          # SaaS platform multi-group oversight
│   ├── components/
│   │   ├── layout/              # AppShell, responsive NavHeader, tabs
│   │   ├── ui/                  # ActionForm, StatCard, ExportButton
│   │   ├── pwa-install-button.tsx
│   │   └── pwa-register.tsx
│   ├── lib/
│   │   ├── auth.ts              # Session verification & role guards
│   │   ├── members.ts           # Bilingual names & phone formatting
│   │   ├── money.ts             # Exact integer paise arithmetic
│   │   ├── receipt-text.ts      # Marathi & English WhatsApp message generators
│   │   └── services/            # Pure business logic (loans, dues, distribution)
│   └── messages/
│       ├── en.ts                # English localization dictionary
│       └── mr.ts                # Marathi localization dictionary
```

---

## 🚀 Getting Started

### 1. Prerequisites
- **Node.js**: v20.x or higher
- **PostgreSQL**: v14.x or higher

### 2. Installation & Setup

1. **Clone the repository**:
   ```bash
   git clone https://github.com/vansan/bhishibook.git
   cd bhishibook
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Configure Environment Variables**:
   Create a `.env` file in the root directory:
   ```env
   DATABASE_URL="postgresql://postgres:password@localhost:5432/bhishibook?schema=public"
   SESSION_SECRET="your-32-character-random-secret-key-here"
   NODE_ENV="development"
   ```

4. **Run Database Migrations & Import Data**:
   ```bash
   npx prisma migrate dev
   npm run prisma:seed
   ```

5. **Start Development Server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 🧪 Testing & Verification

Run the test suite:
```bash
# Run unit tests (88 tests)
npm test

# Run all tests including integration
npm run test:all

# Production build verification
npm run build
```

---

## 🔑 Default Credentials (Development)

| Role | Login (Mobile or Email) | Default Password |
|---|---|---|
| **Primary Group Admin** | `8208059375` or `admin@maitrinidhi.local` | `bhishi1234` |
| **Group Member** | Any member mobile number (e.g., `9075701955`) | `bhishi1234` |
| **Platform Superadmin** | `superadmin@bhishibook.local` | `bhishi1234` |

> *Note: Users can change their password at any time via the `/profile` page.*

---

## 📱 Installing on Mobile (PWA)

- **Android (Chrome / Edge / Samsung Internet)**:
  Open the site $\rightarrow$ Tap the **"Install App" (अ‍ॅप इन्स्टॉल करा)** button on the top menu $\rightarrow$ Tap **Install**.
- **iOS (iPhone / iPad Safari)**:
  Open the site $\rightarrow$ Tap **Share (⎋)** $\rightarrow$ Select **"Add to Home Screen (⊞)"** $\rightarrow$ Tap **Add**.

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
