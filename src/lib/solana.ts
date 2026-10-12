import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  ComputeBudgetProgram,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

export const ESCROW_WALLET = 'BbZCeG2xcfade1J4GexqeoV3pMGEqPjxc3EX1Z7SYjmn';
export const TREASURY_WALLET = '9YZRbz3SQTFXsFa38J3hmBXaTnQ1WKB3jerZeAU7WP6n';
export const SOLANA_NETWORK = 'mainnet-beta';

// Reliable public RPC endpoints for Solana Mainnet (No 403 Origin blocks)
export const MAINNET_RPCS = [
  'https://solana-rpc.publicnode.com',
  typeof window !== 'undefined' ? `${window.location.origin}/api/rpc` : 'https://solana-rpc.publicnode.com',
];

export function getSolanaConnection(rpcUrl: string = MAINNET_RPCS[0]): Connection {
  return new Connection(rpcUrl, {
    commitment: 'confirmed',
    confirmTransactionInitialTimeout: 60000,
  });
}

/**
 * Fetch latest blockhash with fallback across reliable RPC endpoints
 */
export async function getLatestBlockhashWithFallback(): Promise<{
  blockhash: string;
  lastValidBlockHeight: number;
  connection: Connection;
}> {
  let lastErr: any = null;
  for (const rpcUrl of MAINNET_RPCS) {
    try {
      const conn = getSolanaConnection(rpcUrl);
      const res = await conn.getLatestBlockhash('confirmed');
      if (res?.blockhash) {
        return {
          blockhash: res.blockhash,
          lastValidBlockHeight: res.lastValidBlockHeight,
          connection: conn,
        };
      }
    } catch (err) {
      console.warn(`RPC ${rpcUrl} failed to get recent blockhash, trying next...`, err);
      lastErr = err;
    }
  }
  throw lastErr || new Error('Failed to get recent blockhash from Solana RPC.');
}

/**
 * Fetch real SOL balance on Solana Mainnet
 */
export async function fetchMainnetBalance(publicKeyStr: string): Promise<number> {
  const pubkey = new PublicKey(publicKeyStr);
  for (const rpcUrl of MAINNET_RPCS) {
    try {
      const conn = getSolanaConnection(rpcUrl);
      const lamports = await conn.getBalance(pubkey, 'confirmed');
      return Number((lamports / LAMPORTS_PER_SOL).toFixed(4));
    } catch (err) {
      console.warn(`RPC ${rpcUrl} failed for balance check, trying next...`, err);
    }
  }
  return 0;
}

/**
 * Execute real SOL payment to escrow on Solana Mainnet
 * Returns transaction signature string
 */
export async function sendMainnetPayment(
  provider: any,
  fromAddress: string,
  amountSol: number
): Promise<string> {
  if (!provider) {
    throw new Error('Wallet provider not found.');
  }

  const fromPubkey = new PublicKey(fromAddress);
  const toPubkey = new PublicKey(ESCROW_WALLET);
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  if (lamports <= 0) {
    throw new Error('Bid amount must be greater than 0.');
  }

  // Get recent blockhash using fallback
  const { blockhash, lastValidBlockHeight, connection: conn } =
    await getLatestBlockhashWithFallback();

  const transaction = new Transaction();

  // Add micro priority fee (~0.00001 SOL) to incentivize immediate inclusion in the next block
  try {
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 50000,
      })
    );
  } catch {}

  transaction.add(
    SystemProgram.transfer({
      fromPubkey,
      toPubkey,
      lamports,
    })
  );

  transaction.recentBlockhash = blockhash;
  transaction.feePayer = fromPubkey;

  let signature: string;

  if (typeof provider.signAndSendTransaction === 'function') {
    const res = await provider.signAndSendTransaction(transaction);
    signature = typeof res === 'string' ? res : res.signature;
  } else if (typeof provider.sendTransaction === 'function') {
    signature = await provider.sendTransaction(transaction, conn);
  } else if (typeof provider.signTransaction === 'function') {
    const signed = await provider.signTransaction(transaction);
    const rawTx = signed.serialize();
    signature = await conn.sendRawTransaction(rawTx, { skipPreflight: false });
  } else {
    throw new Error('Wallet provider does not support transaction signing.');
  }

  // Wait for confirmation on mainnet
  // Note: WebSocket on public RPCs often disconnects or drops, causing false "block height exceeded" errors
  // even when the transaction succeeded on-chain. We use a robust polling fallback with getSignatureStatus.
  let confirmed = false;
  const startTime = Date.now();
  const maxWaitMs = 45000;

  try {
    const confirmation = await conn.confirmTransaction(
      {
        signature,
        blockhash,
        lastValidBlockHeight,
      },
      'confirmed'
    );

    if (confirmation?.value?.err) {
      console.error('On-chain transaction error:', confirmation.value.err);
      const errObj = confirmation.value.err as any;
      if (errObj?.InsufficientFundsForRent) {
        throw new Error(
          'INSUFFICIENT FUNDS FOR SOLANA RENT RESERVE. Solana requires accounts to keep at least ~0.0009 SOL after transfer.'
        );
      }
      throw new Error(`ON-CHAIN TRANSACTION FAILED: ${JSON.stringify(confirmation.value.err)}`);
    }
    confirmed = true;
  } catch (confirmErr: any) {
    if (
      confirmErr?.message?.includes('INSUFFICIENT FUNDS') ||
      confirmErr?.message?.includes('ON-CHAIN TRANSACTION FAILED')
    ) {
      throw confirmErr;
    }
    console.warn(
      'conn.confirmTransaction error, falling back to HTTP getSignatureStatus polling:',
      confirmErr
    );
  }

  // If confirmTransaction threw (e.g. block height exceeded / WS drop), poll getSignatureStatus via HTTP
  if (!confirmed) {
    while (Date.now() - startTime < maxWaitMs) {
      try {
        const statusRes = await conn.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        const status = statusRes?.value;
        if (status) {
          if (status.err) {
            const errObj = status.err as any;
            if (errObj?.InsufficientFundsForRent) {
              throw new Error(
                'INSUFFICIENT FUNDS FOR SOLANA RENT RESERVE. Solana requires accounts to keep at least ~0.0009 SOL after transfer.'
              );
            }
            throw new Error(`ON-CHAIN TRANSACTION FAILED: ${JSON.stringify(status.err)}`);
          }
          if (
            status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized'
          ) {
            confirmed = true;
            break;
          }
        }
      } catch (e: any) {
        if (
          e?.message?.includes('INSUFFICIENT FUNDS') ||
          e?.message?.includes('ON-CHAIN TRANSACTION FAILED')
        ) {
          throw e;
        }
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }

  // Final fallback check across RPC endpoints
  if (!confirmed) {
    for (const rpcUrl of MAINNET_RPCS) {
      try {
        const fallbackConn = getSolanaConnection(rpcUrl);
        const statusRes = await fallbackConn.getSignatureStatus(signature, {
          searchTransactionHistory: true,
        });
        const status = statusRes?.value;
        if (
          status &&
          !status.err &&
          (status.confirmationStatus === 'confirmed' ||
            status.confirmationStatus === 'finalized')
        ) {
          confirmed = true;
          break;
        }
      } catch {}
    }
  }

  if (!confirmed) {
    throw new Error(
      'TRANSACTION CONFIRMATION TIMED OUT. Please check Solana Explorer for signature status.'
    );
  }

  return signature;
}
