import Link from "next/link";
export default function PrivacyPage() {
  return (
    <main className="privacy-page">
      <Link className="brand" href="/">
        reel roulette
      </Link>
      <h1>Privacy, plainly.</h1>
      <p>
        Reel Roulette has no database. Your imported films and the movies you
        have pulled stay in this browser session. Refreshing the page clears
        your shelf.
      </p>
      <p>
        When you enter a Letterboxd username or list URL, our server reads its
        public pages. We never ask for a Letterboxd password, token, or cookie.
        Private lists cannot be imported.
      </p>
      <p>
        Opening a film takes you to Letterboxd in a new tab, where Letterboxd’s
        own privacy policy applies.
      </p>
      <h2>Movie artwork & credits</h2>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img width="110" height="44" style={{ objectFit: "contain", background: "#fff", padding: 8, borderRadius: 6 }} src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg" alt="TMDB" />
      <p>Movie titles and years are sent to TMDB to find artwork and details. Public movie details are cached on our server. Poster images load from TMDB’s image service.</p>
      <p>This product uses the TMDB API but is not endorsed or certified by TMDB.</p>
      <p><a href="https://www.themoviedb.org" target="_blank" rel="noreferrer">The Movie Database ↗</a></p>
      <p>
        <Link href="/">Back to the archive ↗</Link>
      </p>
    </main>
  );
}
