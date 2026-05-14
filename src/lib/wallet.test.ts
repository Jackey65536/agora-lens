import { describe, expect, it } from 'vitest'

import { ARC_TESTNET, ensureArcTestnet, formatAddress, normalizeChainId, type Eip1193Provider } from './wallet'

describe('wallet helpers', () => {
  it('normalizes decimal and hex chain IDs', () => {
    expect(normalizeChainId(ARC_TESTNET.chainId)).toBe(ARC_TESTNET.chainId)
    expect(normalizeChainId(ARC_TESTNET.chainIdHex)).toBe(ARC_TESTNET.chainId)
    expect(normalizeChainId('5042002')).toBe(ARC_TESTNET.chainId)
    expect(normalizeChainId('not-a-chain')).toBeNull()
  })

  it('formats EVM addresses for compact display', () => {
    expect(formatAddress('0x1234567890abcdef1234567890abcdef12345678')).toBe('0x1234...5678')
    expect(formatAddress('not-an-address')).toBe('not-an-address')
  })

  it('switches to Arc Testnet when the wallet already knows the chain', async () => {
    const methods: string[] = []
    const provider = fakeProvider(async ({ method }) => {
      methods.push(method)
      if (method === 'eth_accounts') return ['0x1234567890abcdef1234567890abcdef12345678']
      if (method === 'eth_chainId') return ARC_TESTNET.chainIdHex
      return null
    })

    await expect(ensureArcTestnet(provider)).resolves.toMatchObject({
      isArcTestnet: true,
      status: 'connected',
    })
    expect(methods).toContain('wallet_switchEthereumChain')
    expect(methods).not.toContain('wallet_addEthereumChain')
  })

  it('adds Arc Testnet when the wallet reports an unknown chain', async () => {
    const methods: string[] = []
    const provider = fakeProvider(async ({ method }) => {
      methods.push(method)
      if (method === 'wallet_switchEthereumChain') {
        const error = new Error('unknown chain')
        Object.assign(error, { code: 4902 })
        throw error
      }
      if (method === 'eth_accounts') return ['0x1234567890abcdef1234567890abcdef12345678']
      if (method === 'eth_chainId') return ARC_TESTNET.chainIdHex
      return null
    })

    await expect(ensureArcTestnet(provider)).resolves.toMatchObject({
      isArcTestnet: true,
      status: 'connected',
    })
    expect(methods).toEqual([
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
      'eth_accounts',
      'eth_chainId',
    ])
  })
})

function fakeProvider(
  handler: (args: { method: string; params?: unknown[] }) => Promise<unknown>,
): Eip1193Provider {
  return {
    request: async <T>(args: { method: string; params?: unknown[] }) => handler(args) as Promise<T>,
  }
}
