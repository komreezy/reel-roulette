# Reel Roulette

Leave tonight to chance. Import a public Letterboxd watchlist or list and pull one movie out of the Living Archive: a glossy, animated wall of rounded tiles. Each film appears once per cycle; the shelf silently starts again when the cycle ends.

Reel Roulette is an independent open-source project and is not affiliated with or endorsed by Plex or Letterboxd. Their names and marks belong to their respective owners.

## Letterboxd public datasets

Enter a public username under Watchlist, or choose List URL and paste a public curated list. The existing server fetcher validates public Letterboxd paths and enforces bounded time, size, page, and film limits. No Letterboxd credentials or cookies are requested. Your collection stays in memory. Set `TMDB_API_READ_TOKEN` on the server to enrich films with posters, directors, runtime, genres, and synopsis. Unique normalized title/year matches are required; ambiguous matches keep the original details. Public TMDB responses are cached for one day. The portrait reveal remains usable when enrichment or artwork fails.

## Local setup

```bash
npm install
npm run dev
```

Use the demo shelf to try the complete experience without importing a list. The responsive WebGL scene uses React Three Fiber, Three.js, GSAP, and a custom GLSL sheen. Fonts and reflections are served/generated locally. Reduced motion and unavailable WebGL retain a functional HTML/CSS selection path.

Plex is deferred for a later integration. Its existing API routes and security adapters remain intact, but the new interface never calls them. To exercise those retained endpoints, copy `.env.example` to `.env.local` and configure the documented session secret and origin. Diary/combined fetching is likewise retained as backend functionality only.

## Deploy to Vercel

Import this repository into Vercel and deploy as a Next.js app. The current Letterboxd interface needs no secrets or database. Self-hosting uses `npm run build && npm start`. Configure `SESSION_SECRET` and `APP_ORIGIN` before using the retained Plex endpoints; see `.env.example` and [SECURITY.md](SECURITY.md).

## Privacy

There is no database or localStorage history. Letterboxd imports use the public username or curated-list URL and public numbered pages. No Letterboxd credentials or cookies are requested. Refreshing the page clears the collection and pull history. See [SECURITY.md](SECURITY.md) for the retained Plex adapters’ security model.

## Commands

`npm test` runs domain and security tests. `npm run test:e2e` starts or reuses the local app and runs desktop and mobile browser flows, including a mocked Letterboxd import. `npm run lint`, `npm run typecheck`, and `npm run build` are the release checks.

See [SECURITY.md](SECURITY.md), [CONTRIBUTING.md](CONTRIBUTING.md), and [LICENSE](LICENSE).
