# GAPEM - Greatest Advertisement Platform Ever Made

A decentralized billboard platform built on Solana and Cloudflare Workers.

Features 13 high-visibility VIP ad slots organized in a 4x4 grid centered around a premier 2x2 King slot. Advertisers place bids in SOL to showcase banners, project titles, and links to global audiences.

## Architecture & Mechanics

1. **Independent 2-Minute Auctions**: Each slot runs an independent auction round. Any user can trigger bidding on any slot at any time by bidding higher than the current price. Floor begins at 0.001 SOL.
2. **On-Chain Escrow & Automated Refunds**: User bids are paid on-chain to a dedicated Escrow wallet (`BbZCeG2xcfade1J4GexqeoV3pMGEqPjxc3EX1Z7SYjmn`). If another user outbids the leader, 100% of the previous leader's SOL is automatically refunded to their wallet by the backend worker.
3. **Treasury Settlement**: When an auction round concludes, the winning bid in escrow is automatically swept to the treasury wallet (`9YZRbz3SQTFXsFa38J3hmBXaTnQ1WKB3jerZeAU7WP6n`).
4. **Anti-Snipe Protection**: Bids placed within the final 20 seconds of an active round automatically extend the round countdown by 20 seconds.
5. **King of the Hill Permanence**: Once claimed, an ad remains on the billboard permanently at the winning price until another user initiates an auction and outbids it in a future round.
6. **Grace Window Claim**: Winners have a 60-second window to customize their ad banner, title, and destination link before it is published live.

## Tech Stack

- **Frontend**: React 19, TypeScript, Vite, Vanilla CSS design system
- **Web3**: `@solana/web3.js`, support for Phantom, Solflare, Backpack, Coinbase, and OKX wallets
- **Backend / Edge**: Cloudflare Workers with Cloudflare KV storage
- **Domain**: Deployed at `https://gapem.lol` and `https://www.gapem.lol`

## Security Model

- **Zero Private Keys Client-Side**: No private keys or seeds are bundled in the frontend or public assets. All escrow signing operations execute exclusively within Cloudflare Workers edge environment using encrypted secrets (`ESCROW_SECRET_KEY`).
- **Protected Administrative Endpoints**: Maintenance endpoints such as `/api/reset` require cryptographic bearer authorization.
- **Non-Custodial User Interaction**: User wallets sign standard Solana system transfer instructions directly within their browser wallet provider.

## Local Development

```bash
npm install
npm run dev
```

Build production client:
```bash
npm run build
```

Deploy to Cloudflare Workers:
```bash
npx wrangler deploy
```
