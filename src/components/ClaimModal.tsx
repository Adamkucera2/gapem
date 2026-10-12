import React, { useState, useEffect, useRef, useCallback } from 'react';
import type { AdSlot } from '../types';
import { X, Upload, Clock, Plus } from 'lucide-react';
import { normalizeUrl } from '../lib/initialData';

interface ClaimModalProps {
  slot: AdSlot | null;
  onClose: () => void;
  onPublishAd: (
    slotId: string,
    adData: { title: string; link: string; imageUrl: string }
  ) => void;
}

export const ClaimModal: React.FC<ClaimModalProps> = ({
  slot,
  onClose,
  onPublishAd,
}) => {
  if (!slot) return null;

  const [adTitle, setAdTitle] = useState<string>(
    slot.claimInfo?.draftTitle || '@ANONYMOUS'
  );
  const [adLink, setAdLink] = useState<string>(
    slot.claimInfo?.draftLink || ''
  );
  const [imageUrl, setImageUrl] = useState<string>(
    slot.claimInfo?.draftImageUrl ||
      'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80'
  );
  const [imagePreview, setImagePreview] = useState<string>(imageUrl);

  // Single-flight execution guard per claim
  const publishedRef = useRef<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Synchronized refs to avoid restarting the timer loop on every input keystroke
  const adTitleRef = useRef(adTitle);
  adTitleRef.current = adTitle;
  const adLinkRef = useRef(adLink);
  adLinkRef.current = adLink;
  const imagePreviewRef = useRef(imagePreview);
  imagePreviewRef.current = imagePreview;

  // Remaining claim time calculation
  const [secondsLeft, setSecondsLeft] = useState<number>(60);

  // Reset published flag when slot changes
  useEffect(() => {
    publishedRef.current = false;
    setIsSubmitting(false);
  }, [slot.id]);

  const executePublish = useCallback(() => {
    if (publishedRef.current) return;
    publishedRef.current = true;
    setIsSubmitting(true);

    onPublishAd(slot.id, {
      title: adTitleRef.current.trim() || '@CONQUEROR',
      link: normalizeUrl(adLinkRef.current.trim()),
      imageUrl: imagePreviewRef.current,
    });
    onClose();
  }, [slot.id, onPublishAd, onClose]);

  useEffect(() => {
    if (!slot.claimInfo?.claimExpiresAt) return;

    const updateTimer = () => {
      const diff = Math.max(
        0,
        Math.floor((slot.claimInfo!.claimExpiresAt - Date.now()) / 1000)
      );
      setSecondsLeft(diff);
      if (diff === 0 && !publishedRef.current) {
        executePublish();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [slot.id, slot.claimInfo?.claimExpiresAt, executePublish]);

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executePublish();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#000000' }}>
              <span>YOU WON {slot.name}!</span>
            </div>
            <div
              style={{
                fontSize: '10px',
                color: '#666666',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '2px',
                fontWeight: 500,
              }}
            >
              <Clock size={11} color="#000000" />
              <span>
                1-MINUTE GRACE WINDOW: {String(Math.floor(secondsLeft / 60)).padStart(2, '0')}:
                {String(secondsLeft % 60).padStart(2, '0')} REMAINING
              </span>
            </div>
          </div>
          <button
            className="btn-close"
            onClick={onClose}
          >
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <p style={{ fontSize: '11px', color: '#000000', fontWeight: 500, lineHeight: 1.5 }}>
              CONGRATULATIONS YOU GAPED THEM ALL CONFIGURE YOUR AD TITLE, DESTINATION LINK, AND IMAGE. THIS AD WILL STAY ON THE BILLBOARD UNTIL SOMEONE OUTBIDS YOU IN A FUTURE ROUND!
            </p>

            <div className="modal-bubble modal-bubble-draft" style={{ marginTop: '4px' }}>
              <div className="ad-draft-layout">
                {/* Left: Square 1:1 Preview Box */}
                <div className="ad-draft-preview-col">
                  <label
                    className="ad-square-preview-box"
                    title="CLICK TO UPLOAD BANNER IMAGE"
                  >
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="Live Preview"
                        className="ad-square-preview-img"
                        onError={() =>
                          setImagePreview(
                            'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80'
                          )
                        }
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

                {/* Right: Inputs */}
                <div className="ad-draft-inputs-col">
                  <div className="form-group">
                    <label className="form-label">PROJECT NAME / @HANDLE *</label>
                    <input
                      type="text"
                      value={adTitle}
                      onChange={(e) => setAdTitle(e.target.value)}
                      className="form-input"
                      required
                      maxLength={40}
                      autoFocus
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
          <div className="modal-footer" style={{ flexDirection: 'column', gap: '8px' }}>
            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-secondary"
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '11px',
                fontWeight: 700,
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? 'PUBLISHING...' : `PUBLISH AD TO BILLBOARD (${secondsLeft}S LEFT)`}
            </button>
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                `I JUST CLAIMED ${slot.name} ON GAPEM BILLBOARD ON SOLANA! CHECK IT OUT ON GAPEM.SOL`
              )}`}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary"
              style={{
                width: '100%',
                padding: '8px',
                fontSize: '10px',
                textAlign: 'center',
                textDecoration: 'none',
                display: 'block',
                boxSizing: 'border-box',
              }}
            >
              POST TO X
            </a>
          </div>
        </form>
      </div>
    </div>
  );
};
