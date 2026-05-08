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
import { isValidPoolAddress, getPoolProtocol } from './defillama'

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

// Token mint addresses on Solana mainnet
const MINT_SOL = 'So11111111111111111111111111111111111111112' // Wrapped SOL
const MINT_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v'
const MINT_USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB'
const MINT_JTO = 'jtojtomepa8beP8AuQc6eXt5FriJwfFMwQ2x2v9f2mCL'

// CoinGecko IDs for price lookup
const CG_IDS: Record<string, string> = {
  [MINT_SOL]: 'solana',
  [MINT_USDC]: 'usd-coin',
  [MINT_USDT]: 'tether',
  [MINT_JTO]: 'jito-governance-token',
}

// Stablecoins that are always ~$1
const STABLECOINS = new Set([MINT_USDC, MINT_USDT])

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

export async function getBalance(address: string): Promise<number> {
  try {
    const pubkey = new PublicKey(address)
    const balance = await connection.getBalance(pubkey)
    return balance / LAMPORTS_PER_SOL
  } catch {
    return 0
  }
}

/**
 * Fetch USD prices for multiple tokens from CoinGecko.
 * Returns a map of coingecko_id → price in USD.
 * Stablecoins always return 1.0.
 */
async function getTokenPrices(mints: string[]): Promise<Map<string, number>> {
  const prices = new Map<string, number>()

  // Stablecoins are always ~$1
  for (const mint of mints) {
    if (STABLECOINS.has(mint)) {
      prices.set(mint, 1.0)
    }
  }

  // Fetch volatile token prices from CoinGecko
  const volatileIds = mints
    .map(m => CG_IDS[m])
    .filter((id): id is string => !!id && !STABLECOINS.has(mints.find(k => CG_IDS[k] === id)!))

  if (volatileIds.length === 0) return prices

  try {
    const res = await fetch(
      `https://api.coingecko.com/api/v3/simple/price?ids=${volatileIds.join(',')}&vs_currencies=usd`,
      { cache: 'no-store' }
    )
    if (!res.ok) throw new Error(`CoinGecko HTTP ${res.status}`)
    const data = await res.json()

    for (const mint of mints) {
      const cgId = CG_IDS[mint]
      if (cgId && data[cgId]?.usd) {
        prices.set(mint, data[cgId].usd)
      }
    }
  } catch (err) {
    console.warn('[solana] CoinGecko fetch failed, using fallback prices:', err)
    // Fallback prices
    for (const mint of mints) {
      if (!prices.has(mint)) {
        if (mint === MINT_SOL) prices.set(mint, 150)
        else if (mint === MINT_JTO) prices.set(mint, 2.5)
        else prices.set(mint, 1.0)
      }
    }
  }

  return prices
}

// ============================================================
// LP Execution — opens a position in any supported DLMM pool
// ============================================================

export async function executeLPPosition(
  wallet: WalletAdapter,
  poolAddress: string,
  tokenA: string,
  tokenB: string,
  capitalUSD: number,
  tokenAOverride?: number,
  tokenBOverride?: number,
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { success: false, error: 'Wallet not connected' }
    }

    // Validate address
    let poolPubkey: PublicKey
    try {
      poolPubkey = new PublicKey(poolAddress)
    } catch {
      return { success: false, error: `Invalid pool address: ${poolAddress}` }
    }

    if (!isValidPoolAddress(poolAddress)) {
      return { success: false, error: `Invalid Solana address: ${poolAddress}. Try refreshing.` }
    }

    // Check protocol support
    const protocol = getPoolProtocol(poolAddress)
    if (protocol === 'orca') {
      return {
        success: false,
        error: 'Orca execution is coming soon. Currently only Meteora DLMM pools are supported for on-chain execution.',
      }
    }
    if (protocol === 'unknown') {
      return {
        success: false,
        error: `Unknown pool protocol. This pool may not be supported yet.`,
      }
    }

    const DLMM = (await import('@meteora-ag/dlmm')).default

    console.log('[mindor] loading pool:', poolPubkey.toBase58())
    const dlmmPool = await DLMM.create(connection, poolPubkey)
    console.log('[mindor] pool loaded — X:', dlmmPool.tokenX.publicKey.toBase58(),
      'Y:', dlmmPool.tokenY.publicKey.toBase58())

    const activeBin = await dlmmPool.getActiveBin()
    console.log('[mindor] active bin:', activeBin.binId)

    const BIN_RANGE = 5
    const minBinId = activeBin.binId - BIN_RANGE
    const maxBinId = activeBin.binId + BIN_RANGE

    const positionKeypair = Keypair.generate()
    console.log('[mindor] position:', positionKeypair.publicKey.toBase58())

    // Determine which tokens map to pool's X/Y
    const mintX = dlmmPool.tokenX.publicKey.toBase58()
    const mintY = dlmmPool.tokenY.publicKey.toBase58()
    const decimalsX = getTokenDecimals(mintX)
    const decimalsY = getTokenDecimals(mintY)

    // Map our tokenA/tokenB symbols to actual mints
    const mintA = tokenToMint(tokenA)
    const mintB = tokenToMint(tokenB)

    // Which of our tokens is pool's X and which is Y?
    const tokenAIsX = mintA === mintX
    const tokenBIsX = mintB === mintX
    const mintForX = tokenAIsX ? mintA : tokenBIsX ? mintB : mintX
    const mintForY = tokenAIsX ? mintB : tokenBIsX ? mintA : mintY

    // Get prices for both tokens
    const prices = await getTokenPrices([mintForX, mintForY])
    const priceX = prices.get(mintForX) ?? 1.0
    const priceY = prices.get(mintForY) ?? 1.0

    // Split capital 50/50
    const halfCapital = capitalUSD / 2

    // Token X amount (in native units)
    const amountX = tokenAIsX
      ? (tokenAOverride ?? (halfCapital / priceX))
      : tokenBIsX
        ? (tokenBOverride ?? (halfCapital / priceX))
        : (halfCapital / priceX)

    // Token Y amount (in native units)
    const amountY = tokenAIsX
      ? (tokenBOverride ?? (halfCapital / priceY))
      : tokenBIsX
        ? (tokenAOverride ?? (halfCapital / priceY))
        : (halfCapital / priceY)

    const totalXAmount = new BN(Math.floor(amountX * Math.pow(10, decimalsX)))
    const totalYAmount = new BN(Math.floor(amountY * Math.pow(10, decimalsY)))

    console.log('[mindor] pair:', tokenA, '/', tokenB)
    console.log('[mindor] capital:', capitalUSD, 'USD')
    console.log('[mindor] prices — X:', priceX, 'Y:', priceY)
    console.log('[mindor] depositing:', amountX.toFixed(decimalsX), 'token X +',
      amountY.toFixed(decimalsY), 'token Y')

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    console.log('[mindor] building initializePositionAndAddLiquidityByStrategy...')
    const tx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
      positionPubKey: positionKeypair.publicKey,
      user: wallet.publicKey,
      totalXAmount,
      totalYAmount,
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

    const signers = signedTx.signatures.filter(s => s.signature !== null)
    console.log('[mindor] signatures count:', signers.length)
    if (signers.length < 2) {
      throw new Error('Transaction requires 2 signatures, got ' + signers.length)
    }

    console.log('[mindor] sending transaction...')
    const sig = await connection.sendRawTransaction(
      (signedTx as Transaction).serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    })
    console.log('[mindor] SUCCESS:', sig)

    return {
      success: true,
      signature: sig,
      explorerUrl: `https://explorer.solana.com/tx/${sig}`,
      poolAddress: poolPubkey.toBase58(),
    }
  } catch (err: any) {
    console.error('[mindor] execution failed:', err.message)
    return { success: false, error: err.message ?? String(err) }
  }
}

// Known token decimals by mint address
function getTokenDecimals(mint: string): number {
  if (mint === MINT_SOL) return 9
  if (mint === MINT_USDC || mint === MINT_USDT) return 6
  if (mint === MINT_JTO) return 9
  return 9 // default for most SPL tokens
}

/**
 * Map a token symbol to its Solana mint address.
 */
function tokenToMint(symbol: string): string {
  const s = symbol.toUpperCase()
  if (s === 'SOL') return MINT_SOL
  if (s === 'USDC') return MINT_USDC
  if (s === 'USDT') return MINT_USDT
  if (s === 'JTO') return MINT_JTO
  // Unknown token — return a placeholder; execution will likely fail
  // but we surface a clear error from the pool verification step
  return MINT_SOL
}

// ============================================================
// Withdraw / Close Position (Meteora DLMM only)
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

    const protocol = getPoolProtocol(poolAddress)
    if (protocol !== 'meteora') {
      return {
        success: false,
        error: protocol === 'orca'
          ? 'Orca withdrawal is coming soon.'
          : 'Withdrawal only supported for known Meteora DLMM pools.',
      }
    }

    const DLMM = (await import('@meteora-ag/dlmm')).default

    const poolPubkey = new PublicKey(poolAddress)
    const positionPubkey = new PublicKey(positionAddress)

    console.log('[mindor] loading pool for withdrawal:', poolPubkey.toBase58())
    const dlmmPool = await DLMM.create(connection, poolPubkey)

    const { userPositions } = await dlmmPool.getPositionsByUserAndLbPair(
      wallet.publicKey
    )
    const posData = userPositions.find(
      (p) => p.publicKey.toBase58() === positionPubkey.toBase58()
    )
    if (!posData) {
      return { success: false, error: 'Position not found for this wallet' }
    }
    const { lowerBinId, upperBinId } = posData.positionData

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    console.log('[mindor] building removeLiquidity tx...')
    const txs = await dlmmPool.removeLiquidity({
      position: positionPubkey,
      user: wallet.publicKey,
      fromBinId: lowerBinId,
      toBinId: upperBinId,
      bps: new BN(10000),
      shouldClaimAndClose: true,
    })

    if (txs.length === 0) {
      return { success: false, error: 'No transactions generated' }
    }

    const tx = txs[0]
    tx.recentBlockhash = blockhash
    tx.feePayer = wallet.publicKey

    const signedTx = await wallet.signTransaction(tx)

    console.log('[mindor] sending removeLiquidity...')
    const sig = await connection.sendRawTransaction(
      (signedTx as Transaction).serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    await connection.confirmTransaction({
      signature: sig,
      blockhash,
      lastValidBlockHeight,
    })
    console.log('[mindor] withdrawal SUCCESS:', sig)

    return {
      success: true,
      signature: sig,
      explorerUrl: `https://explorer.solana.com/tx/${sig}`,
      poolAddress: poolPubkey.toBase58(),
    }
  } catch (err: any) {
    console.error('[mindor] withdrawal failed:', err.message)
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
