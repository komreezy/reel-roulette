# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Delegated: Next.js App Router with TypeScript, React, Tailwind CSS, Vitest, and Vercel. Chosen for server-side Plex token handling, simple open-source self-hosting, and direct Vercel deployment.

## Users

People who operate or share access to a Plex Media Server and want to choose a movie without prolonged browsing, either alone or with others in a living room.

## Product Purpose

Connect to Plex, retrieve a real movie library, narrow the eligible pool, and make a fair random selection through a satisfying wheel interaction. Success means a user can connect, spin, inspect the result, and open it in Plex within one short session.

## Positioning

The product separates fair selection from visual animation: every eligible movie has an equal chance even when the wheel can only render a readable sample. It is an open-source, privacy-conscious companion rather than a recommendation engine.

## Operating Context

Users arrive through a public Vercel deployment or a self-hosted instance. They authorize Plex, select a server and movie library, apply a small set of filters, spin, inspect movie details, and optionally open the winner in Plex.

## Capabilities and Constraints

- Plex PIN authentication and Plex server/library discovery.
- Movies only in version one.
- Filters: library, watched state, genre, and maximum runtime.
- Wheel animation is the initial selection visualization; future animation modes may be interchangeable.
- Movie details include available artwork, title, year, summary, runtime, content rating, genres, watched state, ratings, and Open in Plex.
- Winner actions: Open in Plex, Spin Again, and Exclude & Spin Again.
- Exclusions and repeat prevention affect only the current session and never modify Plex.
- Public Vercel app plus self-hosting.
- No application database; Plex credentials and library data are short-lived.
- Hosted access depends on the Plex server exposing a reachable secure/relay connection.
- TV, voting, persistent history, AI recommendations, weighted selection, and advanced filters are out of scope for version one.

## Brand Commitments

The interface must be minimalist and as elegant as possible. It should remain product-led and restrained rather than decorative. The working product name is "Reel Roulette" and may change before public launch.

## Evidence on Hand

No testimonials, usage metrics, customer claims, brand assets, or production screenshots exist yet. Do not fabricate them. Real Plex metadata and posters become the product content after authorization.

## Product Principles

- Fairness is testable and independent of animation.
- The movie artwork is the visual content; interface chrome stays quiet.
- A user should reach a decision with very few controls and no account beyond Plex.
- Privacy defaults to no database and short-lived sessions.
- Empty, unreachable-server, and authorization states must be honest and recoverable.

## Accessibility & Inclusion

Keyboard operation, visible focus, readable contrast, semantic controls, and a reduced-motion result path are required. The wheel must not be the only way the winner is communicated.
