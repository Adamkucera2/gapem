import React, { useState, useEffect } from 'react';
import type { AdSlot, WalletState } from '../types';
import { ExternalLink, Plus } from 'lucide-react';
import { formatReignDuration, normalizeUrl } from '../lib/initialData';

interface AdCardProps {
  slot: AdSlot;
  wallet: WalletState;
  onOpenBidModal: (slot: AdSlot) => void;
  onOpenClaimModal: (slot: AdSlot) => void;
}

export const AdCard: React.FC<AdCardProps> = ({
  slot,
  wallet,
  onOpenBidModal,
  onOpenClaimModal,
}) => {
  // Live countdown ticker for this specific slot's auction or claim
  const [, setTick] = useState(0);

  useEffect(() => {
    if (slot.activeAuction?.isActive || slot.claimInfo?.isClaiming) {
      const interval = setInterval(() => {
        setTick((t) => t + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [slot.activeAuction?.isActive, slot.claimInfo?.isClaiming]);

  const isAuctionActive = !!slot.activeAuction?.isActive;
  const isClaiming = !!slot.claimInfo?.isClaiming;

  const isWinnerOfClaim =
    isClaiming &&
    wallet.connected &&
    wallet.publicKey &&
    slot.claimInfo?.winnerWallet === wallet.publicKey;

  const hasCurrentAd = !!slot.currentAd;
  const reignStr = slot.currentAd?.acquiredAt ? formatReignDuration(slot.currentAd.acquiredAt) : '';

  // Format auction seconds left
  const getAuctionTimeRemaining = () => {
    if (!slot.activeAuction?.endsAt) return '';
    const diff = Math.max(0, Math.floor((slot.activeAuction.endsAt - Date.now()) / 1000));
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  // Format claim seconds left
  const getClaimTimeRemaining = () => {
    if (!slot.claimInfo?.claimExpiresAt) return '';
    const diff = Math.max(0, Math.floor((slot.claimInfo.claimExpiresAt - Date.now()) / 1000));
    return `${diff}s`;
  };

  // Price to display
  const displayPrice = isAuctionActive
    ? slot.activeAuction!.highestBid
    : slot.currentAd
    ? slot.currentAd.priceSol
    : 0.001;

  const formatPrice = (p: number) => {
    return p < 0.01 ? p.toFixed(3) : p.toFixed(2);
  };

  return (
    <div
      className={`ad-slot-card ${slot.isCenter ? 'is-center' : ''}`}
      title={slot.name}
      onClick={() => {
        if (isWinnerOfClaim) {
          onOpenClaimModal(slot);
        } else {
          onOpenBidModal(slot);
        }
      }}
    >
      {/* Corner Price & Active Auction Badge */}
      <div
        className={`slot-corner-badge ${
          isClaiming ? 'is-claim' : isAuctionActive ? 'is-active-auction' : ''
        }`}
      >

        {isWinnerOfClaim ? (
          <span>CLAIM / {getClaimTimeRemaining()}</span>
        ) : isClaiming ? (
          <span>CLAIMING / {getClaimTimeRemaining()}</span>
        ) : isAuctionActive ? (
          <span>{formatPrice(displayPrice)} SOL / {getAuctionTimeRemaining()}</span>
        ) : (
          <span>{formatPrice(displayPrice)} SOL</span>
        )}
      </div>

      {/* Main Visual Content */}
      <div className="slot-content">
        {hasCurrentAd ? (
          <>
            <img
              src={slot.currentAd!.imageUrl}
              alt={slot.currentAd!.title}
              className="slot-banner-img"
              onError={(e) => {
                (e.target as HTMLImageElement).src =
                  'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80';
              }}
            />
            <div className="slot-banner-overlay">
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-end',
                  width: '100%',
                  gap: '4px',
                }}
              >
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div
                    style={{
                      fontSize: slot.isCenter ? '13px' : '10px',
                      fontWeight: 500,
                      letterSpacing: '0.3px',
                      textShadow: '0 1px 3px rgba(0,0,0,0.9)',
                      lineHeight: 1.2,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {slot.currentAd!.title}
                  </div>
                  {reignStr && (
                    <div
                      style={{
                        fontSize: slot.isCenter ? '9px' : '7.5px',
                        fontWeight: 400,
                        letterSpacing: '0.4px',
                        color: '#d4d4d4',
                        textShadow: '0 1px 2px rgba(0,0,0,0.9)',
                        lineHeight: 1.1,
                        marginTop: '1px',
                        textTransform: 'uppercase',
                      }}
                    >
                      REIGN: {reignStr}
                    </div>
                  )}
                </div>

                {slot.currentAd!.link && (
                  <a
                    href={normalizeUrl(slot.currentAd!.link)}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      padding: '3px',
                      background: 'rgba(0,0,0,0.7)',
                      border: '0.5px solid rgba(255,255,255,0.4)',
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      borderRadius: '3px',
                    }}
                    title="Open link"
                  >
                    <ExternalLink size={9} />
                  </a>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="slot-empty-state">
            <Plus size={slot.isCenter ? 32 : 16} strokeWidth={1.5} color="#000000" />
          </div>
        )}
      </div>
    </div>
  );
};
