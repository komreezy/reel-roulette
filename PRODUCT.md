# Product

## Platform and stack

Responsive web. Next.js App Router, React, TypeScript, Three.js / React Three Fiber, GSAP, and GLSL. Vitest covers domain and controller behavior; Playwright covers desktop and mobile flows. WebGL is the supported rendering baseline. This screen does not require scroll-driven animation or a scrolling library.

## Purpose

Choose tonight’s movie from a public Letterboxd watchlist or curated list through a satisfying physical reveal. One film appears at a time. The wall is abstract and has a repeatable visual tile count independent of the movie pool size.

## Current experience

- Import a public Letterboxd username’s watchlist or a public list URL.
- Optional, explicitly labeled eight-film demo collection.
- One Pull a movie control; subsequent pulls dismiss the previous result.
- Uniform selection without replacement; silently restart after exhaustion, with no immediate cycle-boundary repeat for pools larger than one.
- Display available movie metadata and a canonical Open in Letterboxd action.
- Change source or reset the session from the source control.
- No filters, result history, database, or persistent tracking.
- Mobile means mobile web, with the cassette above its details.

## Data and future integration

Existing bounded, validated Letterboxd fetching is reused. TMDB adds posters and curated details through a server-only credential and conservative title/year matching. Missing or ambiguous data is omitted. Plex integration is deferred: the existing server adapters and contract tests remain in the repository, but the redesigned UI does not call Plex. Diary and combined import endpoints are also retained without exposing them in the new UI.

## Interaction and accessibility

The Living Archive is glossy and rounded, with a black-to-surfacing introduction, restrained idle movement, and a continuous tile-to-cassette transformation. Semantic controls and HTML details carry the functionality independently of the canvas. Keyboard focus, reduced motion, pause, context-loss recovery, and a non-WebGL fallback are required. Stale imports and canceled animations cannot reveal an old result or consume an unseen film.
