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
      <p>
        <Link href="/">Back to the archive ↗</Link>
      </p>
    </main>
  );
}
