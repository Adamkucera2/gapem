import React from 'react';
import { X, Wallet, ShieldCheck, Briefcase, CircleDollarSign, Globe } from 'lucide-react';
import type { SupportedWalletName } from '../types';

interface WalletConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (walletName: SupportedWalletName) => void;
}

interface WalletItem {
  id: SupportedWalletName;
  name: string;
  badge: string;
  iconBg: string;
  iconColor: string;
  icon: React.ReactNode;
}

export const WalletConnectModal: React.FC<WalletConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
}) => {
  if (!isOpen) return null;

  const walletOptions: WalletItem[] = [
    {
      id: 'phantom',
      name: 'PHANTOM WALLET',
      badge: 'BROWSER EXTENSION & MOBILE',
      iconBg: '#ab9ff2',
      iconColor: '#000000',
      icon: <Wallet size={15} color="#000000" />,
    },
    {
      id: 'solflare',
      name: 'SOLFLARE WALLET',
      badge: 'SOLANA NATIVE WALLET',
      iconBg: '#f97316',
      iconColor: '#000000',
      icon: <ShieldCheck size={15} color="#000000" />,
    },
    {
      id: 'backpack',
      name: 'BACKPACK WALLET',
      badge: 'CORAL & XNFT STANDARD',
      iconBg: '#e33e38',
      iconColor: '#ffffff',
      icon: <Briefcase size={15} color="#ffffff" />,
    },
    {
      id: 'coinbase',
      name: 'COINBASE WALLET',
      badge: 'SOLANA COMPATIBLE',
      iconBg: '#0052ff',
      iconColor: '#ffffff',
      icon: <CircleDollarSign size={15} color="#ffffff" />,
    },
    {
      id: 'okx',
      name: 'OKX WALLET',
      badge: 'MULTI-CHAIN WEB3 WALLET',
      iconBg: '#000000',
      iconColor: '#ffffff',
      icon: <Globe size={15} color="#ffffff" />,
    },
  ];

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '420px' }}>
        {/* Header */}
        <div className="modal-header">
          <div>
            <div className="modal-title">CONNECT SOLANA WALLET</div>
            <div style={{ fontSize: '10px', color: '#000000', marginTop: '2px', fontWeight: 500 }}>
              SOLANA MAINNET-BETA · CONNECT TO BID ON GAPEM
            </div>
          </div>
          <button className="btn-close" onClick={onClose}>
            <X size={14} />
          </button>
        </div>

        {/* Body */}
        <div className="modal-body" style={{ gap: '8px', maxHeight: '420px', overflowY: 'auto' }}>
          {walletOptions.map((w) => (
            <button
              key={w.id}
              onClick={() => onConnect(w.id)}
              style={{
                border: '0.5px solid #000000',
                padding: '10px 12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                background: '#ffffff',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
                borderRadius: '6px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.background = '#f5f5f5')}
              onMouseLeave={(e) => (e.currentTarget.style.background = '#ffffff')}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    border: '0.5px solid #000000',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: w.iconBg,
                    color: w.iconColor,
                    borderRadius: '4px',
                    flexShrink: 0,
                  }}
                >
                  {w.icon}
                </div>
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 600, color: '#000000' }}>{w.name}</div>
                  <div style={{ fontSize: '9px', color: '#555555', fontWeight: 500 }}>
                    {w.badge}
                  </div>
                </div>
              </div>
              <div style={{ fontSize: '10px', fontWeight: 600, color: '#000000' }}>[CONNECT]</div>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="modal-footer" style={{ flexDirection: 'column', gap: '3px', alignItems: 'center' }}>
          <div style={{ fontSize: '10px', color: '#000000', textAlign: 'center', fontWeight: 600 }}>
            GAPEM · GREATEST ADVERTISEMENT PLATFORM EVER MADE
          </div>
          <div style={{ fontSize: '8.5px', color: '#666666', textAlign: 'center', letterSpacing: '0.3px' }}>
            ZERO PERSONAL DATA STORED · NON-CUSTODIAL ESCROW · EPHEMERAL ASSETS
          </div>
        </div>
      </div>
    </div>
  );
};
