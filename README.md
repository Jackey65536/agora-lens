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
