export interface Eip1193Provider {
  request<T = unknown>(args: { method: string; params?: unknown[] }): Promise<T>
  on?: (event: string, handler: (...args: unknown[]) => void) => void
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void
}

export interface WalletReadiness {
  account?: string
  chainId?: number
  isArcTestnet: boolean
  message?: string
  status: 'checking' | 'unavailable' | 'disconnected' | 'connected' | 'error'
}

export const ARC_TESTNET = {
  blockExplorerUrls: ['https://testnet.arcscan.app'],
  chainId: 5_042_002,
  chainIdHex: '0x4cef52',
  chainName: 'Arc Testnet',
  nativeCurrency: {
    decimals: 18,
    name: 'USDC',
    symbol: 'USDC',
  },
  rpcUrls: ['https://rpc.testnet.arc.network'],
}

declare global {
  interface Window {
    ethereum?: Eip1193Provider
  }
}

export function injectedWalletProvider(): Eip1193Provider | null {
  if (typeof window === 'undefined') return null
  return window.ethereum ?? null
}

export async function readWalletReadiness(provider = injectedWalletProvider()): Promise<WalletReadiness> {
  if (!provider) return { isArcTestnet: false, status: 'unavailable' }

  try {
    const [accounts, chainId] = await Promise.all([
      provider.request<string[]>({ method: 'eth_accounts' }),
      provider.request<string>({ method: 'eth_chainId' }),
    ])
    const account = accounts[0]
    const normalizedChainId = normalizeChainId(chainId)

    if (!account) {
      return {
        chainId: normalizedChainId ?? undefined,
        isArcTestnet: normalizedChainId === ARC_TESTNET.chainId,
        status: 'disconnected',
      }
    }

    return {
      account,
      chainId: normalizedChainId ?? undefined,
      isArcTestnet: normalizedChainId === ARC_TESTNET.chainId,
      status: 'connected',
    }
  } catch (error) {
    return {
      isArcTestnet: false,
      message: error instanceof Error ? error.message : 'Wallet check failed',
      status: 'error',
    }
  }
}

export async function connectWallet(provider = injectedWalletProvider()): Promise<WalletReadiness> {
  if (!provider) return { isArcTestnet: false, status: 'unavailable' }

  await provider.request<string[]>({ method: 'eth_requestAccounts' })
  return readWalletReadiness(provider)
}

export async function ensureArcTestnet(provider = injectedWalletProvider()): Promise<WalletReadiness> {
  if (!provider) return { isArcTestnet: false, status: 'unavailable' }

  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: ARC_TESTNET.chainIdHex }],
    })
  } catch (error) {
    if (!isUnknownChainError(error)) throw error

    await provider.request({
      method: 'wallet_addEthereumChain',
      params: [walletAddEthereumChainParams()],
    })
  }

  return readWalletReadiness(provider)
}

export function formatAddress(address: string): string {
  if (!/^0x[a-fA-F0-9]{40}$/.test(address)) return address
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

export function normalizeChainId(chainId: unknown): number | null {
  if (typeof chainId === 'number' && Number.isFinite(chainId)) return chainId
  if (typeof chainId !== 'string') return null

  const parsed = chainId.startsWith('0x') ? Number.parseInt(chainId, 16) : Number.parseInt(chainId, 10)
  return Number.isFinite(parsed) ? parsed : null
}

function walletAddEthereumChainParams() {
  return {
    blockExplorerUrls: ARC_TESTNET.blockExplorerUrls,
    chainId: ARC_TESTNET.chainIdHex,
    chainName: ARC_TESTNET.chainName,
    nativeCurrency: ARC_TESTNET.nativeCurrency,
    rpcUrls: ARC_TESTNET.rpcUrls,
  }
}

function isUnknownChainError(error: unknown): boolean {
  return Boolean(error && typeof error === 'object' && 'code' in error && error.code === 4902)
}
