import React from 'react';
import { Lock, Plus } from 'lucide-react';
import type { RingSlot } from '../types';

interface RingSlotCardProps {
  slot: RingSlot;
  isUnlocked: boolean;
  onClick: (slot: RingSlot) => void;
}

export const RingSlotCard: React.FC<RingSlotCardProps> = ({ slot, isUnlocked, onClick }) => {
  return (
    <div
      className={`ring-slot-card ${isUnlocked ? 'is-active' : 'is-inactive-gray'}`}
      onClick={() => onClick(slot)}
      title={
        isUnlocked
          ? `OUTER RING SLOT ${slot.label} · UNLOCKED`
          : `LOCKED · UNLOCKS WHEN ALL 13 VIP SLOTS ARE OCCUPIED`
      }
    >
      {isUnlocked ? (
        <Plus size={11} strokeWidth={1.8} color="currentColor" />
      ) : (
        <Lock size={11} strokeWidth={1.8} color="currentColor" />
      )}
    </div>
  );
};

