import React, { useState, useEffect, useRef } from 'react';
import type { AdSlot, WalletState } from '../types';
import { X, Upload, ExternalLink, Plus, GripHorizontal } from 'lucide-react';
import { formatReignDuration, normalizeUrl } from '../lib/initialData';

interface BidModalProps {
  slot: AdSlot | null;
  wallet: WalletState;
  onClose: () => void;
  onSubmitBid: (
    slotId: string,
    bidAmount: number,
    adDraft: { title: string; link: string; imageUrl: string }
  ) => void;
  onConnectWallet: () => void;
  zIndex?: number;
  onFocus?: () => void;
  stackIndex?: number;
}

export const BidModal: React.FC<BidModalProps> = ({
  slot,
  wallet,
  onClose,
  onSubmitBid,
  onConnectWallet,
  zIndex = 150,
  onFocus,
  stackIndex = 0,
}) => {
  if (!slot) return null;

  const hasExistingBidOrPrice =
    (slot.activeAuction && slot.activeAuction.highestBid > 0) ||
    (slot.currentAd && slot.currentAd.priceSol > 0);

  const currentPrice = slot.activeAuction
    ? slot.activeAuction.highestBid
    : slot.currentAd
    ? slot.currentAd.priceSol
    : 0.001;

  const minBid = hasExistingBidOrPrice
    ? Number((currentPrice + 0.001).toFixed(3))
    : 0.001;

  const formatSol = (num: number) => {
    return num < 0.01 ? num.toFixed(3) : num.toFixed(2);
  };

  const [bidAmount, setBidAmount] = useState<number>(minBid);
  const [adTitle, setAdTitle] = useState<string>('');
  const [adLink, setAdLink] = useState<string>('');
  const [imageUrl, setImageUrl] = useState<string>('');
  const [imagePreview, setImagePreview] = useState<string>('');
  const [isSuccessFeedback, setIsSuccessFeedback] = useState(false);

  const [auctionTimeLeft, setAuctionTimeLeft] = useState<string>('');

  // Keep track of which slot was open to only reset when switching to a DIFFERENT slot
  const lastSlotIdRef = useRef<string | null>(null);

  // Floating draggable window positioning & dimmed backdrop state
  const [hasMoved, setHasMoved] = useState<boolean>(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const isDraggingRef = useRef(false);
  const dragStartRef = useRef<{ clientX: number; clientY: number; posX: number; posY: number } | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!slot) return;
    if (slot.id !== lastSlotIdRef.current) {
      lastSlotIdRef.current = slot.id;
      setBidAmount(minBid);
      setAdTitle('');
      setAdLink('');
      setImageUrl('');
      setImagePreview('');
      setHasMoved(false);

      const isMobileScreen = typeof window !== 'undefined' && window.innerWidth <= 600;
      const panelWidth = Math.min(420, window.innerWidth - 20);
      const panelHeight = Math.min(620, window.innerHeight - 30);
      const cascadeOffset = isMobileScreen ? 0 : (stackIndex % 5) * 28;
      const startX = isMobileScreen
        ? Math.max(10, Math.floor((window.innerWidth - panelWidth) / 2))
        : Math.max(
            12,
            Math.min(
              window.innerWidth - panelWidth - 12,
              Math.floor((window.innerWidth - panelWidth) / 2) + cascadeOffset
            )
          );
      const startY = Math.max(
        10,
        Math.min(
          window.innerHeight - panelHeight - 10,
          Math.floor((window.innerHeight - panelHeight) / 2) + (isMobileScreen ? 0 : cascadeOffset)
        )
      );
      setPosition({ x: startX, y: startY });
    } else {
      // Same slot updated (e.g. after placing bid) -> update to new minimum bid
      setBidAmount(minBid);
    }
  }, [slot?.id, minBid, stackIndex]);

  const handlePointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    if (onFocus) onFocus();
    const rect = panelRef.current?.getBoundingClientRect();
    const currentX = rect ? rect.left : (position?.x ?? 20);
    const currentY = rect ? rect.top : (position?.y ?? 20);

    isDraggingRef.current = true;
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      posX: currentX,
      posY: currentY,
    };
    try {
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    } catch {}
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current || !dragStartRef.current) return;
    const dx = e.clientX - dragStartRef.current.clientX;
    const dy = e.clientY - dragStartRef.current.clientY;

    // Movement in any direction: once moved, reveal the original background
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
      setHasMoved(true);
    }

    const panelWidth = panelRef.current?.offsetWidth || Math.min(420, window.innerWidth - 20);
    // Free movement anywhere across the screen, strictly clamped within screen bounds
    const newX = Math.max(10, Math.min(window.innerWidth - panelWidth - 10, dragStartRef.current.posX + dx));
    const newY = Math.max(10, Math.min(window.innerHeight - 80, dragStartRef.current.posY + dy));

    setPosition({ x: newX, y: newY });
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    isDraggingRef.current = false;
    dragStartRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  useEffect(() => {
    if (!slot.activeAuction?.isActive || !slot.activeAuction?.endsAt) {
      setAuctionTimeLeft('');
      return;
    }
    const updateCountdown = () => {
      const diff = Math.max(0, Math.floor((slot.activeAuction!.endsAt - Date.now()) / 1000));
      const mins = Math.floor(diff / 60);
      const secs = diff % 60;
      setAuctionTimeLeft(`${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
    };
    updateCountdown();
    const iv = setInterval(updateCountdown, 1000);
    return () => clearInterval(iv);
  }, [slot]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        setImageUrl(result);
        setImagePreview(result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUrlChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setImageUrl(e.target.value);
    setImagePreview(e.target.value);
  };

  const handleQuickAdd = (increment: number) => {
    setBidAmount((prev) => Number((prev + increment).toFixed(3)));
  };

  const canAfford = wallet.connected && wallet.balanceSol >= bidAmount;
  const isValidBid = bidAmount >= minBid;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!wallet.connected) {
      onConnectWallet();
      return;
    }
    if (!isValidBid || !canAfford || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await onSubmitBid(slot.id, bidAmount, {
        title: adTitle || '@ANONYMOUS',
        link: normalizeUrl(adLink),
        imageUrl:
          imagePreview ||
          'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
      });

      setIsSuccessFeedback(true);
      setTimeout(() => {
        setIsSuccessFeedback(false);
      }, 2500);
    } catch (err) {
      console.error('Bid submit error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className={`modal-backdrop floating-window-overlay ${hasMoved ? 'is-undimmed' : 'is-dimmed'}`}
      style={{ zIndex: zIndex - 1 }}
      onClick={!hasMoved ? onClose : undefined}
    >
      <div
        ref={panelRef}
        className="modal-windows-stack draggable-popup-panel"
        style={
          typeof window !== 'undefined' && window.innerWidth <= 600 && !hasMoved
            ? {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: 'calc(100vw - 20px)',
                maxWidth: '420px',
                boxSizing: 'border-box',
                zIndex: zIndex,
              }
            : position
            ? {
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                margin: 0,
                transform: 'none',
                width: typeof window !== 'undefined' && window.innerWidth <= 600 ? 'calc(100vw - 20px)' : undefined,
                maxWidth: typeof window !== 'undefined' && window.innerWidth <= 600 ? '420px' : '440px',
                boxSizing: 'border-box',
                zIndex: zIndex,
              }
            : {
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: typeof window !== 'undefined' && window.innerWidth <= 600 ? 'calc(100vw - 20px)' : undefined,
                maxWidth: typeof window !== 'undefined' && window.innerWidth <= 600 ? '420px' : '440px',
                boxSizing: 'border-box',
                zIndex: zIndex,
              }
        }
        onPointerDownCapture={() => {
          if (onFocus) onFocus();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* WINDOW 1: CURRENT OWNER / HOLDER */}
        <div className="modal-dialog modal-window-owner">
          <div
            className="modal-header modal-drag-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            title="DRAG TO MOVE WINDOW"
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <GripHorizontal size={14} color="#000000" />
              <div className="modal-title">OWNER</div>
            </div>
            <button className="btn-close" onClick={onClose} title="CLOSE WINDOW">
              <X size={14} />
            </button>
          </div>

          <div className="modal-window-body">
            {slot.currentAd ? (
              <div className="bubble-content-row">
                <div className="bubble-thumb-box">
                  <img
                    src={slot.currentAd.imageUrl}
                    alt={slot.currentAd.title}
                    className="bubble-thumb-img"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src =
                        'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=400&q=80';
                    }}
                  />
                </div>

                <div className="bubble-info-col">
                  <div className="bubble-title-row">
                    <span className="bubble-main-title">
                      {slot.currentAd.title || `@${slot.currentAd.owner.slice(0, 6)}`}
                    </span>
                    {slot.currentAd.acquiredAt && (
                      <span className="bubble-tag-reign">
                        · REIGN {formatReignDuration(slot.currentAd.acquiredAt)}
                      </span>
                    )}
                  </div>

                  {slot.currentAd.link ? (
                    <a
                      href={normalizeUrl(slot.currentAd.link)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="bubble-link"
                      title="VISIT HOLDER WEBSITE"
                    >
                      <span>{slot.currentAd.link}</span>
                      <ExternalLink size={10} />
                    </a>
                  ) : (
                    <span className="bubble-no-link">NO DESTINATION LINK SPECIFIED</span>
                  )}
                </div>
              </div>
            ) : (
              <div className="bubble-content-row is-empty">
                <div className="bubble-thumb-box is-empty">
                  <Plus size={16} color="#000000" />
                </div>
                <div className="bubble-info-col">
                  <span className="bubble-main-title">{slot.name} · UNCLAIMED</span>
                  <span className="bubble-no-link">BE THE FIRST TO CLAIM THIS BILLBOARD SPACE</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* WINDOW 2: BID SYSTEM */}
        <div className="modal-dialog modal-window-bid">
          <div
            className="modal-header modal-drag-handle"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            title="DRAG TO MOVE WINDOW"
          >
            <div>
              <div className="modal-title">BID FOR {slot.name}</div>
              <div style={{ fontSize: '10px', color: '#000000', marginTop: '2px', fontWeight: 500 }}>
                {slot.activeAuction?.isActive
                  ? 'AUCTION IN PROGRESS · 2-MIN ROUND'
                  : 'STARTS 2-MINUTE AUCTION FOR THIS SLOT'}
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="modal-body">
              {/* BUBBLE 1: BIDDING / AUCTION */}
              <div className="modal-bubble modal-bubble-bid">
                <div className="modal-bubble-header-row">
                  <span className="modal-bubble-label">
                    {slot.activeAuction?.isActive ? 'ACTIVE AUCTION' : 'BIDDING'}
                  </span>
                  <div className="bubble-badges-group">
                    <span className="bubble-badge-price">
                      BID: {formatSol(currentPrice)} SOL
                    </span>
                    {auctionTimeLeft && (
                      <span className="bubble-badge-timer">{auctionTimeLeft} LEFT</span>
                    )}
                    <span className="bubble-badge-min">
                      MIN: {formatSol(minBid)} SOL
                    </span>
                  </div>
                </div>

                {/* Bid Amount Input */}
                <div className="form-group" style={{ marginTop: '6px' }}>
                  <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>YOUR BID AMOUNT (SOL)</span>
                    <span>MIN: {formatSol(minBid)} SOL</span>
                  </label>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <input
                      type="number"
                      step="0.001"
                      min={minBid}
                      value={bidAmount}
                      onChange={(e) => setBidAmount(parseFloat(e.target.value) || minBid)}
                      className="form-input"
                      style={{ flex: 1 }}
                      required
                    />
                    <div className="sol-badge-addon">SOL</div>
                  </div>

                  {/* Quick Add Buttons */}
                  <div className="quick-bids" style={{ marginTop: '6px' }}>
                    <button type="button" className="quick-bid-btn" onClick={() => handleQuickAdd(0.001)}>
                      +0.001 SOL
                    </button>
                    <button type="button" className="quick-bid-btn" onClick={() => handleQuickAdd(0.005)}>
                      +0.005 SOL
                    </button>
                    <button type="button" className="quick-bid-btn" onClick={() => handleQuickAdd(0.01)}>
                      +0.010 SOL
                    </button>
                    <button type="button" className="quick-bid-btn" onClick={() => handleQuickAdd(0.05)}>
                      +0.050 SOL
                    </button>
                  </div>

                  {wallet.connected && (
                    <div className="form-hint" style={{ color: canAfford ? 'inherit' : '#b91c1c', marginTop: '6px' }}>
                      WALLET BALANCE: {wallet.balanceSol < 0.01 ? wallet.balanceSol.toFixed(4) : wallet.balanceSol.toFixed(3)} SOL{' '}
                      {!canAfford && '(INSUFFICIENT FUNDS)'}
                    </div>
                  )}
                </div>
              </div>

              {/* BUBBLE 2: YOUR AD DETAILS */}
              <div className="modal-bubble modal-bubble-draft">
                <div className="modal-bubble-label">
                  YOUR AD DETAILS
                </div>

                <div className="ad-draft-layout">
                  {/* Square 1:1 Preview Box on the Left */}
                  <div className="ad-draft-preview-col">
                    <label
                      className="ad-square-preview-box"
                      title="CLICK TO UPLOAD BANNER IMAGE"
                    >
                      {imagePreview ? (
                        <img
                          src={imagePreview}
                          alt="Draft Preview"
                          className="ad-square-preview-img"
                          onError={() => setImagePreview('')}
                        />
                      ) : (
                        <div className="ad-square-placeholder">
                          <Plus size={22} strokeWidth={2} color="#000000" />
                        </div>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleFileUpload}
                        style={{ display: 'none' }}
                      />
                    </label>
                  </div>

                  {/* Form Fields Stacked on the Right */}
                  <div className="ad-draft-inputs-col">
                    <div className="form-group">
                      <label className="form-label">PROJECT NAME / @HANDLE</label>
                      <input
                        type="text"
                        value={adTitle}
                        onChange={(e) => setAdTitle(e.target.value)}
                        className="form-input"
                        maxLength={40}
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">LINK / URL</label>
                      <input
                        type="text"
                        value={adLink}
                        onChange={(e) => setAdLink(e.target.value)}
                        placeholder="e.g. gapem.lol or https://..."
                        className="form-input"
                      />
                    </div>

                    <div className="form-group">
                      <label className="form-label">BANNER IMAGE URL / FILE</label>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        <input
                          type="text"
                          value={imageUrl}
                          onChange={handleUrlChange}
                          placeholder="e.g. image URL or click FILE"
                          className="form-input"
                          style={{ flex: 1, minWidth: 0 }}
                        />
                        <label className="btn-upload-label">
                          <Upload size={11} />
                          <span>FILE</span>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={handleFileUpload}
                            style={{ display: 'none' }}
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="modal-footer">
              <button type="button" className="btn-secondary" onClick={onClose}>
                CANCEL
              </button>

              {!wallet.connected ? (
                <button
                  type="button"
                  className="btn-primary"
                  onClick={onConnectWallet}
                >
                  CONNECT WALLET TO BID
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!isValidBid || !canAfford || isSubmitting}
                >
                  {isSuccessFeedback
                    ? 'BID PLACED & FUNDS SENT!'
                    : isSubmitting
                    ? 'APPROVE TX IN WALLET...'
                    : `SIGN & PLACE BID: ${formatSol(bidAmount)} SOL`}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
