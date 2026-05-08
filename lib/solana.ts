'use client'
import {
  Connection,
  PublicKey,
  Transaction,
  Keypair,
  LAMPORTS_PER_SOL,
  clusterApiUrl,
  VersionedTransaction,
} from '@solana/web3.js'
import BN from 'bn.js'

export const connection = new Connection(
  process.env.NEXT_PUBLIC_SOLANA_RPC ??
    clusterApiUrl('mainnet-beta'),
  { commitment: 'confirmed' }
)

export type WalletAdapter = {
  publicKey: PublicKey | null
  signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => Promise<T>
  signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => Promise<T[]>
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  isConnected: boolean
}

export type ExecutionResult = {
  success: boolean
  signature?: string
  explorerUrl?: string
  error?: string
  poolAddress?: string
  tokenA?: string
  tokenB?: string
}

export function getPhantomWallet(): WalletAdapter | null {
  if (typeof window === 'undefined') return null
  const phantom = (window as any)?.phantom?.solana
  if (!phantom?.isPhantom) return null
  return phantom
}

export async function connectWallet(): Promise<{
  wallet: WalletAdapter | null
  address: string | null
  balance?: number
  error?: string
}> {
  try {
    const wallet = getPhantomWallet()
    if (!wallet) {
      return {
        wallet: null,
        address: null,
        balance: 0,
        error: 'Phantom wallet not found. Install from phantom.app'
      }
    }

    const connectWithTimeout = Promise.race([
      wallet.connect(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Connection timed out. Please try again.')),
          15000
        )
      )
    ])

    await connectWithTimeout
    const address = wallet.publicKey?.toBase58() ?? null

    if (!address) {
      return {
        wallet: null,
        address: null,
        balance: 0,
        error: 'Wallet connected but no public key found.'
      }
    }

    return { wallet, address, balance: await getBalance(address) }
  } catch (err: any) {
    if (
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected')
    ) {
      return {
        wallet: null,
        address: null,
        balance: 0,
        error: 'Connection cancelled. Click Connect Phantom to try again.'
      }
    }

    return {
      wallet: null,
      address: null,
      balance: 0,
      error: err?.message ?? String(err)
    }
  }
}

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

async function getSolPrice(): Promise<number> {
  try {
    const res = await fetch(
      'https://api.coingecko.com/api/v3/simple/price' +
      '?ids=solana&vs_currencies=usd',
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const data = await res.json()
    const price = data?.solana?.usd
    if (!price || typeof price !== 'number') {
      console.warn('[solana] CoinGecko returned no SOL price, using fallback $150')
      return 150
    }
    return price
  } catch (err) {
    console.warn('[solana] CoinGecko fetch failed, using fallback $150:', err)
    return 150
  }
}

// ============================================================
// LP Execution — opens a position in the selected Meteora pool
// ============================================================

export async function executeLPPosition(
  wallet: WalletAdapter,
  poolAddress: string,
  capitalUSD: number,
  solOverride?: number,
  usdcOverride?: number,
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { success: false, error: 'Wallet not connected' }
    }

    const DLMM = (await import('@meteora-ag/dlmm')).default

    // Parse the pool address from the strategy — use the pool the user actually selected
    let poolPubkey: PublicKey
    try {
      poolPubkey = new PublicKey(poolAddress)
    } catch {
      return { success: false, error: `Invalid pool address: ${poolAddress}` }
    }

    console.log('[meteora] loading pool:', poolPubkey.toBase58())
    const dlmmPool = await DLMM.create(connection, poolPubkey)
    console.log('[meteora] pool loaded')

    const activeBin = await dlmmPool.getActiveBin()
    console.log('[meteora] active bin:', activeBin.binId)

    const BIN_RANGE = 5
    const minBinId = activeBin.binId - BIN_RANGE
    const maxBinId = activeBin.binId + BIN_RANGE

    const positionKeypair = Keypair.generate()
    console.log('[meteora] position:', positionKeypair.publicKey.toBase58())

    // Calculate deposit amounts — split 50/50 between the two tokens
    const solPrice = await getSolPrice()
    const halfCapital = capitalUSD / 2

    // SOL amount (9 decimals)
    const solAmount = solOverride ?? (halfCapital / solPrice)
    const solLamports = new BN(
      Math.floor(solAmount * 1_000_000_000)
    )

    // USDC amount (6 decimals)
    const usdcAmountNum = usdcOverride ?? halfCapital
    const usdcAmount = new BN(
      Math.floor(usdcAmountNum * 1_000_000)
    )

    console.log('[meteora] capital:', capitalUSD, 'USD')
    console.log('[meteora] SOL price:', solPrice)
    console.log('[meteora] depositing:',
      solAmount.toFixed(4), 'SOL +', halfCapital, 'USDC')

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    console.log('[meteora] building initializePositionAndAddLiquidityByStrategy tx...')
    const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: wallet.publicKey,
      totalXAmount: solLamports,
      totalYAmount: usdcAmount,
      strategy: {
        maxBinId,
        minBinId,
        strategyType: 0,
      },
    })

    tx.recentBlockhash = blockhash
    tx.feePayer = wallet.publicKey
    tx.partialSign(positionKeypair)

    const signedTx = await wallet.signTransaction(tx)

    const signers = signedTx.signatures.filter(
      s => s.signature !== null
    )
    console.log('[meteora] signatures count:', signers.length)
    if (signers.length < 2) {
      throw new Error(
        'Transaction requires 2 signatures, got ' +
        signers.length
      )
    }

    console.log('[meteora] sending transaction...')
    const sig = await connection.sendRawTransaction(
      (signedTx as Transaction).serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    })
    console.log('[meteora] SUCCESS:', sig)

    return {
      success: true,
      signature: sig,
      explorerUrl: `https://explorer.solana.com/tx/${sig}`,
      poolAddress: poolPubkey.toBase58(),
    }
  } catch (err: any) {
    console.error('[meteora] execution failed:', err.message)
    return { success: false, error: err.message ?? String(err) }
  }
}

// ============================================================
// Withdraw / Close Position
// ============================================================

export async function closeLPPosition(
  wallet: WalletAdapter,
  positionAddress: string,
  poolAddress: string,
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { success: false, error: 'Wallet not connected' }
    }

    const DLMM = (await import('@meteora-ag/dlmm')).default

    const poolPubkey = new PublicKey(poolAddress)
    const positionPubkey = new PublicKey(positionAddress)

    console.log('[meteora] loading pool for withdrawal:', poolPubkey.toBase58())
    const dlmmPool = await DLMM.create(connection, poolPubkey)

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    console.log('[meteora] building removeLiquidity tx...')
    const tx = await dlmmPool.removeLiquidity({
      positionPubKey: positionPubkey,
      user: wallet.publicKey,
    })

    tx.recentBlockhash = blockhash
    tx.feePayer = wallet.publicKey

    const signedTx = await wallet.signTransaction(tx)

    console.log('[meteora] sending removeLiquidity...')
    const sig = await connection.sendRawTransaction(
      (signedTx as Transaction).serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    })
    console.log('[meteora] withdrawal SUCCESS:', sig)

    return {
      success: true,
      signature: sig,
      explorerUrl: `https://explorer.solana.com/tx/${sig}`,
      poolAddress: poolPubkey.toBase58(),
    }
  } catch (err: any) {
    console.error('[meteora] withdrawal failed:', err.message)
    return { success: false, error: err.message ?? String(err) }
  }
}

// ============================================================
// Position storage (localStorage + on-chain)
// ============================================================

export function savePositionToStorage(
  walletAddress: string,
  position: {
    address: string
    tokenA: string
    tokenB: string
    protocol: string
    feeApr: number
    signature: string
    explorerUrl: string
    timestamp: Date
    capitalUSD: number
  }
) {
  try {
    if (typeof window === 'undefined') return

    const key = `mindor_positions_${walletAddress}`
    const existing = JSON.parse(localStorage.getItem(key) ?? '[]')
    const filtered = existing.filter(
      (p: any) => p.address !== position.address
    )
    filtered.unshift(position)
    localStorage.setItem(
      key,
      JSON.stringify(filtered.slice(0, 50))
    )
    console.log('[positions] saved to localStorage')
  } catch (e) {
    console.error('[positions] save error:', e)
  }
}

/**
 * Load positions from a specific Meteora pool.
 * NOTE: Currently hardcoded to SOL-USDC pool.
 * TODO: Iterate over all known pool addresses or use Helius/SolanaFM
 *       to discover all DLMM positions for a wallet.
 */
export async function loadOnChainPositions(
  walletAddress: string,
  poolAddress?: string,
): Promise<Array<{
  address: string
  tokenA: string
  tokenB: string
  protocol: string
  feeApr: number
  signature: string
  explorerUrl: string
  timestamp: Date
  capitalUSD: number
}>> {
  try {
    const DLMM = (await import('@meteora-ag/dlmm')).default
    const owner = new PublicKey(walletAddress)
    const poolPubkey = new PublicKey(
      poolAddress ?? '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6'
    )
    const pool = await DLMM.create(connection, poolPubkey)

    const { userPositions } = await pool.getPositionsByUserAndLbPair(owner)

    if (!userPositions || userPositions.length === 0) return []

    return userPositions.map((pos: any) => ({
      address: pos.publicKey?.toBase58() ?? '',
      tokenA: 'SOL',
      tokenB: 'USDC',
      protocol: 'Meteora',
      feeApr: 0,
      signature: pos.publicKey?.toBase58() ?? '',
      explorerUrl:
        `https://explorer.solana.com/address/` +
        `${pos.publicKey?.toBase58()}`,
      timestamp: new Date(),
      capitalUSD: 0,
    }))
  } catch (err) {
    console.error('[solana] loadOnChainPositions:', err)
    return []
  }
}
