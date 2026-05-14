# Agora Lens

Agora Lens is a local MVP for the Agora Agents Hackathon. It turns multilingual market signals into prediction-market briefs, generates a first-pass probability and resolution sketch, then prepares an Arc-ready evidence packet.

## Local Development

```bash
npm install
npm run dev
```

## Verification

```bash
npm test
npm run lint
npm run build
```

## Whitepapers

- [中文白皮书](docs/whitepaper.zh-CN.md)
- [English whitepaper](docs/whitepaper.en-US.md)

## Current Scope

- Local deterministic agent for demo reliability.
- No real trades, funds, wallets, or private keys.
- Evidence packet includes an Arc testnet chain ID and SHA-256 trace hash ready for later onchain anchoring.
