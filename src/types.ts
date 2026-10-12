export interface AdInfo {
  title: string;
  link: string;
  imageUrl: string;
  owner: string;
  priceSol: number;
  acquiredAt?: number;
  sweptToTreasury?: boolean;
}

export interface ActiveAuction {
  isActive: boolean;
  highestBid: number;
  highestBidder: string;
  draftTitle: string;
  draftLink: string;
  draftImageUrl: string;
  bidsCount: number;
  endsAt: number; // timestamp in ms when the 2-min auction ends
}

export interface ClaimInfo {
  isClaiming: boolean;
  winnerWallet: string;
  pricePaid: number;
  draftTitle: string;
  draftLink: string;
  draftImageUrl: string;
  claimExpiresAt: number; // timestamp in ms (1 minute grace)
  sweptToTreasury?: boolean;
}

export interface AdSlot {
  id: string;
  name: string;
  isCenter: boolean;
  currentAd: AdInfo | null;
  activeAuction: ActiveAuction | null;
  claimInfo: ClaimInfo | null;
}

export type SupportedWalletName = 'phantom' | 'solflare' | 'backpack' | 'coinbase' | 'okx';

export interface WalletState {
  connected: boolean;
  publicKey: string | null;
  balanceSol: number;
  walletName: SupportedWalletName | null;
}

export interface ToastMessage {
  id: string;
  text: string;
  type: 'info' | 'success' | 'warning';
}

export interface RingSlot {
  id: string;
  index: number;
  label: string;
  isLocked: boolean;
}
