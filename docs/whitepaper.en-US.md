# Agora Lens Whitepaper

Version: 0.1
Date: 2026-05-14
Status: Hackathon MVP technical whitepaper
Live demo: http://60.204.151.206:18080/
Repository: https://github.com/Jackey65536/agora-lens

## Abstract

Agora Lens is a multilingual market-signal agent for prediction markets and onchain financial agents. It does not replace traders, custody funds, or execute real trades. Its purpose is to transform messy, multilingual, and time-sensitive market information into structured prediction-market briefs that humans and downstream systems can inspect, improve, and eventually anchor onchain.

The current MVP implements a deterministic local agent. A user provides a raw market signal, and the system detects language, classifies the signal, converts it into an English market thesis, drafts a prediction-market question, estimates a first-pass probability, applies confidence and risk gates, and produces an Arc-ready evidence packet. The evidence packet includes a stable payload, SHA-256 trace hash, Arc Testnet chain ID, USDC settlement context, and copyable JSON output.

The long-term vision is to make Agora Lens a market-question generation layer. AI agents should not only recommend trades; they should also make their reasoning, sources, market definitions, and resolution criteria legible. In prediction markets, the valuable object is not only the final YES or NO position. It is the full path from a raw signal to a well-scoped market that people can trust, price, dispute, and settle.

## Background and Problem

Prediction markets aggregate information by converting uncertain future events into priced claims. However, many high-value signals never become good markets.

The bottlenecks are structural:

- Multilingual signals arrive before English-language markets notice them. Mandarin macro notes, Spanish policy threads, and local regulatory rumors often move through local communities first.
- Market-writing is hard. A tradable question needs clear boundaries, a time window, resolution criteria, invalidation rules, and credible data sources.
- AI reasoning is often opaque. Many agents output a conclusion without enough evidence, intermediate steps, or calibration logic for others to audit.
- High-frequency, low-value agent actions need stable and low-cost settlement. Translation, question drafting, recommendation, verification, and reward attribution do not work well when every action requires expensive or volatile gas.

Agora Lens starts with translation and market generation. It converts raw multilingual signals into English prediction-market briefs, then packages the agent trace as a hashable evidence object. Even before real trades are introduced, this creates a foundation for onchain trace anchoring, agent reputation, market-creation rewards, and auditable decision-making.

## Product Positioning

Agora Lens is a market-intelligence agent, not a trading bot.

It is designed for three groups:

- Market creators who need to turn news, policy events, research notes, and community signals into well-defined prediction markets.
- Researchers and traders who need to compare marketability, confidence, risk, and resolution feasibility across many signals.
- Agent builders who need their reasoning outputs to become verifiable, reusable, and monetizable.

The current MVP opens directly into a working console. Users can select sample signals or paste their own raw text, then run the agent. The interface has three surfaces:

- Signal intake: raw multilingual input.
- Agent output: generated market question, probability, confidence, rationale, and risks.
- Arc packet: chain ID, settlement asset, trace hash, and copyable JSON.

## Current Implementation

The current product is built with React, TypeScript, Vite, and a lightweight Node API. For hackathon reliability, it keeps the deterministic agent as the default and fallback path. When the server is configured with `OPENAI_API_KEY`, it can call an LLM from the server to draft translations, market questions, probabilities, and rationale. The browser never receives the LLM API key, and the rule layer still owns resolution criteria, risk gates, source binding, and evidence hashing. It does not ask for trading accounts, private keys, seed phrases, or funds.

The core agent logic lives in `src/lib/agoraAgent.ts`.

The pipeline is:

1. Ingest: receive a sample or user-provided market signal, then normalize whitespace and links.
2. Detect: identify Mandarin Chinese, Spanish, or English using character and keyword signals.
3. Classify: map the signal into categories such as macro policy, prediction-market verticals, social trading intelligence, or crypto market structure.
4. Translate: convert non-English signals into English market theses.
5. Price: generate a first-pass probability based on source type, numeric triggers, official signals, multi-source reinforcement, and uncertainty markers.
6. Gate: assign low, medium, or high confidence and surface risk flags such as translation drift or weak evidence.
7. Draft: create a YES/NO market question, resolution sketch, and invalidation condition.
8. Anchor: stable-stringify the evidence payload and compute a SHA-256 trace hash for future Arc anchoring.

The current samples cover three use cases:

- Mandarin macro policy signals involving CNH, central-bank language, Hong Kong property equities, and high-yield USD credit.
- Hyperliquid whale migration as a social-trading intelligence signal.
- Spanish energy-policy discussion that has not yet reached English prediction markets.

## Technical Architecture

Agora Lens currently uses a local frontend-agent architecture:

```text
Raw signal
  -> normalization
  -> language detection
  -> category classifier
  -> thesis translator
  -> probability estimator
  -> risk gate
  -> contract sketcher
  -> evidence packet builder
  -> SHA-256 trace hash
```

This design has several advantages:

- Reliable demo behavior without external API downtime.
- No sensitive-data surface because there is no login, wallet, key, or fund custody.
- Testable core logic through unit tests.
- Clear migration path from deterministic rules to LLMs, retrieval, onchain data, and external APIs.

The security boundary is explicit: the app creates briefs and evidence packets only. It does not place bets, transfer funds, store secrets, or submit transactions.

## Arc and USDC Evidence Anchoring

Agora Lens is not designed to put full reasoning traces directly onchain. Instead, full traces can be stored offchain while their cryptographic digest is written onchain. This preserves auditability while keeping cost, privacy, and storage overhead under control.

The current evidence packet looks like:

```json
{
  "network": "Arc Testnet",
  "chainId": 5042002,
  "settlementAsset": "USDC",
  "traceHash": "0x...",
  "storagePlan": "Pin full trace JSON offchain, then write this SHA-256 digest to an Arc contract event or memo field.",
  "payload": {
    "agent": "Agora Lens local agent v0.1",
    "signalId": "...",
    "generatedAt": "...",
    "marketQuestion": "...",
    "probability": 60,
    "confidence": "medium",
    "rationale": ["..."],
    "resolution": "..."
  }
}
```

A future Arc Testnet contract can start with a minimal event:

```solidity
event TraceAnchored(
    bytes32 indexed traceHash,
    string signalId,
    address indexed publisher,
    uint64 generatedAt
);
```

The complete trace remains offchain. The chain stores the digest and minimal metadata. Anyone can recompute the hash and verify that a market question, probability, rationale, and resolution sketch were not modified after publication.

Arc is a natural fit because it is an EVM-compatible, stablecoin-native Layer 1. Arc Testnet uses chain ID `5042002`, and the product is designed around a USDC settlement context. For agent economies, stable denomination and predictable fees make small, frequent, auditable actions easier to reason about than volatile gas-token costs.

## Market Design

Agora Lens can support four market mechanisms.

### 1. Pre-Market Creation Layer

The agent drafts a market question, resolution criteria, invalidation rule, and evidence packet. Human market creators review the output before launching an actual market.

### 2. Translation as Alpha

Non-English signals often surface first in local contexts. Agents can compete to translate local information into tradable market questions. If a translated question later produces market volume, builder fees, or creation revenue, rewards can flow back to the translator.

### 3. Trace Markets

Users can evaluate not only whether a final prediction was correct, but whether a reasoning pattern repeatedly produces useful markets. Over time, agent traces can become comparable research assets.

### 4. Agent Reputation and Rewards

Every agent output can be hashed and anchored. If later market resolution proves a question valuable, rewards can be distributed to the agents and humans that first generated the valid question, supplied evidence, or improved the resolution rules.

## Risk Management

Agora Lens treats risk as a first-class output rather than hiding it behind a probability number.

Core risks include:

- Translation drift: the meaning of a non-English source may shift when rewritten as an English market question.
- Ambiguous resolution: markets without objective data sources can create disputes.
- Weak evidence: early rumors, secondhand posts, and social screenshots require confidence discounts.
- Market manipulation: an agent may be induced to create questions that benefit an existing position.
- Over-automation: connecting flawed questions directly to real trades could create real losses.

The current MVP mitigates these risks by design:

- No automatic trading.
- No wallet control.
- No real funds.
- Risk flags on every output.
- Resolution and invalidation sketches on every market question.
- Copyable and re-hashable evidence packets.

Future releases should add human approval, source citations, duplicate-market detection, oracle availability checks, abnormal-probability detection, and manipulation warnings.

## Business Model

Agora Lens does not need to issue a token to become commercially useful.

Potential models include:

- Professional research workspace for traders, researchers, and market creators.
- API fees for converting multilingual signals into prediction-market briefs.
- Builder-fee share when a generated market or recommendation drives real trading flow.
- Market-creation SaaS for communities, companies, and DAOs that need internal prediction markets.
- Trace-data subscriptions for research, backtesting, and model training.

The immediate priority is not monetization. The first proof points are:

- Can the system consistently generate market questions that humans want to review?
- Can it identify cross-language and cross-market information gaps earlier than manual workflows?

## Roadmap

### v0.1: Hackathon MVP

- Deterministic local agent.
- Multilingual sample inputs.
- Market question, probability, confidence, risk, and evidence-packet outputs.
- Static live demo and public GitHub repository.

### v0.2: Real Signals and Source Citations

- Ingest news, social, research-note, and onchain sources.
- Attach source URLs and timestamps to each rationale point.
- Add duplicate-market detection.
- Add human approval flow.

### v0.3: Arc Testnet Anchoring

- Deploy a trace-anchoring contract.
- Support wallet signing and testnet transactions.
- Write trace hashes to Arc Testnet.
- Show transaction hashes and explorer links in the UI.

### v0.4: Market Lifecycle

- Move from briefs into market-creation drafts.
- Check oracle and resolution data-source availability.
- Add post-resolution review: prediction accuracy, question validity, and trace value.

### v1.0: Agent Market Network

- Multiple agents compete to generate questions.
- Trace reputation.
- Builder-fee and reward attribution.
- Integrations with third-party prediction markets, wallets, and settlement systems.

## Hackathon Fit

Agora Lens maps directly to the Agora Agents Hackathon evaluation dimensions:

- Agentic sophistication: the system does more than format text. It classifies, translates, estimates probability, gates risk, drafts market contracts, and prepares evidence for anchoring.
- Traction: the current public demo can already collect user signals and let judges test the workflow directly.
- Circle tool usage: the evidence packet is designed around Arc Testnet and USDC settlement, with a clear path to Arc RPC, wallets, and contracts.
- Innovation: the project combines cross-language market-question generation with hashable agent traces, treating reasoning itself as market infrastructure.

## Disclaimer

Agora Lens is not a financial advisor, broker, exchange, trading system, or custodial wallet. Its probabilities, market questions, and risk flags are for research, product demonstration, and hackathon evaluation only. They are not investment advice. The current MVP does not use real funds, execute trades, store private keys, or require seed phrases.

If future versions connect to real markets or onchain assets, they will require stronger compliance review, risk controls, audits, permissioning, and explicit user approvals.

## References

- Agora Agents Hackathon: https://agora.thecanteenapp.com/
- Arc Developer Docs: https://docs.arc.network/
- Connect to Arc: https://docs.arc.network/arc/references/connect-to-arc
- Arc EVM Compatibility: https://docs.arc.network/arc/references/evm-compatibility
- Arc Gas and Fees: https://docs.arc.network/arc/references/gas-and-fees
