import { CheckCircle2, ExternalLink, Loader2, PenLine, Rocket, ShieldCheck } from 'lucide-react'
import { useMemo, useState } from 'react'
import type { MarketBrief, MarketSignal } from '../lib/agoraAgent'
import {
  configuredTraceAnchorAddress,
  createAnchorDraft,
  isAddress,
  saveTraceAnchorAddress,
  sendAnchorTransaction,
  sendDeployTransaction,
  txExplorerUrl,
  waitForReceipt,
  type AnchorDraft,
} from '../lib/traceAnchor'
import { formatAddress, injectedWalletProvider, type WalletReadiness } from '../lib/wallet'

interface TraceAnchorPanelProps {
  archiveShareUrl: string | null
  brief: MarketBrief
  signal: MarketSignal | null
  walletState: WalletReadiness
}

type AnchorState =
  | { status: 'idle' }
  | { draft: AnchorDraft; status: 'confirm-anchor' }
  | { draft: AnchorDraft; status: 'anchoring' }
  | { status: 'confirm-deploy' }
  | { status: 'deploying' }
  | { contractAddress?: string; status: 'deployed'; txHash: string }
  | { status: 'anchored'; txHash: string }
  | { message: string; status: 'error' }

export function TraceAnchorPanel({ archiveShareUrl, brief, signal, walletState }: TraceAnchorPanelProps) {
  const [contractAddress, setContractAddress] = useState(configuredTraceAnchorAddress)
  const [anchorState, setAnchorState] = useState<AnchorState>({ status: 'idle' })
  const normalizedContractAddress = contractAddress.trim()
  const canUseWallet = Boolean(walletState.status === 'connected' && walletState.isArcTestnet && walletState.account)
  const canPrepareAnchor = Boolean(canUseWallet && signal && archiveShareUrl && isAddress(normalizedContractAddress))
  const actionLabel = anchorButtonLabel(canUseWallet, archiveShareUrl, normalizedContractAddress)

  const readiness = useMemo(() => {
    if (!archiveShareUrl) return 'Save the brief before anchoring.'
    if (!isAddress(normalizedContractAddress)) return 'TraceAnchor contract address is required.'
    if (!canUseWallet) return 'Connect a wallet on Arc Testnet before signing.'
    return 'Ready to prepare a signature request.'
  }, [archiveShareUrl, canUseWallet, normalizedContractAddress])

  function saveContractAddress() {
    try {
      saveTraceAnchorAddress(normalizedContractAddress)
      setAnchorState({ status: 'idle' })
    } catch (error) {
      setAnchorState({
        message: error instanceof Error ? error.message : 'Contract address is invalid',
        status: 'error',
      })
    }
  }

  function prepareAnchor() {
    if (!walletState.account || !signal || !archiveShareUrl) return

    try {
      const draft = createAnchorDraft({
        account: walletState.account,
        brief,
        contractAddress: normalizedContractAddress,
        signal,
        uri: archiveShareUrl,
      })
      setAnchorState({ draft, status: 'confirm-anchor' })
    } catch (error) {
      setAnchorState({
        message: error instanceof Error ? error.message : 'Anchor draft is invalid',
        status: 'error',
      })
    }
  }

  async function signAnchorTransaction(draft: AnchorDraft) {
    const provider = injectedWalletProvider()
    if (!provider) {
      setAnchorState({ message: 'Wallet provider is unavailable', status: 'error' })
      return
    }

    setAnchorState({ draft, status: 'anchoring' })
    try {
      const txHash = await sendAnchorTransaction(provider, draft)
      setAnchorState({ status: 'anchored', txHash })
    } catch (error) {
      setAnchorState({
        message: error instanceof Error ? error.message : 'Anchor transaction was rejected',
        status: 'error',
      })
    }
  }

  async function signDeployTransaction() {
    const provider = injectedWalletProvider()
    if (!provider || !walletState.account) {
      setAnchorState({ message: 'Wallet provider is unavailable', status: 'error' })
      return
    }

    setAnchorState({ status: 'deploying' })
    try {
      const txHash = await sendDeployTransaction(provider, walletState.account)
      const receipt = await waitForReceipt(provider, txHash, { attempts: 15, intervalMs: 2_000 })
      const deployedAddress = receipt?.contractAddress ?? undefined
      if (deployedAddress && isAddress(deployedAddress)) {
        setContractAddress(deployedAddress)
        saveTraceAnchorAddress(deployedAddress)
      }
      setAnchorState({ contractAddress: deployedAddress ?? undefined, status: 'deployed', txHash })
    } catch (error) {
      setAnchorState({
        message: error instanceof Error ? error.message : 'Deploy transaction was rejected',
        status: 'error',
      })
    }
  }

  return (
    <div className="wallet-card trace-anchor-card" aria-label="TraceAnchor contract">
      <div className="wallet-heading">
        <ShieldCheck aria-hidden="true" />
        <div>
          <p className="eyebrow">TraceAnchor</p>
          <strong>{anchorTitle(anchorState)}</strong>
        </div>
      </div>

      <label className="input-label compact" htmlFor="trace-anchor-address">
        Contract address
      </label>
      <div className="contract-row">
        <input
          id="trace-anchor-address"
          aria-label="TraceAnchor contract address"
          placeholder="0x..."
          value={contractAddress}
          onChange={(event) => setContractAddress(event.target.value)}
        />
        <button className="secondary-action" type="button" onClick={saveContractAddress}>
          Save
        </button>
      </div>

      <p className="wallet-status">{readiness}</p>

      <div className="wallet-actions">
        <button
          className="secondary-action full"
          disabled={!canUseWallet || anchorState.status === 'deploying'}
          type="button"
          onClick={() => setAnchorState({ status: 'confirm-deploy' })}
        >
          {anchorState.status === 'deploying' ? <Loader2 className="spin" aria-hidden="true" /> : <Rocket aria-hidden="true" />}
          Deploy TraceAnchor
        </button>
        <button className="secondary-action full" disabled={!canPrepareAnchor} type="button" onClick={prepareAnchor}>
          <PenLine aria-hidden="true" />
          {actionLabel}
        </button>
      </div>

      {anchorState.status === 'confirm-deploy' ? (
        <div className="confirm-box">
          <p className="eyebrow">Confirm deploy</p>
          <dl>
            <div>
              <dt>Publisher</dt>
              <dd>{walletState.account ? formatAddress(walletState.account) : 'Wallet not connected'}</dd>
            </div>
            <div>
              <dt>Network</dt>
              <dd>Arc Testnet</dd>
            </div>
          </dl>
          <button className="primary-action full" type="button" onClick={() => void signDeployTransaction()}>
            <PenLine aria-hidden="true" />
            Sign deploy transaction
          </button>
        </div>
      ) : null}

      {anchorState.status === 'confirm-anchor' || anchorState.status === 'anchoring' ? (
        <div className="confirm-box">
          <p className="eyebrow">Confirm anchor</p>
          <dl>
            <div>
              <dt>Trace hash</dt>
              <dd>{anchorState.draft.traceHash}</dd>
            </div>
            <div>
              <dt>Signal hash</dt>
              <dd>{anchorState.draft.signalIdHash}</dd>
            </div>
            <div>
              <dt>URI</dt>
              <dd>{anchorState.draft.uri}</dd>
            </div>
          </dl>
          <button
            className="primary-action full"
            disabled={anchorState.status === 'anchoring'}
            type="button"
            onClick={() => void signAnchorTransaction(anchorState.draft)}
          >
            {anchorState.status === 'anchoring' ? (
              <Loader2 className="spin" aria-hidden="true" />
            ) : (
              <PenLine aria-hidden="true" />
            )}
            Sign anchor transaction
          </button>
        </div>
      ) : null}

      {anchorState.status === 'anchored' || anchorState.status === 'deployed' ? (
        <p className="archive-status saved">
          <CheckCircle2 aria-hidden="true" />
          {anchorState.status === 'anchored' ? 'Anchor transaction submitted' : 'Deploy transaction submitted'}
          <a href={txExplorerUrl(anchorState.txHash)} target="_blank" rel="noreferrer">
            <ExternalLink aria-hidden="true" />
            ArcScan
          </a>
          {anchorState.status === 'deployed' && anchorState.contractAddress ? (
            <span>Contract {formatAddress(anchorState.contractAddress)}</span>
          ) : null}
        </p>
      ) : null}

      {anchorState.status === 'error' ? <p className="archive-status error">{anchorState.message}</p> : null}
    </div>
  )
}

function anchorTitle(state: AnchorState): string {
  if (state.status === 'confirm-anchor') return 'Review before signing'
  if (state.status === 'anchoring') return 'Waiting for wallet'
  if (state.status === 'confirm-deploy') return 'Review deployment'
  if (state.status === 'deploying') return 'Deploying contract'
  if (state.status === 'anchored') return 'Anchor submitted'
  if (state.status === 'deployed') return 'Contract deployed'
  if (state.status === 'error') return 'Action failed'
  return 'Onchain evidence'
}

function anchorButtonLabel(canUseWallet: boolean, shareUrl: string | null, contractAddress: string): string {
  if (!shareUrl) return 'Save brief first'
  if (!isAddress(contractAddress)) return 'Enter contract address'
  if (!canUseWallet) return 'Connect Arc wallet'
  return 'Prepare anchor'
}
