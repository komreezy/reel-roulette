"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { useArchive } from "@/components/archive/use-archive";
import type { ArchivePull, HeroBounds } from "@/lib/archive-types";

const ArchiveScene = dynamic(
  () => import("@/components/archive/archive-scene"),
  { ssr: false },
);

function Icon({
  name,
}: {
  name: "arrow" | "external" | "close" | "pause" | "play" | "shelf" | "reset";
}) {
  const paths = {
    arrow: "M4 12h15m-6-6 6 6-6 6",
    external: "M7 17 17 7M7 7h10v10",
    close: "m6 6 12 12M6 18 18 6",
    pause: "M8 5v14M16 5v14",
    play: "m9 5 10 7-10 7V5Z",
    shelf: "M5 5v14M12 3v16M19 7v12M3 21h18",
    reset: "M4 10a8 8 0 1 1 1 7M4 4v6h6",
  };
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name]} />
    </svg>
  );
}
function subscribeMotion(callback: () => void) {
  const query = window.matchMedia("(prefers-reduced-motion: reduce)");
  query.addEventListener("change", callback);
  return () => query.removeEventListener("change", callback);
}
const getMotion = () =>
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const getServerMotion = () => true;
function subscribeVisibility(callback: () => void) {
  document.addEventListener("visibilitychange", callback);
  return () => document.removeEventListener("visibilitychange", callback);
}
const getHidden = () => document.hidden;
const getServerHidden = () => false;

class SceneBoundary extends Component<
  { children: ReactNode; onFail: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFail();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}
function FlatCassette({ pull }: { pull: ArchivePull }) {
  return (
    <div
      className="flat-cassette"
      style={{ "--accent": pull.accent } as CSSProperties}
      aria-hidden="true"
    >
      <div className="cassette-rim">
        <div className="cassette-label">
          <div className="cassette-label-top">
            <span>REEL ROULETTE</span>
            <span>№ {String(pull.serial).padStart(3, "0")}</span>
          </div>
          <strong>{pull.movie.title}</strong>
          <div className="cassette-label-bottom">
            <span>{pull.movie.year ?? "FEATURE FILM"}</span>
            <span>AN EVENING LEFT TO CHANCE ↗</span>
          </div>
        </div>
      </div>
      <span className="cassette-edge">RR / THE LIVING ARCHIVE</span>
    </div>
  );
}

export default function Home() {
  const archive = useArchive();
  const { reveal } = archive;
  const reducedMotion = useSyncExternalStore(
    subscribeMotion,
    getMotion,
    getServerMotion,
  );
  const hidden = useSyncExternalStore(
    subscribeVisibility,
    getHidden,
    getServerHidden,
  );
  const [paused, setPaused] = useState(false);
  const [sourceKind, setSourceKind] = useState<"watchlist" | "list">(
    "watchlist",
  );
  const [username, setUsername] = useState("");
  const [listUrl, setListUrl] = useState("");
  const [editing, setEditing] = useState(false);
  const [webglReady, setWebglReady] = useState(false);
  const [webglFailed, setWebglFailed] = useState(false);
  const [heroBounds, setHeroBounds] = useState<HeroBounds | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const sourceDialog = useRef<HTMLDialogElement>(null);
  const pullButton = useRef<HTMLButtonElement>(null);
  const sourceButton = useRef<HTMLButtonElement>(null);
  const setup = archive.sourceKind === null;
  const winner = archive.winner;
  const mode = setup
    ? "setup"
    : archive.pulling
      ? "pulling"
      : winner
        ? "result"
        : "ready";
  const inputValue = sourceKind === "watchlist" ? username : listUrl;
  const onSceneReady = useCallback(() => setWebglReady(true), []);
  const onSceneError = useCallback(() => {
    setWebglFailed(true);
    setWebglReady(false);
  }, []);

  useEffect(() => {
    if (webglReady || webglFailed) return;
    // Async renderer creation failures must still leave a usable shelf.
    const timer = window.setTimeout(onSceneError, 8000);
    return () => window.clearTimeout(timer);
  }, [webglReady, webglFailed, onSceneError]);

  useEffect(() => {
    const element = anchor.current;
    if (!element) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const rect = element.getBoundingClientRect();
        setHeroBounds({
          x: rect.x,
          y: rect.y,
          width: rect.width,
          height: rect.height,
        });
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure);
    };
  }, [mode]);
  useEffect(() => {
    if (editing) sourceDialog.current?.showModal();
    else sourceDialog.current?.close();
  }, [editing]);
  useEffect(() => {
    if (!archive.pulling || !archive.pull || (!webglFailed && webglReady))
      return;
    const serial = archive.pull.serial;
    const timer = window.setTimeout(
      () => reveal(serial),
      reducedMotion ? 120 : 1400,
    );
    return () => window.clearTimeout(timer);
  }, [
    archive.pulling,
    archive.pull,
    reveal,
    webglFailed,
    webglReady,
    reducedMotion,
  ]);

  function changeKind(kind: "watchlist" | "list") {
    archive.cancelImport();
    setSourceKind(kind);
  }
  function changeValue(value: string) {
    archive.cancelImport();
    if (sourceKind === "watchlist") setUsername(value);
    else setListUrl(value);
  }
  async function importCollection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await archive.importSource(sourceKind, inputValue);
  }
  const priorSource = useRef(archive.movies);
  useEffect(() => {
    if (archive.movies !== priorSource.current && archive.sourceKind !== null) {
      priorSource.current = archive.movies;
      const frame = requestAnimationFrame(() => {
        sourceDialog.current?.close();
        setEditing(false);
        pullButton.current?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
    priorSource.current = archive.movies;
  }, [archive.movies, archive.sourceKind]);
  function closeEditor() {
    archive.cancelImport();
    sourceDialog.current?.close();
    setEditing(false);
    sourceButton.current?.focus();
  }
  function trapSourceFocus(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const controls = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex="0"]',
      ),
    ).filter((element) => element.offsetParent !== null);
    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last?.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first?.focus();
    }
  }
  function resetShelf() {
    sourceDialog.current?.close();
    archive.reset();
    setEditing(false);
    requestAnimationFrame(() =>
      document.getElementById("source-input")?.focus({ preventScroll: true }),
    );
  }

  const sourceForm = (inDialog = false) => (
    <form onSubmit={importCollection} className="source-form">
      <div className="source-tabs" role="group" aria-label="Letterboxd source">
        <button
          type="button"
          aria-pressed={sourceKind === "watchlist"}
          onClick={() => changeKind("watchlist")}
        >
          Watchlist
        </button>
        <button
          type="button"
          aria-pressed={sourceKind === "list"}
          onClick={() => changeKind("list")}
        >
          List URL
        </button>
      </div>
      <label htmlFor={inDialog ? "edit-source" : "source-input"}>
        {sourceKind === "watchlist"
          ? "Your Letterboxd username"
          : "Public Letterboxd list URL"}
      </label>
      <div className="source-input-wrap">
        {sourceKind === "watchlist" && (
          <span className="input-prefix" aria-hidden="true">
            @
          </span>
        )}
        <input
          id={inDialog ? "edit-source" : "source-input"}
          value={inputValue}
          onChange={(event) => changeValue(event.target.value)}
          placeholder={
            sourceKind === "watchlist"
              ? "username"
              : "https://letterboxd.com/you/list/…"
          }
          autoComplete="off"
          autoCapitalize="none"
          spellCheck={false}
          type={sourceKind === "list" ? "url" : "text"}
          aria-describedby={inDialog ? "edit-feedback" : "source-feedback"}
          required
        />
        <button
          type="submit"
          className="import-button"
          aria-label={archive.loading ? "Importing films" : "Load shelf"}
          disabled={!inputValue.trim() || archive.loading}
        >
          {archive.loading ? (
            <span className="loader" />
          ) : (
            <Icon name="arrow" />
          )}
        </button>
      </div>
      <p
        id={inDialog ? "edit-feedback" : "source-feedback"}
        className={`source-help ${archive.error ? "is-error" : ""}`}
        role={archive.error ? "alert" : undefined}
      >
        {archive.error ||
          (archive.loading
            ? "Gathering your films. Large lists take a little longer…"
            : "Public lists only. No sign-in needed.")}
      </p>
    </form>
  );

  return (
    <main
      className={`archive-app ${paused || reducedMotion || hidden ? "motion-paused" : ""}`}
      data-mode={mode}
      style={
        {
          "--result-accent": archive.pull?.accent ?? "#d7ef9c",
        } as CSSProperties
      }
    >
      <a href="#main-action" className="skip-link">
        Skip to movie selection
      </a>
      <div className="archive-backdrop" aria-hidden="true">
        <div
          className={`fallback-wall ${webglReady && !webglFailed ? "is-hidden" : ""}`}
        >
          {Array.from({ length: 132 }, (_, i) => (
            <i
              key={i}
              style={
                {
                  "--tile-index": i,
                  "--tile-delay": `${(i * 0.71) % 12}s`,
                } as CSSProperties
              }
            />
          ))}
        </div>
        {!webglFailed && (
          <div className={`webgl-wall ${webglReady ? "is-ready" : ""}`}>
            <SceneBoundary onFail={onSceneError}>
              <ArchiveScene
                pull={archive.pull}
                heroBounds={heroBounds}
                reducedMotion={reducedMotion}
                paused={paused || hidden}
                onReveal={archive.reveal}
                onReady={onSceneReady}
                onError={onSceneError}
              />
            </SceneBoundary>
          </div>
        )}
        <div className="archive-vignette" />
        <div className="archive-atmosphere" />
      </div>
      <header className="archive-header enter-chrome">
        <Link className="brand" href="/" aria-label="Reel Roulette home">
          <span className="brand-symbol" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            reel<span className="brand-second">roulette</span>
          </span>
        </Link>
        <div className="header-right">
          <span className="edition-label">
            THE LIVING ARCHIVE <span>VOL. 001</span>
          </span>
          {!setup && (
            <button
              ref={sourceButton}
              className="collection-button"
              onClick={() => setEditing(true)}
              aria-label="Change movie source"
            >
              <span className="status-dot" />
              <span>
                {archive.movies.length}{" "}
                {archive.movies.length === 1 ? "film" : "films"}
              </span>
              <Icon name="shelf" />
            </button>
          )}
        </div>
      </header>
      {setup && (
        <section
          className="setup-panel enter-chrome"
          aria-labelledby="setup-title"
        >
          <div className="eyebrow">
            <span className="letterboxd-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>{" "}
            FROM YOUR LETTERBOXD
          </div>
          <h1 id="setup-title">
            Leave tonight
            <br />
            <em>to chance.</em>
          </h1>
          <p className="setup-description">
            A shelf full of possibilities. One film for you.
          </p>
          <div id="main-action" className="setup-controls" tabIndex={-1}>
            {sourceForm()}
            <div className="demo-divider">
              <span />
              or
              <span />
            </div>
            <button className="demo-button" onClick={archive.useDemo}>
              Explore the demo shelf <Icon name="arrow" />
            </button>
          </div>
        </section>
      )}
      {!setup && !winner && !archive.pulling && (
        <section className="ready-prompt" aria-labelledby="ready-title">
          <span className="eyebrow">
            {archive.sourceKind === "demo"
              ? "THE DEMO SHELF"
              : "YOUR SHELF IS READY"}
          </span>
          <h1 id="ready-title">
            {archive.movies.length ? (
              <>
                Let a film <em>find you.</em>
              </>
            ) : (
              <>
                A little more <em>possibility?</em>
              </>
            )}
          </h1>
          <p>
            {archive.movies.length
              ? archive.movies.length === 1
                ? "One film. A little destiny."
                : `${archive.movies.length} films. All equally possible.`
              : "This list is empty. Try another public watchlist or list."}
          </p>
          {!archive.movies.length && (
            <button className="quiet-button" onClick={() => setEditing(true)}>
              Choose another list <Icon name="arrow" />
            </button>
          )}
        </section>
      )}
      <section
        className="result-layout"
        aria-label="Selected movie"
        aria-busy={archive.pulling}
      >
        <div ref={anchor} className="hero-anchor">
          {(webglFailed || !webglReady) && archive.pull && (
            <FlatCassette key={archive.pull.serial} pull={archive.pull} />
          )}
        </div>
        <div className="result-copy-slot">
          {winner && (
            <article
              className={`result-copy${archive.pulling ? " is-dismissing" : ""}`}
              key={winner.id}
              aria-hidden={archive.pulling}
              inert={archive.pulling}
            >
              <div className="result-eyebrow">
                <span>
                  <i /> TONIGHT’S PICK
                </span>
                <span>№ {String(archive.drawCount).padStart(3, "0")}</span>
              </div>
              <h1 id="result-title">{winner.title}</h1>
              {(winner.year ||
                winner.runtimeMinutes ||
                winner.contentRating) && (
                <div className="movie-facts">
                  {winner.year && <span>{winner.year}</span>}
                  {winner.runtimeMinutes && (
                    <span>{winner.runtimeMinutes} min</span>
                  )}
                  {winner.contentRating && <span>{winner.contentRating}</span>}
                </div>
              )}
              {winner.genres.length > 0 && (
                <p className="movie-genres">{winner.genres.join(" / ")}</p>
              )}
              {winner.summary && (
                <p className="movie-summary">{winner.summary}</p>
              )}
              {(winner.rating != null || winner.audienceRating != null) && (
                <dl className="movie-ratings">
                  {winner.rating != null && (
                    <div>
                      <dt>Rating</dt>
                      <dd>{winner.rating}</dd>
                    </div>
                  )}
                  {winner.audienceRating != null && (
                    <div>
                      <dt>Audience</dt>
                      <dd>{winner.audienceRating}</dd>
                    </div>
                  )}
                </dl>
              )}
              <div className="result-rule" />
              <p className="result-source">
                {archive.sourceKind === "demo"
                  ? "From the demo shelf"
                  : `From ${archive.sourceLabel}`}
              </p>
              {winner.externalUrl && (
                <a
                  href={winner.externalUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="letterboxd-link"
                >
                  Open in Letterboxd <Icon name="external" />
                </a>
              )}
            </article>
          )}
        </div>
      </section>
      {!setup && (
        <div className="pull-dock" id="main-action" tabIndex={-1}>
          <div className="pull-status" aria-hidden="true">
            {archive.pulling ? (
              <>
                <span className="searching-dots">
                  <i />
                  <i />
                  <i />
                </span>{" "}
                A LITTLE CHANCE AT WORK
              </>
            ) : winner ? (
              "ONE GOOD POSSIBILITY"
            ) : (
              "SOMETHING GOOD IS IN HERE"
            )}
          </div>
          <button
            ref={pullButton}
            className="pull-button"
            onClick={archive.pullMovie}
            disabled={
              !archive.movies.length || archive.loading || archive.pulling
            }
          >
            <span className="pull-button-icon">
              <Icon name={archive.pulling ? "shelf" : "arrow"} />
            </span>
            <span>
              {archive.pulling
                ? "Finding your film"
                : winner
                  ? "Pull another"
                  : "Pull a movie"}
            </span>
            <span className="pull-button-end" aria-hidden="true">
              ↗
            </span>
          </button>
          <p className="pull-footnote">
            {archive.sourceKind === "demo" ? "Demo shelf" : archive.sourceLabel}
            <span>·</span>
            {archive.remaining} unseen
          </p>
        </div>
      )}
      <footer className="archive-footer enter-chrome">
        <span className="footer-caption">
          <span className="tiny-star">✳</span> A LITTLE LESS BROWSING. A LITTLE
          MORE CINEMA.
        </span>
        <div className="footer-tools">
          <Link href="/privacy">Privacy</Link>
          <button
            className="motion-button"
            aria-label={
              paused ? "Resume ambient animation" : "Pause ambient animation"
            }
            aria-pressed={paused}
            onClick={() => setPaused((value) => !value)}
            disabled={reducedMotion}
            title={
              reducedMotion
                ? "Reduced motion is enabled on your device"
                : paused
                  ? "Resume ambient animation"
                  : "Pause ambient animation"
            }
          >
            <Icon name={paused || reducedMotion ? "play" : "pause"} />
          </button>
        </div>
      </footer>
      <p
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {archive.pulling
          ? "Finding your next film."
          : winner
            ? `Your next film is ${winner.title}${winner.year ? `, ${winner.year}` : ""}.`
            : archive.notice}
      </p>
      <dialog
        className="source-dialog"
        ref={sourceDialog}
        aria-labelledby="source-dialog-title"
        onKeyDown={trapSourceFocus}
        onCancel={closeEditor}
        onClick={(event) => {
          if (event.target === event.currentTarget) closeEditor();
        }}
      >
        <div className="source-dialog-inner">
          <button
            className="dialog-close"
            onClick={closeEditor}
            aria-label="Close source settings"
          >
            <Icon name="close" />
          </button>
          <span className="eyebrow">MAKE ROOM FOR SOMETHING NEW</span>
          <h2 id="source-dialog-title">Change the shelf.</h2>
          <p className="dialog-intro">Load another watchlist or public list.</p>
          {sourceForm(true)}
          <button className="reset-button" onClick={resetShelf}>
            <Icon name="reset" /> Reset this session
          </button>
        </div>
      </dialog>
      <div className="opening-veil" aria-hidden="true" />
    </main>
  );
}
