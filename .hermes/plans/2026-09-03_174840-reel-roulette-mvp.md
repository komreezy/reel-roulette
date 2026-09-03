# Reel Roulette MVP Implementation Plan

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Build and deploy an open-source one-page Plex movie randomizer with fair selection, a minimalist wheel, movie details, useful filters, and no database.

**Architecture:** A Next.js App Router application keeps the Plex token in an encrypted, HTTP-only session cookie. Server route handlers perform PIN authentication, discover reachable Plex servers, enumerate movie libraries, and proxy normalized movie metadata. The client owns ephemeral filtering, exclusions, wheel animation, and detail-panel state; the selection function chooses uniformly from the complete eligible pool before animation.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind CSS, Web Crypto/Node crypto, Vitest + Testing Library, Playwright browser verification, GitHub, Vercel.

---

## Milestone 1: Foundation and contracts

- Define Plex API DTOs and normalized application models.
- Add runtime environment validation and encrypted cookie helpers.
- Add unit tests for session encryption, normalization, filtering, and uniform candidate selection boundaries.
- Document setup, privacy behavior, Vercel variables, and self-hosting.

## Milestone 2: Plex authentication and data access

- Implement PIN creation, polling, disconnect, and session-status route handlers.
- Discover Plex servers through the account resources endpoint.
- Select only connection URIs returned by Plex; do not accept arbitrary proxy URLs from the browser.
- Enumerate movie library sections and fetch movie metadata with required fields.
- Normalize Plex XML/JSON responses and return stable application DTOs.
- Surface unauthenticated, expired PIN, unreachable server, no library, and no movie states.

## Milestone 3: One-page product experience

- Create the first-run Plex connection state.
- Create server/library selection and a compact filter drawer for watched status, genres, and maximum runtime.
- Display eligible count and clear active filters.
- Implement the wheel as an accessible canvas/SVG or DOM visualization with restrained easing and reduced-motion support.
- Choose the winner from the entire eligible array before preparing the readable visual wheel.
- Open a reusable desktop dialog/mobile sheet when a wheel movie or result is selected.
- Add Open in Plex, Spin Again, and Exclude & Spin Again actions.

## Milestone 4: Visual finish and responsive QA

- Establish a quiet poster-led design system: deep neutral surfaces, one warm functional accent, careful typography, sparse controls, and artwork-derived color only where useful.
- Verify keyboard focus, dialog behavior, reduced motion, loading feedback, errors, and small-screen layout.
- Run the Impeccable detector once after the UI is complete.
- Capture desktop and mobile screenshots and conduct an independent finish review.

## Milestone 5: Open-source and deployment

- Add MIT license, contribution notes, security/privacy documentation, `.env.example`, and one-click Vercel instructions.
- Run unit tests, lint, typecheck, production build, and browser smoke tests.
- Run an independent security/code review and resolve blocking findings.
- Commit to a new public GitHub repository and push `main`.
- Configure a generated `SESSION_SECRET` in Vercel without printing it.
- Deploy production and verify the live URL, including unauthenticated UI and Plex PIN initiation.

## Verification criteria

- Selection tests prove the winner is drawn from the full eligible pool and respects exclusions.
- Filter tests cover watched state, multiple genres, runtime, and empty pools.
- Plex route tests cover authentication and normalized API/error behavior with mocked upstream responses.
- `npm test`, `npm run lint`, `npm run typecheck`, and `npm run build` pass.
- Desktop and mobile browser smoke tests pass with no console errors.
- The live Vercel URL loads and can initiate Plex authentication.
- No Plex token, server address, or library contents are persisted to a database or client-readable cookie.

## Risks and tradeoffs

- A Vercel-hosted app cannot reach LAN-only Plex connections; the UI must explain when Remote Access or Plex Relay is required.
- Plex APIs are less formally documented than a conventional OAuth provider; isolate upstream details behind typed adapters and fixtures.
- A readable wheel cannot show a large library; animation candidates are visual representatives while selection remains uniform across the full pool.
- Some Plex artwork URLs require authorization; proxy only image paths obtained from Plex and keep caching conservative.
