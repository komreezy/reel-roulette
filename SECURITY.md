# Security

Please report security issues privately to the repository maintainers rather than opening a public issue. Never include Plex tokens, server URLs, or private library metadata in reports.

Reel Roulette uses Plex’s current strong JWT PIN flow. Each login creates an Ed25519 keypair, random client identifier, and key ID server-side. Pending PIN state and private key are AES-GCM sealed in an HttpOnly cookie; on claim it rotates to an eight-hour encrypted session cookie containing the Plex JWT and client ID. The browser never receives private keys, Plex tokens, resource tokens, or server URLs. JWT nonce refresh is out of scope; reconnect after expiry.

There is no database. Server connections are re-discovered from Plex resources for every route, require each resource’s own access token, and are restricted to non-local HTTPS connections on Plex-managed `plex.direct` or `plex.services` hosts and expected ports. Artwork accepts only validated relative metadata paths and is fetched server-side with `redirect:error`, timeouts, MIME limits, and streaming byte caps. Hosted Vercel deployments cannot reach LAN-only servers.

Set a strong `SESSION_SECRET`, an allowlisted HTTPS `APP_ORIGIN`, and use HTTPS. Report security issues privately; never include Plex tokens, server URLs, or private library metadata.
