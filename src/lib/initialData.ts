import type { AdSlot, RingSlot } from '../types';

export const INITIAL_SLOTS: AdSlot[] = [
  // ROW 1: [ SLOT 2 ] [ SLOT 3 ] [ SLOT 4 ] [ SLOT 5 ]
  {
    id: 'slot-1',
    name: 'SLOT 2',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-2',
    name: 'SLOT 3',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-3',
    name: 'SLOT 4',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-4',
    name: 'SLOT 5',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },

  // ROW 2 & 3: [ SLOT 6 ] [ SLOT 1 (MAIN 2x2) ] [ SLOT 7 ]
  //             [ SLOT 8 ]                       [ SLOT 9 ]
  {
    id: 'slot-5',
    name: 'SLOT 6',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'center',
    name: 'SLOT 1',
    isCenter: true,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-6',
    name: 'SLOT 7',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-7',
    name: 'SLOT 8',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-8',
    name: 'SLOT 9',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },

  // ROW 4: [ SLOT 10 ] [ SLOT 11 ] [ SLOT 12 ] [ SLOT 13 ]
  {
    id: 'slot-9',
    name: 'SLOT 10',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-10',
    name: 'SLOT 11',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-11',
    name: 'SLOT 12',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
  {
    id: 'slot-12',
    name: 'SLOT 13',
    isCenter: false,
    currentAd: null,
    activeAuction: null,
    claimInfo: null,
  },
];

export function formatReignDuration(acquiredAt?: number): string {
  if (!acquiredAt) return '';
  const diffSec = Math.max(0, Math.floor((Date.now() - acquiredAt) / 1000));
  const days = Math.floor(diffSec / 86400);
  const hours = Math.floor((diffSec % 86400) / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  if (days > 0) return `${days}D ${hours}H`;
  if (hours > 0) return `${hours}H ${mins}M`;
  return `${mins}M`;
}

export function normalizeUrl(url?: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return `https://${trimmed}`;
}

export const TOP_RING_SLOTS: RingSlot[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ring-top-${i + 1}`,
  index: 14 + i,
  label: `SLOT ${14 + i}`,
  isLocked: true,
}));

export const RIGHT_RING_SLOTS: RingSlot[] = Array.from({ length: 8 }, (_, i) => ({
  id: `ring-right-${i + 1}`,
  index: 24 + i,
  label: `SLOT ${24 + i}`,
  isLocked: true,
}));

export const BOTTOM_RING_SLOTS: RingSlot[] = Array.from({ length: 10 }, (_, i) => ({
  id: `ring-bottom-${i + 1}`,
  index: 32 + i,
  label: `SLOT ${32 + i}`,
  isLocked: true,
}));

export const LEFT_RING_SLOTS: RingSlot[] = Array.from({ length: 8 }, (_, i) => ({
  id: `ring-left-${i + 1}`,
  index: 42 + i,
  label: `SLOT ${42 + i}`,
  isLocked: true,
}));
