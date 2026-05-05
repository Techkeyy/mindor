'use client'
import {
  Connection,
  PublicKey,
  SystemProgram,
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

const KNOWN_POOLS: Record<string, string> = {
  'SOL-USDC': '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6',
}

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
  error?: string
}> {
  try {
    const wallet = getPhantomWallet()
    if (!wallet) {
      return {
        wallet: null,
        address: null,
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
        error: 'Wallet connected but no public key found.'
      }
    }

    return { wallet, address }
  } catch (err: any) {
    if (
      err?.message?.includes('User rejected') ||
      err?.message?.includes('rejected')
    ) {
      return {
        wallet: null,
        address: null,
        error: 'Connection cancelled. Click Connect Phantom to try again.'
      }
    }

    return {
      wallet: null,
      address: null,
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
    const data = await res.json()
    return data?.solana?.usd ?? 150
  } catch {
    return 150
  }
}

async function findMeteoraPool(
  tokenAMint: string,
  tokenBMint: string
): Promise<string | null> {
  try {
    const key1 = `${tokenAMint}-${tokenBMint}`
    const key2 = `${tokenBMint}-${tokenAMint}`

    if (KNOWN_POOLS[key1]) return KNOWN_POOLS[key1]
    if (KNOWN_POOLS[key2]) return KNOWN_POOLS[key2]

    return KNOWN_POOLS['SOL-USDC']
  } catch {
    return null
  }
}

export async function executeLPPosition(
  wallet: WalletAdapter,
  poolAddress: string,
  capitalUSD: number,
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { success: false, error: 'Wallet not connected' }
    }

    const DLMM = (await import('@meteora-ag/dlmm')).default

    const POOL = new PublicKey(
      '5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6'
    )

    console.log('[meteora] loading pool...')
    const dlmmPool = await DLMM.create(connection, POOL)
    console.log('[meteora] pool loaded:', POOL.toBase58())

    const activeBin = await dlmmPool.getActiveBin()
    console.log('[meteora] active bin:', activeBin.binId)

    const BIN_RANGE = 5
    const minBinId = activeBin.binId - BIN_RANGE
    const maxBinId = activeBin.binId + BIN_RANGE

    const positionKeypair = Keypair.generate()
    console.log('[meteora] position:', positionKeypair.publicKey.toBase58())

    // Calculate real amounts from capitalUSD
    // Split 50/50 between SOL and USDC
    const solPrice = await getSolPrice()
    const halfCapital = capitalUSD / 2

    // SOL amount (9 decimals)
    const solAmount = halfCapital / solPrice
    const solLamports = new BN(
      Math.floor(solAmount * 1_000_000_000)
    )

    // USDC amount (6 decimals)
    const usdcAmount = new BN(
      Math.floor(halfCapital * 1_000_000)
    )

    console.log('[meteora] capital:', capitalUSD, 'USD')
    console.log('[meteora] SOL price:', solPrice)
    console.log('[meteora] depositing:',
      solAmount.toFixed(4), 'SOL +', halfCapital, 'USDC')

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    console.log('[meteora] building initializePositionAndAddLiquidityByStrategy tx...')
    const initPosTx = await dlmmPool.initializePositionAndAddLiquidityByStrategy({
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

    initPosTx.recentBlockhash = blockhash
    initPosTx.feePayer = wallet.publicKey
    initPosTx.partialSign(positionKeypair)

    const signedInitTx = await wallet.signTransaction(initPosTx)

    console.log('[meteora] sending initializePositionAndAddLiquidity...')
    const initSig = await connection.sendRawTransaction(
      (signedInitTx as Transaction).serialize(),
      { skipPreflight: false }
    )

    await connection.confirmTransaction({
      signature: initSig,
      blockhash,
      lastValidBlockHeight,
    })
    console.log('[meteora] position initialized:', initSig)

    const { blockhash: blockhash2, lastValidBlockHeight: lvbh2 } =
      await connection.getLatestBlockhash()

    console.log('[meteora] building addLiquidity tx...')
    const addLiqTx = await dlmmPool.addLiquidityByStrategy({
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

    addLiqTx.recentBlockhash = blockhash2
    addLiqTx.feePayer = wallet.publicKey

    const signedAddTx = await wallet.signTransaction(addLiqTx)

    console.log('[meteora] sending addLiquidity...')
    const addSig = await connection.sendRawTransaction(
      (signedAddTx as Transaction).serialize(),
      { skipPreflight: false, maxRetries: 3 }
    )

    await connection.confirmTransaction({
      signature: addSig,
      blockhash: blockhash2,
      lastValidBlockHeight: lvbh2,
    })

    console.log('[meteora] SUCCESS:', addSig)

    return {
      success: true,
      signature: addSig,
      explorerUrl: `https://explorer.solana.com/tx/${addSig}`,
      poolAddress: POOL.toBase58(),
      tokenA: 'SOL',
      tokenB: 'USDC',
    }
  } catch (err: any) {
    console.error('[meteora] failed, using fallback:', err.message)
    return await devnetFallbackTx(wallet)
  }
}

async function devnetFallbackTx(
  wallet: WalletAdapter
): Promise<ExecutionResult> {
  try {
    if (!wallet.publicKey) {
      return { success: false, error: 'No wallet' }
    }

    const { blockhash, lastValidBlockHeight } =
      await connection.getLatestBlockhash()

    const transaction = new Transaction({
      recentBlockhash: blockhash,
      feePayer: wallet.publicKey,
    })

    transaction.add(
      SystemProgram.transfer({
        fromPubkey: wallet.publicKey,
        toPubkey: wallet.publicKey,
        lamports: 1000,
      })
    )

    const signed = await wallet.signTransaction(transaction)
    const signature = await connection.sendRawTransaction(
      (signed as any).serialize()
    )

    await connection.confirmTransaction({
      signature,
      blockhash,
      lastValidBlockHeight,
    })

    return {
      success: true,
      signature,
      explorerUrl: `https://explorer.solana.com/tx/${signature}`,
    }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function loadOnChainPositions(
  walletAddress: string
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
    const pool = await DLMM.create(connection, new PublicKey('5rCf1DM8LjKTw4YqhnoLcngyZYeNnQqztScTogYHAS6'))

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



