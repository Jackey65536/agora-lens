import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Clipboard,
  DatabaseZap,
  Globe2,
  Loader2,
  RefreshCw,
  Share2,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { analyzeSignal, sampleSignals, type MarketBrief, type MarketSignal } from './lib/agoraAgent'
import { briefIdFromSearch, loadBriefArchive, saveBriefArchive, shareUrlForBrief } from './lib/briefArchive'
import './App.css'

const APP_VERSION = '0.2.0'

function App() {
  const [selectedSignalId, setSelectedSignalId] = useState(sampleSignals[0].id)
  const [customText, setCustomText] = useState(sampleSignals[0].text)
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

  const selectedSignal = useMemo(
    () => sampleSignals.find((signal) => signal.id === selectedSignalId) ?? sampleSignals[0],
    [selectedSignalId],
  )

  useEffect(() => {
    let isActive = true
    const briefId = briefIdFromSearch(window.location.search)

    if (briefId) {
      void loadBriefArchive(briefId)
        .then((record) => {
          if (!isActive) return
          setSelectedSignalId(record.signal.id)
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
    setSelectedSignalId(signal.id)
    setCustomText(signal.text)
    void runAgent(signal)
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
                    {brief.rationale.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
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
            </>
          ) : (
            <div className="empty-state">Evidence packet appears after agent output.</div>
          )}
        </aside>
      </section>
    </main>
  )
}

export default App
