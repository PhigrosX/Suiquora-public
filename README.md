# SuiQuora 🧠💬

**SuiQuora** is a decentralized Q&A platform built on the **Sui blockchain**, where users are incentivized to share knowledge and provide high-quality answers through token rewards.

---

## 🚀 Core Features

- ✅ **Question Incentives**: Askers can lock SUI tokens as rewards
- ✅ **Answer System**: Submit answers on-chain (with timestamps and wallet signatures)
- ✅ **Comment System**: Support for multi-level comment discussions on answers
- ✅ **Image Upload**: Image upload support via Supabase Bucket
- ✅ **Decentralized Reward Logic**:
  - Best answer receives the full reward
  - If a question expires without a best answer → reward is evenly split among responders
  - If no answers → reward is returned to the asker
- ✅ **Fully On-chain Interactions**: All operations are traceable and immutable on-chain

---

## ⚙️ Tech Stack

- **Frontend**: React + TypeScript + pnpm
- **Smart Contracts**: Move language on Sui
- **Wallet Integration**: Sui Wallet Adapter
- **Storage**: Supabase (for images and off-chain data)
- **No Centralized Backend**: All core logic is on-chain

---

## 🏗️ Project Structure

```
/src
├── components/     → Reusable UI components
├── pages/          → App routing and page components
├── services/       → Services layer (contract interactions and Supabase)
│   ├── contractService.ts  → Methods for interacting with smart contracts
│   └── SupabaseService.ts  → Image upload and Supabase client
├── contracts/      → Smart contract source code
│   └── suiquora.move       → Move language smart contract
├── context/        → React contexts
├── hooks/          → Custom React Hooks
├── utils/          → Helper functions
└── styles/         → Style files
```

---

## 📦 Getting Started

### 1. Prerequisites

- Node.js (>= 18.x)
- pnpm
- Sui wallet

### 2. Install dependencies

```bash
pnpm install
```

### 3. Run in development mode

```bash
pnpm run dev
```

### 4. Build for production

```bash
pnpm run build
```

## 🔗 Smart Contract Modules

Contracts deployed on Sui Testnet include:

- **QuestionModule** — Submit & expire questions
- **AnswerModule** — Submit & update answers
- **RewardModule** — Handle all reward distributions
- **CommentModule** — Support for threaded comments

## 🖼 Image Upload

- Supabase Bucket is used to store all image attachments
- Uploaded images are linked to questions, answers, and comments via URLs stored on-chain

## 💡 Incentive Model

The core philosophy is to reduce answer latency and improve answer quality through economic incentives.

- Asker sets token bounty when submitting a question
- Best answer receives the full reward
- If a question expires without a best answer being selected:
  - Reward is evenly split among all answerers
  - If there are no answers, the reward is automatically returned to the asker

## 🎯 Why SuiQuora?

- 📈 Faster, higher-quality responses through real token incentives
- 🔍 Transparent history of contributions
- 🧱 Fully decentralized — no backend server or database to control content
