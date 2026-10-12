import React, { useState, useEffect, useRef } from 'react';
import type { AdSlot, WalletState, ToastMessage, RingSlot, SupportedWalletName } from './types';
import {
  INITIAL_SLOTS,
  TOP_RING_SLOTS,
  RIGHT_RING_SLOTS,
  BOTTOM_RING_SLOTS,
  LEFT_RING_SLOTS,
} from './lib/initialData';
import { AdCard } from './components/AdCard';
import { RingSlotCard } from './components/RingSlotCard';
import { BidModal } from './components/BidModal';
import { ClaimModal } from './components/ClaimModal';
import { WalletConnectModal } from './components/WalletConnectModal';
import {
  Wallet,
  CheckCircle,
  AlertCircle,
  Info,
  X,
} from 'lucide-react';
import {
  fetchMainnetBalance,
  sendMainnetPayment,
  TREASURY_WALLET,
} from './lib/solana';

const STORAGE_KEY_SLOTS = 'gapem_ad_slots_mainnet_v2';
const STORAGE_KEY_WALLET = 'gapem_wallet_state_mainnet_v1';

const SLOT_NAME_MAP: Record<string, string> = {
  center: 'SLOT 1',
  'slot-1': 'SLOT 2',
  'slot-2': 'SLOT 3',
  'slot-3': 'SLOT 4',
  'slot-4': 'SLOT 5',
  'slot-5': 'SLOT 6',
  'slot-6': 'SLOT 7',
  'slot-7': 'SLOT 8',
  'slot-8': 'SLOT 9',
  'slot-9': 'SLOT 10',
  'slot-10': 'SLOT 11',
  'slot-11': 'SLOT 12',
  'slot-12': 'SLOT 13',
};

export const App: React.FC = () => {
  // 1. Slots State (13 independent slots)
  const [slots, setSlots] = useState<AdSlot[]>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_SLOTS);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length === 13) {
          return parsed.map((s: AdSlot) => ({
            ...s,
            name: SLOT_NAME_MAP[s.id] || s.name,
          }));
        }
      } catch {
        // fallback
      }
    }
    return INITIAL_SLOTS;
  });

  // 2. Wallet State
  const [wallet, setWallet] = useState<WalletState>(() => {
    const saved = localStorage.getItem(STORAGE_KEY_WALLET);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // default
      }
    }
    return {
      connected: false,
      publicKey: null,
      balanceSol: 0,
      walletName: null,
    };
  });

  // Modals state - Multiple concurrent bidding windows
  const [activeBidSlotIds, setActiveBidSlotIds] = useState<string[]>([]);

  const handleOpenBidModal = (slotId: string) => {
    setActiveBidSlotIds((prev) => {
      if (prev.includes(slotId)) {
        // If already open, bring to front
        return [...prev.filter((id) => id !== slotId), slotId];
      }
      return [...prev, slotId];
    });
  };

  const handleCloseBidModal = (slotId: string) => {
    setActiveBidSlotIds((prev) => prev.filter((id) => id !== slotId));
  };

  const handleBringToFront = (slotId: string) => {
    setActiveBidSlotIds((prev) => {
      if (prev[prev.length - 1] === slotId) return prev;
      return [...prev.filter((id) => id !== slotId), slotId];
    });
  };
  const [activeClaimSlot, setActiveClaimSlot] = useState<AdSlot | null>(null);
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState<boolean>(false);

  // Toasts
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = (text: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToasts((prev) => {
      // Prevent spamming identical toast message
      if (prev.some((t) => t.text === text)) {
        return prev;
      }
      const newToast: ToastMessage = {
        id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        text,
        type,
      };
      setTimeout(() => {
        setToasts((current) => current.filter((t) => t.id !== newToast.id));
      }, 3500);
      return [...prev, newToast];
    });
  };

  const occupiedVipCount = slots.filter((s) => s.currentAd !== null).length;
  const isOuterRingUnlocked = occupiedVipCount === 13;

  const handleRingSlotClick = (ringSlot: RingSlot) => {
    if (!isOuterRingUnlocked) {
      addToast(
        `OUTER RING INACTIVE · UNLOCKS WHEN ALL 13 VIP SLOTS ARE OCCUPIED (${occupiedVipCount}/13)`,
        'info'
      );
    } else {
      addToast(`OUTER RING SLOT ${ringSlot.label} UNLOCKED · BIDDING ACTIVE`, 'success');
    }
  };

  // Sync to localStorage as offline fallback
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_SLOTS, JSON.stringify(slots));
  }, [slots]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_WALLET, JSON.stringify(wallet));
  }, [wallet]);

  // Periodic sync with Cloudflare KV database (Every 2.5 seconds)
  useEffect(() => {
    const fetchSlotsFromCloudflare = async () => {
      try {
        const res = await fetch('/api/slots');
        if (res.ok) {
          const data = (await res.json()) as { slots?: AdSlot[] };
          if (data?.slots && Array.isArray(data.slots)) {
            setSlots(
              data.slots.map((s: AdSlot) => ({
                ...s,
                name: SLOT_NAME_MAP[s.id] || s.name,
              }))
            );
          }
        }
      } catch {}
    };

    fetchSlotsFromCloudflare();
    const syncInterval = setInterval(fetchSlotsFromCloudflare, 2500);
    return () => clearInterval(syncInterval);
  }, []);

  // Synchronized timer refs for independent per-slot countdown ticks
  const slotsRef = useRef(slots);
  slotsRef.current = slots;
  const walletRef = useRef(wallet);
  walletRef.current = wallet;

  // Independent Auction Lifecycle Tick Loop (Every 1 second)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const currentSlots = [...slotsRef.current];
      const currentWallet = walletRef.current;
      let hasChanges = false;

      const updatedSlots = currentSlots.map((slot) => {
        // 1. Check if an active auction on this slot has concluded
        if (slot.activeAuction?.isActive && now >= slot.activeAuction.endsAt) {
          hasChanges = true;
          const winnerWallet = slot.activeAuction.highestBidder;
          const pricePaid = slot.activeAuction.highestBid;
          const isUserWinner = currentWallet.connected && currentWallet.publicKey === winnerWallet;

          if (isUserWinner) {
            addToast(`CONGRATULATIONS! YOU WON ${slot.name}! 1 MINUTE TO CLAIM.`, 'success');
          }

          // Slot enters 1-minute claim grace period
          const newSlot: AdSlot = {
            ...slot,
            activeAuction: null,
            claimInfo: {
              isClaiming: true,
              winnerWallet,
              pricePaid,
              draftTitle: slot.activeAuction.draftTitle || '@ANONYMOUS',
              draftLink: slot.activeAuction.draftLink || '',
              draftImageUrl:
                slot.activeAuction.draftImageUrl ||
                'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
              claimExpiresAt: now + 60 * 1000,
            },
          };

          if (isUserWinner) {
            setActiveClaimSlot(newSlot);
          }

          return newSlot;
        }

        // 2. Check if a 1-minute claim period on this slot expired
        if (slot.claimInfo?.isClaiming && now >= slot.claimInfo.claimExpiresAt) {
          hasChanges = true;
          // Dismiss open claim modal if it was for this slot
          setActiveClaimSlot((curr) => (curr?.id === slot.id ? null : curr));
          return {
            ...slot,
            currentAd: {
              title: slot.claimInfo.draftTitle || '@ANONYMOUS',
              link: slot.claimInfo.draftLink || '',
              imageUrl: slot.claimInfo.draftImageUrl,
              owner: slot.claimInfo.winnerWallet,
              priceSol: slot.claimInfo.pricePaid,
            },
            claimInfo: null,
          };
        }

        return slot;
      });

      if (hasChanges) {
        setSlots(updatedSlots);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const WALLET_LABELS: Record<SupportedWalletName, string> = {
    phantom: 'PHANTOM',
    solflare: 'SOLFLARE',
    backpack: 'BACKPACK',
    coinbase: 'COINBASE',
    okx: 'OKX',
  };

  const resolveSolanaProvider = (walletName: SupportedWalletName): any => {
    if (typeof window === 'undefined') return null;
    const anyWin = window as any;
    if (walletName === 'phantom') {
      return anyWin?.phantom?.solana?.isPhantom
        ? anyWin.phantom.solana
        : anyWin?.solana?.isPhantom
        ? anyWin.solana
        : null;
    }
    if (walletName === 'solflare') {
      return anyWin?.solflare?.isSolflare ? anyWin.solflare : anyWin?.solflare || null;
    }
    if (walletName === 'backpack') {
      return anyWin?.backpack?.solana || anyWin?.backpack || null;
    }
    if (walletName === 'coinbase') {
      return anyWin?.coinbaseSolana || null;
    }
    if (walletName === 'okx') {
      return anyWin?.okxwallet?.solana || null;
    }
    return null;
  };

  // Connect Wallet
  const handleConnectWallet = async (walletType: SupportedWalletName) => {
    setIsWalletModalOpen(false);
    const provider = resolveSolanaProvider(walletType);
    const label = WALLET_LABELS[walletType] || 'WALLET';

    if (!provider) {
      addToast(
        `${label} WALLET NOT DETECTED (INSTALL EXTENSION OR OPEN IN ${label} APP)`,
        'warning'
      );
      return;
    }

    try {
      addToast(`CONNECTING ${label}...`, 'info');
      const resp = await provider.connect();
      const pubkey = (provider.publicKey?.toString() || resp?.publicKey?.toString() || '').trim();

      if (!pubkey) {
        addToast(`COULD NOT RETRIEVE PUBLIC KEY FROM ${label}`, 'warning');
        return;
      }

      addToast('CHECKING MAINNET SOL BALANCE...', 'info');
      const realBal = await fetchMainnetBalance(pubkey);
      setWallet({
        connected: true,
        publicKey: pubkey,
        balanceSol: realBal,
        walletName: walletType,
      });
      addToast(
        `${label} CONNECTED (MAINNET): ${pubkey.slice(0, 4)}...${pubkey.slice(-4)} (${realBal} SOL)`,
        'success'
      );
    } catch (err: any) {
      console.warn(`Connection error for ${label}:`, err);
      addToast(`CONNECTION CANCELLED: ${err?.message || ''}`, 'warning');
    }
  };

  const handleDisconnectWallet = () => {
    setWallet({
      connected: false,
      publicKey: null,
      balanceSol: 0,
      walletName: null,
    });
    addToast('WALLET DISCONNECTED', 'info');
  };

  // Submit Bid -> Starts or updates independent 2-minute auction on THIS slot
  const handleSubmitBid = async (
    slotId: string,
    bidAmount: number,
    adDraft: { title: string; link: string; imageUrl: string }
  ) => {
    if (!wallet.connected || !wallet.publicKey) {
      handleCloseBidModal(slotId);
      setIsWalletModalOpen(true);
      return;
    }

    const MIN_RENT_RESERVE = 0.0012; // Solana rent-exempt reserve (~0.00089 SOL) + tx fee
    if (wallet.balanceSol < bidAmount + MIN_RENT_RESERVE) {
      addToast(
        `INSUFFICIENT BALANCE FOR RENT & FEES (REQUIRED: ${(bidAmount + MIN_RENT_RESERVE).toFixed(4)} SOL INCL. 0.0012 SOL RESERVE, CURRENT: ${wallet.balanceSol.toFixed(4)} SOL)`,
        'warning'
      );
      throw new Error('Insufficient balance including Solana rent reserve.');
    }

    let txSignature: string | undefined;

    // Real Solana Mainnet payment to Treasury
    const provider = wallet.walletName ? resolveSolanaProvider(wallet.walletName) : null;

    if (!provider) {
      addToast('WALLET PROVIDER NOT FOUND', 'warning');
      throw new Error('Wallet provider not found.');
    }

    addToast(`PLEASE APPROVE ${bidAmount} SOL TRANSFER TO TREASURY IN YOUR WALLET...`, 'info');
    try {
      txSignature = await sendMainnetPayment(provider, wallet.publicKey, bidAmount);
      addToast(
        `TX CONFIRMED ON MAINNET! (${txSignature.slice(0, 6)}...${txSignature.slice(-4)})`,
        'success'
      );
    } catch (err: any) {
      console.error('Mainnet payment error:', err);
      addToast(
        `TRANSACTION CANCELLED OR FAILED: ${err?.message || 'USER REJECTED'}`,
        'warning'
      );
      throw err; // Abort - funds were not sent, so do not update the slot
    }

    // Refresh on-chain balance
    try {
      const updatedBal = await fetchMainnetBalance(wallet.publicKey);
      setWallet((prev) => ({ ...prev, balanceSol: updatedBal }));
    } catch {}

    const now = Date.now();

    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id === slotId) {
          const isOngoing = !!slot.activeAuction?.isActive;
          // If starting new auction: 2 minutes from now. If already ongoing: maintain or anti-snipe extend
          const auctionDurationMs = 2 * 60 * 1000;
          let newEndsAt = isOngoing ? slot.activeAuction!.endsAt : now + auctionDurationMs;

          // Anti-snipe: if less than 20 seconds remain, extend by +20s
          if (isOngoing && newEndsAt - now < 20000) {
            newEndsAt = now + 20000;
          }

          return {
            ...slot,
            activeAuction: {
              isActive: true,
              highestBid: bidAmount,
              highestBidder: wallet.publicKey!,
              draftTitle: adDraft.title,
              draftLink: adDraft.link,
              draftImageUrl: adDraft.imageUrl,
              bidsCount: isOngoing ? slot.activeAuction!.bidsCount + 1 : 1,
              endsAt: newEndsAt,
            },
          };
        }
        return slot;
      })
    );

    addToast(
      `BID OF ${bidAmount < 0.01 ? bidAmount.toFixed(3) : bidAmount.toFixed(2)} SOL PLACED! 2-MIN AUCTION ACTIVE.`,
      'success'
    );

    // Persist to Cloudflare KV database
    try {
      const res = await fetch('/api/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          bidAmount,
          adDraft,
          bidderWallet: wallet.publicKey || 'ANONYMOUS',
          txSignature,
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { slots?: AdSlot[] };
        if (data?.slots) {
          setSlots(
            data.slots.map((s: AdSlot) => ({
              ...s,
              name: SLOT_NAME_MAP[s.id] || s.name,
            }))
          );
        }
      }
    } catch {}
  };

  // Single-flight guard for publishing claimed ads
  const publishedClaimSlotIdsRef = useRef<Set<string>>(new Set());

  // Publish Claimed Ad
  const handlePublishClaimedAd = async (
    slotId: string,
    adData: { title: string; link: string; imageUrl: string }
  ) => {
    if (publishedClaimSlotIdsRef.current.has(slotId)) {
      return;
    }
    publishedClaimSlotIdsRef.current.add(slotId);
    setTimeout(() => {
      publishedClaimSlotIdsRef.current.delete(slotId);
    }, 4000);

    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.id === slotId) {
          return {
            ...slot,
            currentAd: {
              title: adData.title || '@ANONYMOUS',
              link: adData.link || '',
              imageUrl:
                adData.imageUrl ||
                'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
              owner: wallet.publicKey || 'ANONYMOUS',
              priceSol: slot.claimInfo?.pricePaid || slot.currentAd?.priceSol || 0.5,
            },
            claimInfo: null,
          };
        }
        return slot;
      })
    );

    setActiveClaimSlot(null);
    addToast('AD PUBLISHED SUCCESSFULLY TO BILLBOARD!', 'success');

    // Persist to Cloudflare KV database
    try {
      const res = await fetch('/api/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slotId,
          adData,
          ownerWallet: wallet.publicKey || 'ANONYMOUS',
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { slots?: AdSlot[] };
        if (data?.slots) {
          setSlots(
            data.slots.map((s: AdSlot) => ({
              ...s,
              name: SLOT_NAME_MAP[s.id] || s.name,
            }))
          );
        }
      }
    } catch {}
  };

  return (
    <div className="app-container">
      {/* 1. Header Bar (GAPEM Title centered, clean white buttons with black text below) */}
      <header className="header-bar">
        <div className="brand-wrapper">
          <h1 className="brand-title">GAPEM</h1>
        </div>

        <div className="header-actions">

          {/* Rules / Info */}
          <button
            onClick={() => setIsRulesModalOpen(true)}
            className="btn-header-clean"
            title="PLATFORM RULES & INFO"
          >
            <Info size={11} color="#000000" />
            <span>INFO</span>
          </button>

          {/* Wallet Connection */}
          {!wallet.connected ? (
            <button
              onClick={() => setIsWalletModalOpen(true)}
              className="btn-header-clean"
              title="CONNECT WALLET"
            >
              <Wallet size={11} color="#000000" />
              <span>CONNECT WALLET</span>
            </button>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <div
                className="btn-header-clean"
                style={{ cursor: 'default', background: '#fafafa' }}
                title={`WALLET: ${wallet.publicKey} | TREASURY: ${TREASURY_WALLET}`}
              >
                <Wallet size={11} color="#000000" />
                <span>
                  {wallet.publicKey ? `${wallet.publicKey.slice(0, 4)}...${wallet.publicKey.slice(-4)} · ` : ''}
                  {wallet.balanceSol < 0.01 ? wallet.balanceSol.toFixed(4) : wallet.balanceSol.toFixed(3)} SOL
                </span>
              </div>
              <button
                onClick={handleDisconnectWallet}
                className="btn-header-clean"
                style={{ padding: '3px 6px' }}
                title="DISCONNECT"
              >
                <X size={10} color="#000000" />
              </button>
            </div>
          )}
        </div>
      </header>

      {/* 2. Main Grid Viewport (100% Zero-scroll, surrounded by outer ring) */}
      <main className="stage-main">
        <div className="billboard-ring-wrapper">
          {/* Top Row: 10 Outer Ring Slots */}
          <div className="ring-row ring-row-top">
            {TOP_RING_SLOTS.map((s) => (
              <RingSlotCard
                key={s.id}
                slot={s}
                isUnlocked={isOuterRingUnlocked}
                onClick={handleRingSlotClick}
              />
            ))}
          </div>

          {/* Middle Section: Left 8 Slots, Center 4x4 VIP Grid, Right 8 Slots */}
          <div className="ring-middle-section">
            <div className="ring-col ring-col-left">
              {LEFT_RING_SLOTS.map((s) => (
                <RingSlotCard
                  key={s.id}
                  slot={s}
                  isUnlocked={isOuterRingUnlocked}
                  onClick={handleRingSlotClick}
                />
              ))}
            </div>

            <div className="grid-wrapper">
              {slots.map((slot) => (
                <AdCard
                  key={slot.id}
                  slot={slot}
                  wallet={wallet}
                  onOpenBidModal={(s) => handleOpenBidModal(s.id)}
                  onOpenClaimModal={(s) => setActiveClaimSlot(s)}
                />
              ))}
            </div>

            <div className="ring-col ring-col-right">
              {RIGHT_RING_SLOTS.map((s) => (
                <RingSlotCard
                  key={s.id}
                  slot={s}
                  isUnlocked={isOuterRingUnlocked}
                  onClick={handleRingSlotClick}
                />
              ))}
            </div>
          </div>

          {/* Bottom Row: 10 Outer Ring Slots */}
          <div className="ring-row ring-row-bottom">
            {BOTTOM_RING_SLOTS.map((s) => (
              <RingSlotCard
                key={s.id}
                slot={s}
                isUnlocked={isOuterRingUnlocked}
                onClick={handleRingSlotClick}
              />
            ))}
          </div>
        </div>
      </main>

      {/* 3. Status Footer */}
      <footer className="footer-compact">
        <span>GAPEM · GREATEST ADVERTISEMENT PLATFORM EVER MADE</span>
      </footer>

      {/* Rules / Info Modal */}
      {isRulesModalOpen && (
        <div className="modal-backdrop" onClick={() => setIsRulesModalOpen(false)}>
          <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title">ABOUT GAPEM & HOW IT WORKS</div>
              <button className="btn-close" onClick={() => setIsRulesModalOpen(false)}>
                <X size={14} />
              </button>
            </div>
            <div className="modal-body" style={{ fontSize: '11px', lineHeight: 1.6, gap: '14px', color: '#000000' }}>
              <div>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  WHAT IS GAPEM?
                </strong>
                GAPEM IS BILLBOARD ON SOLANA. IT FEATURES 13 EXCLUSIVE HIGH-VISIBILITY VIP AD SLOTS IN A 4×4 GRID CENTERED AROUND THE PREMIER 2×2 SQUARE KING SLOT. ANYONE CAN PROMOTE THEIR TOKEN, PROJECT, X/@HANDLE, OR COMMUNITY TO AUDIENCES WORLDWIDE.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  01 / INDEPENDENT 2-MIN AUCTIONS
                </strong>
                EACH SLOT RUNS AN INDEPENDENT AUCTION CYCLE WITH NO SYNCHRONIZED GLOBAL EPOCHS. ANY USER CAN TRIGGER A 2-MINUTE BIDDING ROUND ON ANY SLOT AT ANY TIME BY BIDDING HIGHER THAN THE CURRENT PRICE. FLOOR STARTS AT 0.001 SOL.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  02 / SAFE ESCROW & INSTANT REFUNDS
                </strong>
                WHEN YOU PLACE A BID, YOU SIGN TO LOCK YOUR BID IN SECURE ESCROW. IF ANOTHER USER OUTBIDS YOU, 100% OF YOUR SOL IS INSTANTLY REFUNDED BACK TO YOUR WALLET. FUNDS ARE ONLY TRANSFERRED IF YOU WIN THE ROUND.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  03 / ANTI-SNIPE PROTECTION
                </strong>
                IF A BID IS PLACED DURING THE LAST 20 SECONDS OF AN ACTIVE AUCTION, THE TIMER EXTENDS BY 20 SECONDS TO PREVENT BOT SNIPING AND ENSURE FAIR BIDDING.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  04 / KING OF THE HILL PERMANENCE
                </strong>
                WHEN THE 2-MINUTE ROUND CONCLUDES, THE HIGHEST BIDDER WINS. YOUR AD STAYS ON THE BILLBOARD PERMANENTLY AT YOUR WINNING PRICE UNTIL SOMEONE OUTBIDS YOU IN A FUTURE ROUND. IT WILL REMAIN EVEN IF NO ONE BIDS FOR DAYS OR WEEKS.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  05 / 60-SECOND CLAIM & PUBLISH
                </strong>
                UPON WINNING, YOU HAVE A 60-SECOND GRACE WINDOW TO FINALIZE YOUR AD TITLE, DESTINATION LINK, AND BANNER IMAGE. YOUR AD GOES LIVE INSTANTLY ON THE BOARD.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  06 / OUTER RING (PHASE 2 EXPANSION)
                </strong>
                THE 36 MINI SLOTS SURROUNDING THE MAIN BILLBOARD (10 TOP, 10 BOTTOM, 8 LEFT, 8 RIGHT) ARE CURRENTLY LOCKED. THEY WILL AUTOMATICALLY UNLOCK AS ACCESSIBLE COMMUNITY SLOTS ONCE ALL 13 INNER VIP SLOTS ARE FULLY OCCUPIED.
              </div>

              <div style={{ borderTop: '0.5px solid #000000', paddingTop: '10px' }}>
                <strong style={{ display: 'block', marginBottom: '4px', fontSize: '11px' }}>
                  07 / PRIVACY & EPHEMERAL ASSETS (ZERO USER DATA STORED)
                </strong>
                WE NEVER STORE PERSONAL DATA, TRACKING COOKIES, OR WALLET KEYS. CONNECTING YOUR WALLET IS NON-CUSTODIAL AND STRICTLY READS YOUR PUBLIC ADDRESS. AD CONTENT (BANNER IMAGE, LINK, AND TITLE) IS STORED PURELY EPHEMERALLY FOR PUBLIC BOARD DISPLAY AND IS PERMANENTLY OVERWRITTEN AND PURGED THE MOMENT ANOTHER USER OUTBIDS OR WINS THE SLOT.
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setIsRulesModalOpen(false)}>
                UNDERSTOOD
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals - Multiple Simultaneous Bid & Owner Windows */}
      {activeBidSlotIds.map((slotId, index) => {
        const slot = slots.find((s) => s.id === slotId);
        if (!slot) return null;
        return (
          <BidModal
            key={slot.id}
            slot={slot}
            wallet={wallet}
            stackIndex={index}
            zIndex={200 + index * 10}
            onFocus={() => handleBringToFront(slot.id)}
            onClose={() => handleCloseBidModal(slot.id)}
            onSubmitBid={handleSubmitBid}
            onConnectWallet={() => {
              handleCloseBidModal(slot.id);
              setIsWalletModalOpen(true);
            }}
          />
        );
      })}

      <ClaimModal
        slot={activeClaimSlot}
        onClose={() => setActiveClaimSlot(null)}
        onPublishAd={handlePublishClaimedAd}
      />

      <WalletConnectModal
        isOpen={isWalletModalOpen}
        onClose={() => setIsWalletModalOpen(false)}
        onConnect={handleConnectWallet}
      />

      {/* Toast Notifications (Black on White) */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <div key={toast.id} className="toast-item">
            {toast.type === 'success' ? (
              <CheckCircle size={13} color="#000000" />
            ) : toast.type === 'warning' ? (
              <AlertCircle size={13} color="#000000" />
            ) : (
              <Info size={13} color="#000000" />
            )}
            <span>{toast.text}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
