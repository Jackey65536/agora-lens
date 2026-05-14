# Agora Lens

Agora Lens is a local MVP for the Agora Agents Hackathon. It turns multilingual market signals into prediction-market briefs, generates a first-pass probability and resolution sketch, then prepares an Arc-ready evidence packet.

## Local Development

```bash
npm install
npm run dev
```

## Production Server

Build the app and run the static/API server:

```bash
npm run build
npm run serve
```

The server exposes:

- `GET /api/health`
- `POST /api/briefs`
- `GET /api/briefs/:id`
- `GET /api/briefs`

## Deployment

Deploy to the current hackathon server:

```bash
./scripts/deploy-server.sh
```

The script runs tests, lint, and build, uploads a release archive to
`/home/jackey/apps/agora-lens/releases/<timestamp>`, updates the `current`
symlink, and restarts the user-level systemd service.

Operational commands on the server:

```bash
systemctl --user status agora-lens
journalctl --user -u agora-lens -n 100 --no-pager
systemctl --user restart agora-lens
```

The current production URL is `http://60.204.151.206:18080/`. HTTPS requires a
domain pointed at the server before certificate automation can be enabled.

Production safety defaults:

- `AGORA_LENS_MAX_BODY_BYTES=262144`
- `AGORA_LENS_POST_RATE_LIMIT=20`
- `AGORA_LENS_RATE_LIMIT_WINDOW_MS=60000`

The server also sends basic security headers on API and static responses,
including CSP, frame denial, `nosniff`, no-referrer, and a restrictive
permissions policy.

## Wallet Readiness

The app can detect an injected EIP-1193 wallet, connect on user click, and ask
the wallet to switch or add Arc Testnet. It does not sign transactions, store
private keys, or submit onchain anchors yet.

Arc Testnet parameters:

- Chain ID: `5042002`
- RPC URL: `https://rpc.testnet.arc.network`
- Currency symbol: `USDC`
- Explorer: `https://testnet.arcscan.app`

## Trace Anchoring

Compile the Solidity contract and regenerate the frontend artifact:

```bash
npm run contracts:compile
```

The contract source is `contracts/TraceAnchor.sol`. It records one append-only
anchor per trace hash:

- `traceHash`: SHA-256 evidence digest from the agent packet
- `signalId`: SHA-256 digest of the source signal ID
- `publisher`: wallet address that signed the transaction
- `uri`: saved brief/share URL or other offchain trace pointer

The frontend can ask the connected wallet to deploy `TraceAnchor` or submit
`anchorTrace(bytes32,bytes32,string)`. Both paths require an explicit wallet
transaction confirmation from the user.

Current Arc Testnet deployment:

- Contract: `0x19b8ea4ac5be5f6b4c4c86f874a911f80978c506`
- Deploy tx: `https://testnet.arcscan.app/tx/0x08548941b9392f92c96918d5abc7e88ef8ca2da7817359091de8b22cabab1c83`
- First anchor tx: `https://testnet.arcscan.app/tx/0x61dc72ce8f900c1b38b0f1de3bf9dc697055b7d14e6a6a672c6a63791a075368`
- First anchored trace: `0x9dd8004651df6deeae006b333f8702cdab7726dc23dc0d5aebdab3b62004cdc2`
- First anchored brief: `http://60.204.151.206:18080/?brief=brief_20260514170832_e7433097`

## Source Import

The server exposes `POST /api/sources/import` so the frontend can import real
source material before running the local agent. Supported input types:

- `url`: fetches a public webpage and extracts readable text.
- `rss`: fetches a public RSS/Atom feed and imports the latest deduped items.
- `research`: imports an operator-provided research note.
- `social`: imports an operator-provided thread or post.

Remote URL imports validate the scheme, block local/private network targets,
cap response size, and preserve source references with URL, title, captured
time, and optional published time. The generated market brief binds each
rationale row back to those source references.

## Verification

```bash
npm test
npm run lint
npm run contracts:compile
npm run build
```

## Whitepapers

- [中文白皮书](docs/whitepaper.zh-CN.md)
- [English whitepaper](docs/whitepaper.en-US.md)

## Current Scope

- Local deterministic agent for demo reliability.
- No real trades, funds, or private keys.
- Evidence packet includes an Arc testnet chain ID and SHA-256 trace hash that can be anchored on Arc Testnet.
