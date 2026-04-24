'use client'
import {
  Connection,
  PublicKey,
  Transaction,
  SystemProgram,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
} from '@solana/web3.js'

// Devnet connection
export const connection = new Connection(
  clusterApiUrl('devnet'),
  'confirmed'
)

export type WalletAdapter = {
  publicKey: PublicKey | null
  signTransaction: (tx: Transaction) => Promise<Transaction>
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnected: boolean
}

export type ExecutionResult = {
  success: boolean
  signature?: string
  explorerUrl?: string
  error?: string
}

/** Get Phantom wallet from window */
export function getPhantomWallet(): WalletAdapter | null {
  if (typeof window === 'undefined') return null
  const phantom = (window as any)?.phantom?.solana
  if (!phantom?.isPhantom) return null
  return phantom
}

/** Connect Phantom wallet */
export async function connectWallet(): Promise<{
  wallet: WalletAdapter | null
  address: string | null
  error?: string
}> {
  try {
    const wallet = getPhantomWallet()
    if (!wallet) {
      return {
        wallet: null,
        address: null,
        error: 'Phantom wallet not found. Please install it from phantom.app'
      }
    }

    await wallet.connect()
    const address = wallet.publicKey?.toBase58() ?? null

    return { wallet, address }
  } catch (err) {
    return {
      wallet: null,
      address: null,
      error: String(err)
    }
  }
}

/** Check wallet SOL balance on devnet */
export async function getBalance(
  address: string
): Promise<number> {
  try {
    const pubkey = new PublicKey(address)
    const balance = await connection.getBalance(pubkey)
    return balance / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

/** 
 * Execute LP position on Devnet
 * 
 * For the hackathon demo, we execute a real SOL transfer
 * transaction on Devnet to demonstrate the full 
 * wallet → sign → confirm → explorer flow.
 * 
 * In production this would call Meteora/Orca SDK
 * to actually add liquidity to the pool.
 */
export async function executeLPPosition(
  wallet: WalletAdapter,
  poolAddress: string,
  capitalUSD: number,
  solPrice: number = 150
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { 
        success: false, 
        error: 'Wallet not connected' 
      }
    }

    // Calculate SOL amount (small demo amount)
    // Use 0.01 SOL as demo regardless of capital
    // Real implementation would use actual capital
    const solAmount = 0.01
    const lamports = Math.floor(
      solAmount * LAMPORTS_PER_SOL
    )

    // Get recent blockhash
    const { blockhash, lastValidBlockHeight } = 
      await connection.getLatestBlockhash()

    // Build transaction
    // Demo: transfer small amount to self
    // Real: call Meteora/Orca add_liquidity instruction
    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    }).add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports,
      })
    )

    // Request signature from Phantom
    const signed = await wallet.signTransaction(transaction)

    // Send to Devnet
    const signature = await connection.sendRawTransaction(
      signed.serialize(),
      { skipPreflight: false }
    )

    // Confirm transaction
    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    })

    const explorerUrl = 
      `https://explorer.solana.com/tx/${signature}` +
      `?cluster=devnet`

    console.log('[solana] tx confirmed:', signature)
    console.log('[solana] explorer:', explorerUrl)

    return {
      success: true,
      signature,
      explorerUrl,
    }

  } catch (err) {
    console.error('[solana] execution error:', err)
    return {
      success: false,
      error: String(err)
    }
  }
}
