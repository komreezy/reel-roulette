# Reel Roulette design

Reel Roulette is the Living Archive: an abstract wall of fixed, vertical, rounded resin tiles. Milky pearl, deep aubergine, and occasional coral, violet, cyan, or chartreuse accents form a quiet, tactile cinema object. Instrument Serif gives the titles an editorial voice; DM Sans handles the controls. Fonts are served locally.

The first visit rises from black through a broad surfacing wave. Public Letterboxd watchlist/list setup sits over the wall, with a clearly labeled demo shelf. Once loaded, the setup collapses to a source/count control and one persistent Pull a movie button. There are no filters.

Each pull chooses the film first, independently chooses a visible tile, converges a ripple, and extrudes that tile into a rounded horizontal 1.8:1 cassette. The cassette carries a typographic paper label and its original tile accent. On the next pull, it returns to its original socket while the next locating wave begins. Motion is controlled and elastic, around 1.6 seconds for the first pull and 1.5 seconds afterward.

On desktop the cassette sits left of an aligned metadata column. On mobile web it sits above the metadata; long details scroll while the pull control stays reachable. The scene follows a measured DOM anchor when the viewport changes. Only available metadata is shown. Current Letterboxd imports provide title, optional year, and a film URL, so the typography is the primary label treatment.

The WebGL scene uses React Three Fiber, instanced rounded geometry, procedural environment reflections, a GLSL sheen, and GSAP timelines. Pixel density is capped on phones. Ambient motion can be paused, stops in hidden tabs, and respects reduced motion. Semantic HTML provides all controls and movie details. WebGL failure activates a CSS wall/cassette and preserves the selection flow.

Films draw uniformly without replacement. Exhaustion silently restarts the cycle, excluding the last film from the first draw of the next cycle when more than one film exists. A canceled reveal consumes nothing. Source imports and animation completion are guarded against stale results.
