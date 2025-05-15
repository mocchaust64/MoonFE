# GokeiWallet - Solana Multisig Wallet with Biometric Authentication

## Introduction

GokeiWallet is a multisig wallet application on the Solana blockchain that allows users to securely manage digital assets using biometric authentication (WebAuthn). With GokeiWallet, you can create and manage transaction proposals, add guardians, and execute secure transactions through a multi-signature approval mechanism, and easily recover access when devices are lost.

### Key Features

- 🔐 Biometric authentication (WebAuthn) instead of traditional private keys
- 👥 Guardian management for multisig wallet
- 💸 Create and execute SOL and token transfers
- 📝 Proposal and approval system for transactions
- 🔄 Data synchronization with Firebase
- 🔑 Easy account recovery when devices are lost

## System Requirements

- Node.js v16+ (recommended: v18)
- npm v8+ or yarn v1.22+
- Modern browser with WebAuthn support (Chrome, Firefox, Safari, Edge)

## Installation

1. Clone the project:

```bash
git clone https://github.com/diptszyx/moonFE
cd moonFE
```

2. Install dependencies:

```bash
npm install
# or
yarn install
```

## Environment Configuration

1. Create a `.env.local` file in the project root with the following content:

```
NEXT_PUBLIC_SOLANA_NETWORK=devnet
NEXT_PUBLIC_RPC_ENDPOINT=https://api.devnet.solana.com
NEXT_PUBLIC_FEE_PAYER_SECRET_KEY=your_fee_payer_secret_key

# Firebase Config
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_firebase_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_firebase_messaging_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_firebase_app_id
```

2. Replace the placeholder values with your actual information:
   - `your_fee_payer_secret_key`: Secret key of the fee payer as a number array (used to pay transaction fees)
   - Firebase information: Retrieved from your Firebase project

## Running the Application

### Development Mode

```bash
npm run dev
# or
yarn dev
```

The application will run at `http://localhost:3000`

### Production Mode

```bash
npm run build
npm run start
# or
yarn build
yarn start
```

## Project Structure

```
src/
├── app/                   # Next.js page structure
├── components/            # React components
│   ├── Guardian/          # Guardian-related components
│   ├── Transactions/      # Transaction-related components
│   └── ui/                # Basic UI components
├── hooks/                 # React hooks
├── lib/                   # Libraries and services
│   ├── firebase/          # Firebase services
│   └── solana/            # Solana integration
├── store/                 # State management
├── types/                 # Type definitions
└── utils/                 # Utilities
    ├── constants.ts       # Constants
    ├── credentialUtils.ts # WebAuthn utilities
    └── proposalSigning.ts # Proposal signing logic
```

## User Guide

### 1. Create/Log into Wallet

- When launching the application for the first time, you'll be guided to create a new wallet or log into an existing one
- The authentication process uses WebAuthn, requiring a device with biometric support (fingerprint, Face ID)

### 2. Guardian Management

- Add new guardians by creating invitation codes
- Share invitation codes with potential guardians
- Confirm guardians in the Transactions tab

### 3. Creating and Approving Transactions

- Create SOL or token transfer proposals from the Create Transaction tab
- Guardians sign proposals using biometric authentication
- When enough signatures are collected according to the threshold, execute the transaction

## Common Issues

### WebAuthn Not Working

- Ensure your device supports WebAuthn
- Access via HTTPS or localhost (WebAuthn requires a secure connection)
- Check if the browser has permission to access biometric sensors

### Solana RPC Errors

- Check your network connection
- Verify the RPC endpoint in `.env.local` is working and on the correct network
- Ensure the fee payer has enough SOL to pay transaction fees

### Firebase Errors

- Check the Firebase configuration in `.env.local`
- Ensure the Firebase project has been set up correctly with appropriate collections and rules

## Support Information

If you encounter issues when installing or using GokeiWallet, please create an issue on GitHub.

## Technologies Used

- [Next.js](https://nextjs.org) - React framework with Server-Side Rendering
- [Tailwind CSS](https://tailwindcss.com) - CSS framework for building user interfaces
- [Solana Web3.js](https://solana-labs.github.io/solana-web3.js/) - JavaScript library for Solana blockchain
- [Firebase](https://firebase.google.com) - Platform for data storage and authentication
- [WebAuthn](https://webauthn.guide) - Web authentication API using biometrics

## License

GokeiWallet is released under the MIT license. See the LICENSE file for details.

---

© 2025 GokeiWallet. All rights reserved.
