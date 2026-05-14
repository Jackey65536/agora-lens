import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clipboard,
  DatabaseZap,
  DownloadCloud,
  FileText,
  Globe2,
  Link,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Rss,
  Share2,
  ShieldCheck,
  Sparkles,
  Wallet,
} from 'lucide-react'
import { TraceAnchorPanel } from './components/TraceAnchorPanel'
import { analyzeSignal, sampleSignals, type MarketBrief, type MarketSignal } from './lib/agoraAgent'
import { briefIdFromSearch, loadBriefArchive, saveBriefArchive, shareUrlForBrief } from './lib/briefArchive'
import { importSourceMaterial, sourceUrlFromText, type SourceImportType } from './lib/sourceImport'
import {
  connectWallet,
  ensureArcTestnet,
  formatAddress,
  injectedWalletProvider,
  readWalletReadiness,
  type WalletReadiness,
} from './lib/wallet'
import './App.css'

const APP_VERSION = '0.2.0'
const importModes: Array<{ label: string; type: SourceImportType }> = [
  { label: 'URL', type: 'url' },
  { label: 'RSS', type: 'rss' },
  { label: 'Research', type: 'research' },
  { label: 'Social', type: 'social' },
]

function App() {
  const [selectedSignalId, setSelectedSignalId] = useState(sampleSignals[0].id)
  const [customText, setCustomText] = useState(sampleSignals[0].text)
  const [importedSignal, setImportedSignal] = useState<MarketSignal | null>(null)
  const [sourceImportType, setSourceImportType] = useState<SourceImportType>('url')
  const [sourceImportUrl, setSourceImportUrl] = useState('')
  const [sourceImportText, setSourceImportText] = useState('')
  const [sourceImportTitle, setSourceImportTitle] = useState('')
  const [sourceImportState, setSourceImportState] = useState<
    | { status: 'idle' }
    | { status: 'importing' }
    | { status: 'imported'; title: string }
    | { message: string; status: 'error' }
  >({ status: 'idle' })
  const [brief, setBrief] = useState<MarketBrief | null>(null)
  const [briefSignal, setBriefSignal] = useState<MarketSignal | null>(null)
  const [isRunning, setIsRunning] = useState(true)
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle')
  const [archiveState, setArchiveState] = useState<
    | { status: 'idle' }
    | { status: 'saving' }
    | { id: string; shareUrl: string; status: 'saved' }
    | { message: string; status: 'error' }
  >({ status: 'idle' })
  const [walletState, setWalletState] = useState<WalletReadiness>({
    isArcTestnet: false,
    status: 'checking',
  })
  const [walletAction, setWalletAction] = useState<'idle' | 'connecting' | 'switching'>('idle')

  const selectedSignal = useMemo(
    () => sampleSignals.find((signal) => signal.id === selectedSignalId) ?? importedSignal ?? sampleSignals[0],
    [importedSignal, selectedSignalId],
  )

  useEffect(() => {
    let isActive = true
    const briefId = briefIdFromSearch(window.location.search)

    if (briefId) {
      void loadBriefArchive(briefId)
        .then((record) => {
          if (!isActive) return
          setSelectedSignalId(record.signal.id)
          setImportedSignal(sampleSignals.some((signal) => signal.id === record.signal.id) ? null : record.signal)
          setCustomText(record.signal.text)
          setBriefSignal(record.signal)
          setBrief(record.brief)
          setArchiveState({
            id: record.id,
            shareUrl: shareUrlForBrief(record.id, window.location.href),
            status: 'saved',
          })
          setIsRunning(false)
        })
        .catch((error: unknown) => {
          if (!isActive) return
          setArchiveState({
            message: error instanceof Error ? error.message : 'Failed to load saved brief',
            status: 'error',
          })
          void analyzeSignal(sampleSignals[0]).then((result) => {
            if (!isActive) return
            setBrief(result)
            setBriefSignal(sampleSignals[0])
            setIsRunning(false)
          })
        })
      return () => {
        isActive = false
      }
    }

    void analyzeSignal(sampleSignals[0]).then((result) => {
      if (!isActive) return
      setBrief(result)
      setBriefSignal(sampleSignals[0])
      setIsRunning(false)
    })

    return () => {
      isActive = false
    }
  }, [])

  useEffect(() => {
    const provider = injectedWalletProvider()
    const refresh = () => {
      void readWalletReadiness().then(setWalletState)
    }

    refresh()
    provider?.on?.('accountsChanged', refresh)
    provider?.on?.('chainChanged', refresh)

    return () => {
      provider?.removeListener?.('accountsChanged', refresh)
      provider?.removeListener?.('chainChanged', refresh)
    }
  }, [])

  async function runAgent(baseSignal?: MarketSignal) {
    setIsRunning(true)
    setCopyState('idle')
    setArchiveState({ status: 'idle' })
    const signal =
      baseSignal ??
      ({
        ...selectedSignal,
        id: 'manual-signal',
        title: 'Manual signal',
        source: 'manual',
        sourceLabel: 'Operator console',
        receivedAt: new Date().toISOString(),
        text: customText,
      } satisfies MarketSignal)

    const result = await analyzeSignal(signal)
    setBrief(result)
    setBriefSignal(signal)
    setIsRunning(false)
  }

  function loadSample(signal: MarketSignal) {
    setImportedSignal(null)
    setSelectedSignalId(signal.id)
    setCustomText(signal.text)
    void runAgent(signal)
  }

  function loadImportedSignal(signal: MarketSignal) {
    setImportedSignal(signal)
    setSelectedSignalId(signal.id)
    setCustomText(signal.text)
    void runAgent(signal)
  }

  async function importCurrentSource() {
    setSourceImportState({ status: 'importing' })
    try {
      const signal = await importSourceMaterial({
        sourceTitle: sourceImportTitle.trim() || undefined,
        sourceUrl: sourceImportUrl.trim() || sourceUrlFromText(sourceImportText) || undefined,
        text: sourceImportText.trim() || undefined,
        type: sourceImportType,
        url: sourceImportUrl.trim() || undefined,
      })
      setImportedSignal(signal)
      setSelectedSignalId(signal.id)
      setCustomText(signal.text)
      setSourceImportState({ status: 'imported', title: signal.title })
      await runAgent(signal)
    } catch (error) {
      setSourceImportState({
        message: error instanceof Error ? error.message : 'Source import failed',
        status: 'error',
      })
    }
  }

  async function copyEvidence() {
    if (!brief) return
    await navigator.clipboard.writeText(JSON.stringify(brief.evidencePacket, null, 2))
    setCopyState('copied')
  }

  async function saveCurrentBrief() {
    if (!brief || !briefSignal) return

    setArchiveState({ status: 'saving' })
    try {
      const record = await saveBriefArchive({ appVersion: APP_VERSION, brief, signal: briefSignal })
      const shareUrl = shareUrlForBrief(record.id, window.location.href)
      setArchiveState({ id: record.id, shareUrl, status: 'saved' })
      window.history.replaceState(null, '', shareUrl)
    } catch (error) {
      setArchiveState({
        message: error instanceof Error ? error.message : 'Brief archive API is unavailable',
        status: 'error',
      })
    }
  }

  async function copyShareLink() {
    if (archiveState.status !== 'saved') return

    await navigator.clipboard.writeText(archiveState.shareUrl)
    setCopyState('copied')
  }

  async function connectInjectedWallet() {
    setWalletAction('connecting')
    try {
      setWalletState(await connectWallet())
    } catch (error) {
      setWalletState({
        isArcTestnet: false,
        message: error instanceof Error ? error.message : 'Wallet connection failed',
        status: 'error',
      })
    } finally {
      setWalletAction('idle')
    }
  }

  async function switchToArcTestnet() {
    setWalletAction('switching')
    try {
      setWalletState(await ensureArcTestnet())
    } catch (error) {
      setWalletState({
        ...walletState,
        isArcTestnet: false,
        message: error instanceof Error ? error.message : 'Arc Testnet switch failed',
        status: 'error',
      })
    } finally {
      setWalletAction('idle')
    }
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Agora Agents Hackathon MVP</p>
          <h1>Agora Lens</h1>
        </div>
        <div className="status-row" aria-label="System status">
          <span>
            <CheckCircle2 aria-hidden="true" />
            Local agent
          </span>
          <span>
            <DatabaseZap aria-hidden="true" />
            Arc-ready trace
          </span>
          <span>
            <ShieldCheck aria-hidden="true" />
            No real funds
          </span>
        </div>
      </header>

      <section className="workflow">
        <aside className="signal-panel" aria-labelledby="signal-heading">
          <div className="section-title">
            <Globe2 aria-hidden="true" />
            <div>
              <p className="eyebrow">Signal intake</p>
              <h2 id="signal-heading">Source material</h2>
            </div>
          </div>

          <div className="source-import" aria-label="Source import">
            <div className="segmented-control" role="group" aria-label="Import type">
              {importModes.map((mode) => (
                <button
                  className={mode.type === sourceImportType ? 'active' : ''}
                  key={mode.type}
                  type="button"
                  onClick={() => setSourceImportType(mode.type)}
                >
                  {importModeIcon(mode.type)}
                  {mode.label}
                </button>
              ))}
            </div>

            {sourceImportType === 'url' || sourceImportType === 'rss' ? (
              <>
                <label className="input-label compact" htmlFor="source-import-url">
                  Source URL
                </label>
                <input
                  id="source-import-url"
                  placeholder={
                    sourceImportType === 'rss'
                      ? 'https://example.com/feed.xml'
                      : 'https://example.com/research'
                  }
                  value={sourceImportUrl}
                  onChange={(event) => setSourceImportUrl(event.target.value)}
                />
              </>
            ) : (
              <>
                <label className="input-label compact" htmlFor="source-import-title">
                  Source title
                </label>
                <input
                  id="source-import-title"
                  placeholder={sourceImportType === 'research' ? 'Desk note title' : 'Thread or post title'}
                  value={sourceImportTitle}
                  onChange={(event) => setSourceImportTitle(event.target.value)}
                />
                <label className="input-label compact" htmlFor="source-import-url">
                  Source URL
                </label>
                <input
                  id="source-import-url"
                  placeholder="https://example.com/source"
                  value={sourceImportUrl}
                  onChange={(event) => setSourceImportUrl(event.target.value)}
                />
                <label className="input-label compact" htmlFor="source-import-text">
                  Source text
                </label>
                <textarea
                  className="compact-textarea"
                  id="source-import-text"
                  rows={5}
                  value={sourceImportText}
                  onChange={(event) => setSourceImportText(event.target.value)}
                />
              </>
            )}

            <button
              className="secondary-action full"
              disabled={
                sourceImportState.status === 'importing' ||
                ((sourceImportType === 'url' || sourceImportType === 'rss') && sourceImportUrl.trim().length === 0) ||
                ((sourceImportType === 'research' || sourceImportType === 'social') &&
                  sourceImportText.trim().length === 0)
              }
              type="button"
              onClick={() => void importCurrentSource()}
            >
              {sourceImportState.status === 'importing' ? (
                <Loader2 className="spin" aria-hidden="true" />
              ) : (
                <DownloadCloud aria-hidden="true" />
              )}
              Import source
            </button>

            {sourceImportState.status === 'imported' ? (
              <p className="import-status imported">Imported {sourceImportState.title}</p>
            ) : null}
            {sourceImportState.status === 'error' ? (
              <p className="import-status error">{sourceImportState.message}</p>
            ) : null}
          </div>

          <div className="sample-list" aria-label="Sample signals">
            {sampleSignals.map((signal) => (
              <button
                className={signal.id === selectedSignalId ? 'sample active' : 'sample'}
                key={signal.id}
                type="button"
                onClick={() => loadSample(signal)}
              >
                <span>{signal.title}</span>
                <small>{signal.sourceLabel}</small>
              </button>
            ))}
            {importedSignal ? (
              <button
                className={importedSignal.id === selectedSignalId ? 'sample active imported' : 'sample imported'}
                type="button"
                onClick={() => loadImportedSignal(importedSignal)}
              >
                <span>{importedSignal.title}</span>
                <small>{importedSignal.sourceLabel}</small>
              </button>
            ) : null}
          </div>

          <label className="input-label" htmlFor="signal-text">
            Raw signal
          </label>
          <textarea
            id="signal-text"
            value={customText}
            onChange={(event) => setCustomText(event.target.value)}
            rows={9}
          />

          <div className="button-row">
            <button className="primary-action" type="button" onClick={() => void runAgent()}>
              {isRunning ? <Loader2 className="spin" aria-hidden="true" /> : <Sparkles aria-hidden="true" />}
              Run agent
            </button>
            <button className="secondary-action" type="button" onClick={() => loadSample(selectedSignal)}>
              <RefreshCw aria-hidden="true" />
              Reset
            </button>
          </div>
        </aside>

        <section className="brief-panel" aria-live="polite" aria-labelledby="brief-heading">
          <div className="section-title">
            <Sparkles aria-hidden="true" />
            <div>
              <p className="eyebrow">Agent output</p>
              <h2 id="brief-heading">{brief?.headline ?? 'Waiting for signal'}</h2>
            </div>
          </div>

          {brief ? (
            <>
              <div className="metric-row">
                <div>
                  <span className="metric">{brief.probability}%</span>
                  <small>first-pass probability</small>
                </div>
                <div>
                  <span className={`confidence ${brief.confidence}`}>{brief.confidence}</span>
                  <small>confidence</small>
                </div>
                <div>
                  <span className="metric small">{brief.timeframe}</span>
                  <small>timeframe</small>
                </div>
              </div>

              <div className="question-block">
                <p className="eyebrow">Generated market</p>
                <h3>{brief.marketQuestion}</h3>
              </div>

              <div className="two-column">
                <div>
                  <p className="eyebrow">Rationale</p>
                  <ul className="plain-list">
                    {brief.rationale.map((item, index) => {
                      const source = rationaleSourceFor(brief, item, index)
                      return (
                        <li key={`${item}-${index}`}>
                          <span>{item}</span>
                          {source ? (
                            <small className="rationale-source">
                              Source:{' '}
                              {source.sourceUrl ? (
                                <a href={source.sourceUrl} target="_blank" rel="noreferrer">
                                  {source.sourceTitle}
                                </a>
                              ) : (
                                source.sourceTitle
                              )}
                              {' · '}
                              {formatSourceTimestamp(source.publishedAt ?? source.capturedAt)}
                            </small>
                          ) : null}
                        </li>
                      )
                    })}
                  </ul>
                </div>
                <div>
                  <p className="eyebrow">Risk gates</p>
                  <ul className="plain-list warning-list">
                    {brief.riskFlags.map((item) => (
                      <li key={item}>
                        <AlertTriangle aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </>
          ) : (
            <div className="empty-state">Run the agent to generate a market brief.</div>
          )}
        </section>

        <aside className="evidence-panel" aria-labelledby="evidence-heading">
          <div className="section-title">
            <DatabaseZap aria-hidden="true" />
            <div>
              <p className="eyebrow">Arc packet</p>
              <h2 id="evidence-heading">Evidence anchor</h2>
            </div>
          </div>

          {brief ? (
            <>
              <dl className="packet-grid">
                <div>
                  <dt>Network</dt>
                  <dd>{brief.evidencePacket.network}</dd>
                </div>
                <div>
                  <dt>Chain ID</dt>
                  <dd>{brief.evidencePacket.chainId}</dd>
                </div>
                <div>
                  <dt>Asset</dt>
                  <dd>{brief.evidencePacket.settlementAsset}</dd>
                </div>
              </dl>

              <div className="hash-box">
                <p className="eyebrow">Trace hash</p>
                <code>{brief.evidencePacket.traceHash}</code>
              </div>

              <ol className="step-list">
                {brief.agentSteps.map((step) => (
                  <li key={step.label}>
                    <span className={step.status}>{step.status}</span>
                    <strong>{step.label}</strong>
                    <p>{step.detail}</p>
                  </li>
                ))}
              </ol>

              <button className="secondary-action full" type="button" onClick={() => void copyEvidence()}>
                <Clipboard aria-hidden="true" />
                {copyState === 'copied' ? 'Copied packet' : 'Copy packet JSON'}
              </button>

              <div className="evidence-actions" aria-label="Archive actions">
                <button
                  className="secondary-action full"
                  disabled={archiveState.status === 'saving'}
                  type="button"
                  onClick={() => void saveCurrentBrief()}
                >
                  {archiveState.status === 'saving' ? (
                    <Loader2 className="spin" aria-hidden="true" />
                  ) : (
                    <Archive aria-hidden="true" />
                  )}
                  {archiveState.status === 'saving' ? 'Saving brief' : 'Save brief'}
                </button>

                {archiveState.status === 'saved' ? (
                  <button className="secondary-action full" type="button" onClick={() => void copyShareLink()}>
                    <Share2 aria-hidden="true" />
                    Copy share link
                  </button>
                ) : null}
              </div>

              {archiveState.status === 'saved' ? (
                <p className="archive-status saved">Saved as {archiveState.id}</p>
              ) : null}
              {archiveState.status === 'error' ? (
                <p className="archive-status error">{archiveState.message}</p>
              ) : null}

              <div className="wallet-card" aria-label="Wallet readiness">
                <div className="wallet-heading">
                  <Wallet aria-hidden="true" />
                  <div>
                    <p className="eyebrow">Wallet</p>
                    <strong>{walletTitle(walletState)}</strong>
                  </div>
                </div>
                <p className={`wallet-status ${walletState.status}`}>
                  {walletMessage(walletState)}
                </p>
                <div className="wallet-actions">
                  {walletState.status === 'unavailable' ? (
                    <button className="secondary-action full" disabled type="button">
                      <Wallet aria-hidden="true" />
                      Wallet unavailable
                    </button>
                  ) : walletState.status === 'connected' ? (
                    <button
                      className="secondary-action full"
                      disabled={walletAction === 'switching' || walletState.isArcTestnet}
                      type="button"
                      onClick={() => void switchToArcTestnet()}
                    >
                      {walletAction === 'switching' ? (
                        <Loader2 className="spin" aria-hidden="true" />
                      ) : (
                        <Network aria-hidden="true" />
                      )}
                      {walletState.isArcTestnet ? 'Arc Testnet ready' : 'Switch to Arc Testnet'}
                    </button>
                  ) : (
                    <button
                      className="secondary-action full"
                      disabled={walletAction === 'connecting'}
                      type="button"
                      onClick={() => void connectInjectedWallet()}
                    >
                      {walletAction === 'connecting' ? (
                        <Loader2 className="spin" aria-hidden="true" />
                      ) : (
                        <Wallet aria-hidden="true" />
                      )}
                      Connect wallet
                    </button>
                  )}
                </div>
              </div>

              <TraceAnchorPanel
                archiveShareUrl={archiveState.status === 'saved' ? archiveState.shareUrl : null}
                brief={brief}
                signal={briefSignal}
                walletState={walletState}
              />
            </>
          ) : (
            <div className="empty-state">Evidence packet appears after agent output.</div>
          )}
        </aside>
      </section>
    </main>
  )
}

function walletTitle(state: WalletReadiness): string {
  if (state.status === 'connected' && state.account) {
    return state.isArcTestnet
      ? `${formatAddress(state.account)} · Arc Testnet`
      : `${formatAddress(state.account)} · Chain ${state.chainId ?? 'unknown'}`
  }

  if (state.status === 'disconnected') return 'Wallet detected'
  if (state.status === 'unavailable') return 'No injected wallet'
  if (state.status === 'error') return 'Wallet check failed'
  return 'Checking wallet'
}

function walletMessage(state: WalletReadiness): string {
  if (state.message) return state.message
  if (state.status === 'connected' && state.isArcTestnet) {
    return 'Ready for a later explicit anchor transaction.'
  }
  if (state.status === 'connected') {
    return 'Connected, but not on Arc Testnet.'
  }
  if (state.status === 'disconnected') return 'Connect before preparing an onchain anchor.'
  if (state.status === 'unavailable') return 'Install MetaMask, Rabby, or another EIP-1193 wallet.'
  return 'Checking the browser wallet provider.'
}

function importModeIcon(type: SourceImportType) {
  if (type === 'rss') return <Rss aria-hidden="true" />
  if (type === 'research') return <FileText aria-hidden="true" />
  if (type === 'social') return <MessageSquare aria-hidden="true" />
  return <Link aria-hidden="true" />
}

function rationaleSourceFor(brief: MarketBrief, rationale: string, index: number) {
  return (
    brief.rationaleSources.find((source) => source.rationale === rationale) ??
    brief.rationaleSources[index] ??
    null
  )
}

function formatSourceTimestamp(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toISOString().slice(0, 16).replace('T', ' ')
}

export default App
