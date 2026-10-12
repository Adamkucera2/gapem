import { INITIAL_SLOTS } from './lib/initialData';
import type { AdSlot } from './types';
import { refundOutbidUser, sweepWinningBidToTreasury } from './lib/escrowRefund';

interface KVNamespace {
  get(key: string, type?: 'text' | 'json' | 'arrayBuffer' | 'stream'): Promise<any>;
  put(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

interface Env {
  GAPEM_KV: KVNamespace;
  ESCROW_SECRET_KEY?: string;
  ASSETS: {
    fetch: typeof fetch;
  };
}

const STORAGE_KEY = 'gapem_slots_state_mainnet_v1';

interface SweepItem {
  slotId: string;
  amountSol: number;
}

// Helper to synchronize auction countdowns and claims on-the-fly
function resolveSlots(slots: AdSlot[]): {
  updatedSlots: AdSlot[];
  hasChanges: boolean;
  sweepsToExecute: SweepItem[];
} {
  const now = Date.now();
  let hasChanges = false;
  const sweepsToExecute: SweepItem[] = [];

  const updatedSlots = slots.map((slot) => {
    // 1. Check if auction concluded
    if (slot.activeAuction?.isActive && now >= slot.activeAuction.endsAt) {
      hasChanges = true;
      const winnerWallet = slot.activeAuction.highestBidder;
      const pricePaid = slot.activeAuction.highestBid;

      if (pricePaid > 0) {
        sweepsToExecute.push({ slotId: slot.id, amountSol: pricePaid });
      }

      return {
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
          sweptToTreasury: true,
        },
      };
    }

    // 2. Check if claim period expired -> auto publish
    if (slot.claimInfo?.isClaiming && now >= slot.claimInfo.claimExpiresAt) {
      hasChanges = true;
      const isAlreadySwept = slot.claimInfo.sweptToTreasury;
      if (!isAlreadySwept && slot.claimInfo.pricePaid > 0) {
        sweepsToExecute.push({ slotId: slot.id, amountSol: slot.claimInfo.pricePaid });
      }

      return {
        ...slot,
        currentAd: {
          title: slot.claimInfo.draftTitle || '@ANONYMOUS',
          link: slot.claimInfo.draftLink || '',
          imageUrl: slot.claimInfo.draftImageUrl,
          owner: slot.claimInfo.winnerWallet,
          priceSol: slot.claimInfo.pricePaid,
          acquiredAt: now,
          sweptToTreasury: true,
        },
        claimInfo: null,
      };
    }

    // 3. Catch existing won ads that haven't been swept to Treasury yet
    if (slot.currentAd && !slot.currentAd.sweptToTreasury && slot.currentAd.priceSol > 0) {
      hasChanges = true;
      sweepsToExecute.push({ slotId: slot.id, amountSol: slot.currentAd.priceSol });
      return {
        ...slot,
        currentAd: {
          ...slot.currentAd,
          sweptToTreasury: true,
        },
      };
    }

    return slot;
  });

  return { updatedSlots, hasChanges, sweepsToExecute };
}

async function handleSweeps(sweeps: SweepItem[], secretKey?: string) {
  for (const sweep of sweeps) {
    console.log(`[SWEEP TO TREASURY] Sweeping ${sweep.amountSol} SOL for slot ${sweep.slotId} to Treasury...`);
    try {
      await sweepWinningBidToTreasury(sweep.amountSol, secretKey);
    } catch (err) {
      console.error(`[SWEEP ERROR] Failed to sweep slot ${sweep.slotId}:`, err);
    }
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Force HTTPS redirect if accessed via HTTP
    if (url.protocol === 'http:' && !url.hostname.includes('localhost') && !url.hostname.includes('127.0.0.1')) {
      return Response.redirect(`https://${url.host}${url.pathname}${url.search}`, 301);
    }

    // API Routes
    if (url.pathname.startsWith('/api/')) {
      const corsHeaders = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-admin-key',
        'Content-Type': 'application/json',
      };

      if (request.method === 'OPTIONS') {
        return new Response(null, { headers: corsHeaders });
      }

      // 1. GET /api/slots
      if (url.pathname === '/api/slots' && request.method === 'GET') {
        let raw = (await env.GAPEM_KV.get(STORAGE_KEY, 'json')) as AdSlot[] | null;
        if (!raw || !Array.isArray(raw) || raw.length === 0) {
          raw = INITIAL_SLOTS;
          await env.GAPEM_KV.put(STORAGE_KEY, JSON.stringify(raw));
        }

        const { updatedSlots, hasChanges, sweepsToExecute } = resolveSlots(raw);
        if (hasChanges) {
          await env.GAPEM_KV.put(STORAGE_KEY, JSON.stringify(updatedSlots));
        }
        if (sweepsToExecute.length > 0) {
          await handleSweeps(sweepsToExecute, env.ESCROW_SECRET_KEY);
        }

        return new Response(JSON.stringify({ slots: updatedSlots, serverTime: Date.now() }), {
          headers: corsHeaders,
        });
      }

      // 2. POST /api/bid
      if (url.pathname === '/api/bid' && request.method === 'POST') {
        try {
          const body = (await request.json()) as {
            slotId: string;
            bidAmount: number;
            adDraft: { title: string; link: string; imageUrl: string };
            bidderWallet: string;
          };

          let raw = (await env.GAPEM_KV.get(STORAGE_KEY, 'json')) as AdSlot[] | null;
          if (!raw) raw = INITIAL_SLOTS;

          const { updatedSlots, sweepsToExecute } = resolveSlots(raw);
          if (sweepsToExecute.length > 0) {
            await handleSweeps(sweepsToExecute, env.ESCROW_SECRET_KEY);
          }
          const targetIndex = updatedSlots.findIndex((s) => s.id === body.slotId);

          if (targetIndex === -1) {
            return new Response(JSON.stringify({ error: 'Slot not found' }), {
              status: 404,
              headers: corsHeaders,
            });
          }

          const slot = updatedSlots[targetIndex];
          const currentPrice = slot.activeAuction
            ? slot.activeAuction.highestBid
            : slot.currentAd
            ? slot.currentAd.priceSol
            : 0.001;

          if (body.bidAmount < currentPrice) {
            return new Response(JSON.stringify({ error: 'Bid too low' }), {
              status: 400,
              headers: corsHeaders,
            });
          }

          // Escrow automated refund for outbid bidder
          const previousBidder = slot.activeAuction?.highestBidder;
          const previousBidAmount = slot.activeAuction?.highestBid || 0;
          let refundTxSignature: string | undefined;

          if (
            slot.activeAuction?.isActive &&
            previousBidder &&
            previousBidder !== 'ANONYMOUS' &&
            previousBidder !== body.bidderWallet &&
            previousBidAmount > 0
          ) {
            console.log(
              `[ESCROW OUTBID] Outbidding ${previousBidder} (${previousBidAmount} SOL). Issuing refund...`
            );
            try {
              const refundRes = await refundOutbidUser(
                previousBidder,
                previousBidAmount,
                env.ESCROW_SECRET_KEY
              );
              if (refundRes.success) {
                refundTxSignature = refundRes.signature;
                console.log(`[ESCROW OUTBID] Refund sent! Tx: ${refundTxSignature}`);
              } else {
                console.warn('[ESCROW OUTBID] Refund notice:', refundRes.error);
              }
            } catch (refundErr) {
              console.error('[ESCROW OUTBID] Refund exception:', refundErr);
            }
          }

          // 2-minute auction round with Anti-Snipe (+20s if within last 20s)
          const now = Date.now();
          const isOngoing = !!slot.activeAuction?.isActive;
          let endsAt = isOngoing ? slot.activeAuction!.endsAt : now + 2 * 60 * 1000;
          if (isOngoing && endsAt - now < 20000) {
            endsAt = now + 20000;
          }

          updatedSlots[targetIndex] = {
            ...slot,
            activeAuction: {
              isActive: true,
              highestBid: body.bidAmount,
              highestBidder: body.bidderWallet || 'ANONYMOUS',
              endsAt,
              bidsCount: slot.activeAuction ? slot.activeAuction.bidsCount + 1 : 1,
              draftTitle: body.adDraft?.title || '@ANONYMOUS',
              draftLink: body.adDraft?.link || '',
              draftImageUrl:
                body.adDraft?.imageUrl ||
                'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
            },
          };

          await env.GAPEM_KV.put(STORAGE_KEY, JSON.stringify(updatedSlots));

          return new Response(
            JSON.stringify({
              success: true,
              slot: updatedSlots[targetIndex],
              slots: updatedSlots,
              refundTxSignature,
            }),
            { headers: corsHeaders }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 3. POST /api/publish
      if (url.pathname === '/api/publish' && request.method === 'POST') {
        try {
          const body = (await request.json()) as {
            slotId: string;
            adData: { title: string; link: string; imageUrl: string };
            ownerWallet: string;
          };

          let raw = (await env.GAPEM_KV.get(STORAGE_KEY, 'json')) as AdSlot[] | null;
          if (!raw) raw = INITIAL_SLOTS;

          const { updatedSlots, sweepsToExecute } = resolveSlots(raw);
          if (sweepsToExecute.length > 0) {
            await handleSweeps(sweepsToExecute, env.ESCROW_SECRET_KEY);
          }
          const targetIndex = updatedSlots.findIndex((s) => s.id === body.slotId);

          if (targetIndex === -1) {
            return new Response(JSON.stringify({ error: 'Slot not found' }), {
              status: 404,
              headers: corsHeaders,
            });
          }

          const slot = updatedSlots[targetIndex];
          const finalPrice = slot.claimInfo?.pricePaid || slot.currentAd?.priceSol || 0.5;

          updatedSlots[targetIndex] = {
            ...slot,
            currentAd: {
              title: body.adData.title || '@ANONYMOUS',
              link: body.adData.link || '',
              imageUrl:
                body.adData.imageUrl ||
                'https://images.unsplash.com/photo-1639762681485-074b7f938ba0?auto=format&fit=crop&w=800&q=80',
              owner: body.ownerWallet || 'ANONYMOUS',
              priceSol: finalPrice,
              acquiredAt: Date.now(),
            },
            claimInfo: null,
          };

          await env.GAPEM_KV.put(STORAGE_KEY, JSON.stringify(updatedSlots));

          return new Response(
            JSON.stringify({ success: true, slot: updatedSlots[targetIndex], slots: updatedSlots }),
            { headers: corsHeaders }
          );
        } catch (err: any) {
          return new Response(JSON.stringify({ error: err?.message || 'Server error' }), {
            status: 500,
            headers: corsHeaders,
          });
        }
      }

      // 4. POST /api/reset (protected admin reset)
      if (url.pathname === '/api/reset' && request.method === 'POST') {
        const auth = request.headers.get('Authorization') || request.headers.get('x-admin-key');
        if (!auth || !env.ESCROW_SECRET_KEY || auth !== `Bearer ${env.ESCROW_SECRET_KEY}`) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 403,
            headers: corsHeaders,
          });
        }
        await env.GAPEM_KV.put(STORAGE_KEY, JSON.stringify(INITIAL_SLOTS));
        return new Response(JSON.stringify({ success: true, slots: INITIAL_SLOTS }), {
          headers: corsHeaders,
        });
      }

      // 5. POST /api/rpc (Solana RPC Proxy bypassing 403 Origin restrictions)
      if (url.pathname === '/api/rpc' && request.method === 'POST') {
        try {
          const body = await request.text();
          const rpcRes = await fetch('https://solana-rpc.publicnode.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body,
          });
          const data = await rpcRes.text();
          return new Response(data, {
            status: rpcRes.status,
            headers: corsHeaders,
          });
        } catch (rpcErr: any) {
          return new Response(JSON.stringify({ error: rpcErr?.message || 'RPC proxy error' }), {
            status: 502,
            headers: corsHeaders,
          });
        }
      }

      return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    // Serve static assets
    return env.ASSETS.fetch(request);
  },
};
