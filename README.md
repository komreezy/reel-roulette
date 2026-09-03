# Reel Roulette

One fair turn through a Plex movie library. Reel Roulette connects through Plex PIN authentication, lets you narrow the eligible shelf, and chooses one film without recommendations or a database.

Reel Roulette is an independent open-source project and is not affiliated with or endorsed by Plex, Inc. Plex is a trademark of Plex, Inc.

## Local setup

```bash
npm install
cp .env.example .env.local
# set SESSION_SECRET to 32+ random characters
npm run dev
```

Unauthenticated visitors get a clearly labeled secondary demo shelf. Connect Plex to start the current JWT PIN flow: a per-session Ed25519 keypair, key ID, and random client identifier are generated server-side; the pending PIN and private key are encrypted in an HttpOnly cookie. The browser receives only Plex’s authorization URL and polls the server. A hosted Vercel deployment accepts only non-local HTTPS connections on Plex-managed `plex.direct` or `plex.services` hosts; LAN-only or custom-host connections are reported as unreachable honestly.

## Deploy to Vercel

Import this repository into Vercel, set `SESSION_SECRET` to a strong random value and `APP_ORIGIN` to the deployment’s canonical HTTPS origin in Project Settings → Environment Variables, and deploy. No database or other integration is required. Self-hosting uses the same environment variables and `npm run build && npm start`.

## Privacy

The Plex JWT and client ID are sealed with AES-GCM in an HttpOnly cookie and expire after eight hours. Per-server resource tokens are re-discovered server-side when needed; none of these credentials are written to localStorage or exposed to client JavaScript. Plex metadata exists only in the request/client session and is not persisted by the app. Images are proxied only for validated metadata artwork paths from a re-discovered Plex resource. JWT nonce refresh is out of scope; users reconnect after the app session expires.

## Commands

`npm test` runs domain and security tests. `npm run test:e2e` starts or reuses the local app and runs desktop and mobile browser flows. `npm run lint`, `npm run typecheck`, and `npm run build` are the release checks.

See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [LICENSE](LICENSE).
