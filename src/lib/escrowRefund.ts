import {
  Connection,
  Keypair,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';
// @ts-ignore
import bs58 from 'bs58';

// Dedicated GAPEM Escrow Wallet for holding active bids & automated on-chain refunds
export const ESCROW_PUBLIC_KEY = 'BbZCeG2xcfade1J4GexqeoV3pMGEqPjxc3EX1Z7SYjmn';

const RPC_URLS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
];

export async function refundOutbidUser(
  recipientAddress: string,
  amountSol: number,
  escrowSecretBase58?: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    if (!escrowSecretBase58) {
      console.warn('[ESCROW REFUND] ESCROW_SECRET_KEY secret is not configured in worker environment.');
      return { success: false, error: 'Escrow secret key missing' };
    }

    if (!recipientAddress || recipientAddress.length < 32 || recipientAddress === 'ANONYMOUS') {
      return { success: false, error: 'Invalid recipient address' };
    }

    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    const secretBytes = bs58.decode(escrowSecretBase58.trim());
    const escrowKeypair = Keypair.fromSecretKey(secretBytes);
    const toPubkey = new PublicKey(recipientAddress);

    let lastErr: any = null;

    for (const rpc of RPC_URLS) {
      try {
        const conn = new Connection(rpc, 'confirmed');
        const { blockhash } = await conn.getLatestBlockhash('confirmed');

        const tx = new Transaction();
        try {
          tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 50000,
            })
          );
        } catch {}

        tx.add(
          SystemProgram.transfer({
            fromPubkey: escrowKeypair.publicKey,
            toPubkey,
            lamports,
          })
        );

        tx.recentBlockhash = blockhash;
        tx.feePayer = escrowKeypair.publicKey;
        tx.sign(escrowKeypair);

        const signature = await conn.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
        });

        console.log(
          `[ESCROW REFUND SUCCESS] Refunded ${amountSol} SOL to ${recipientAddress}. Tx: ${signature}`
        );
        return { success: true, signature };
      } catch (err: any) {
        console.warn(`[ESCROW REFUND] RPC ${rpc} failed:`, err);
        lastErr = err;
      }
    }

    return {
      success: false,
      error: lastErr?.message || 'Failed to broadcast refund transaction',
    };
  } catch (err: any) {
    console.error('[ESCROW REFUND FATAL ERROR]:', err);
    return { success: false, error: err?.message || 'Unexpected refund error' };
  }
}

export const TREASURY_WALLET = '9YZRbz3SQTFXsFa38J3hmBXaTnQ1WKB3jerZeAU7WP6n';

export async function sweepWinningBidToTreasury(
  amountSol: number,
  escrowSecretBase58?: string
): Promise<{ success: boolean; signature?: string; error?: string }> {
  try {
    if (!escrowSecretBase58) {
      console.warn('[SWEEP TO TREASURY] ESCROW_SECRET_KEY secret is not configured in worker environment.');
      return { success: false, error: 'Escrow secret key missing' };
    }

    const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);
    if (lamports <= 0) {
      return { success: false, error: 'Amount must be greater than 0' };
    }

    const secretBytes = bs58.decode(escrowSecretBase58.trim());
    const escrowKeypair = Keypair.fromSecretKey(secretBytes);
    const toPubkey = new PublicKey(TREASURY_WALLET);

    let lastErr: any = null;

    for (const rpc of RPC_URLS) {
      try {
        const conn = new Connection(rpc, 'confirmed');
        const { blockhash } = await conn.getLatestBlockhash('confirmed');

        const tx = new Transaction();
        try {
          tx.add(
            ComputeBudgetProgram.setComputeUnitPrice({
              microLamports: 50000,
            })
          );
        } catch {}

        tx.add(
          SystemProgram.transfer({
            fromPubkey: escrowKeypair.publicKey,
            toPubkey,
            lamports,
          })
        );

        tx.recentBlockhash = blockhash;
        tx.feePayer = escrowKeypair.publicKey;
        tx.sign(escrowKeypair);

        const signature = await conn.sendRawTransaction(tx.serialize(), {
          skipPreflight: false,
        });

        console.log(
          `[SWEEP TO TREASURY SUCCESS] Transferred ${amountSol} SOL to Treasury (${TREASURY_WALLET}). Tx: ${signature}`
        );
        return { success: true, signature };
      } catch (err: any) {
        console.warn(`[SWEEP TO TREASURY] RPC ${rpc} failed:`, err);
        lastErr = err;
      }
    }

    return {
      success: false,
      error: lastErr?.message || 'Failed to broadcast sweep transaction',
    };
  } catch (err: any) {
    console.error('[SWEEP TO TREASURY FATAL ERROR]:', err);
    return { success: false, error: err?.message || 'Unexpected sweep error' };
  }
}
