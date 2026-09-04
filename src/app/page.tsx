"use client";
/* eslint-disable @next/next/no-html-link-for-pages */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { Movie, MovieFilters, PlexLibrary, PlexServer } from "@/lib/models";
import { chooseUniform, filterMovies, visualSample } from "@/lib/selection";

const demoPalettes = [
  "linear-gradient(145deg, #9f5f43 0 42%, #22343b 42% 70%, #d7b06a 70%)",
  "linear-gradient(160deg, #203b4a, #744b62 54%, #d9a45c)",
  "linear-gradient(135deg, #d49a71 0 36%, #688b84 36% 68%, #7b3230 68%)",
  "linear-gradient(155deg, #101b28, #49566b 58%, #b37c54)",
  "linear-gradient(140deg, #1c3542, #b46c62 62%, #e6c4a2)",
  "linear-gradient(150deg, #101719, #4b5c57 52%, #b18a5a)",
  "linear-gradient(135deg, #201b16, #bb8f3c 48%, #6e2520)",
  "linear-gradient(155deg, #315f66, #a46f7c 56%, #d4b86d)",
];
const demoMovies: Movie[] = ["Arrival", "Moonlight", "The Grand Budapest Hotel", "Blade Runner 2049", "Portrait of a Lady on Fire", "The Lighthouse", "Whiplash", "Spirited Away"].map((title, i) => ({ id: `demo-${i}`, title, year: 2016 - i, runtimeMinutes: 100 + i * 7, genres: [["Sci-Fi"],["Drama"],["Comedy"],["Sci-Fi"],["Romance"],["Horror"],["Drama"],["Animation"]][i], watched: i === 1 || i === 5, demoArtwork: demoPalettes[i], plexKey: `demo-${i}`, libraryKey: "demo" }));
const path = (name: string) => ({ sliders: "M4 6h16M8 12h12M13 18h7", close: "M6 6l12 12M18 6 6 18", play: "M8 5v14l11-7z", external: "M14 5h5v5M19 5l-9 9" }[name]);
function Icon({ name }: { name: "sliders" | "close" | "play" | "external" }) { return <svg aria-hidden="true" viewBox="0 0 24 24" className="icon"><path d={path(name)} /></svg>; }
class ApiError extends Error { constructor(message: string, public diagnostics?: { attempts?: { connection?: string; host?: string; outcome?: string; status?: number; error?: string; elapsedMs?: number }[] }) { super(message); } }
async function api<T>(url: string, init?: RequestInit): Promise<T> { const response = await fetch(url, { ...init, cache: "no-store" }); const body = await response.json(); if (!response.ok) throw new ApiError(body.error ?? "Request failed.", body.diagnostics); return body; }
function diagnosticText(error: unknown) { if (!(error instanceof ApiError) || !error.diagnostics?.attempts?.length) return ""; return ` Route check: ${error.diagnostics.attempts.map(attempt => `${attempt.connection ?? "route"}/${attempt.host ?? "Plex"}: ${attempt.outcome === "http" ? `HTTP ${attempt.status}` : attempt.error ?? "failed"} (${attempt.elapsedMs ?? 0} ms)`).join("; ")}.`; }

export default function Home() {
  const [movies, setMovies] = useState<Movie[]>([]); const [demo, setDemo] = useState(false); const [connected, setConnected] = useState(false); const [servers, setServers] = useState<PlexServer[]>([]); const [libraries, setLibraries] = useState<PlexLibrary[]>([]); const [serverId, setServerId] = useState(""); const [libraryId, setLibraryId] = useState("");
  const [filters, setFilters] = useState<MovieFilters>({ watched: "all", genres: [], maxRuntime: null }); const [excluded, setExcluded] = useState<Set<string>>(new Set()); const [winner, setWinner] = useState<Movie | null>(null); const [wheelMovies, setWheelMovies] = useState<Movie[]>([]); const [filtersOpen, setFiltersOpen] = useState(false); const [spinning, setSpinning] = useState(false); const [turn, setTurn] = useState(0); const [notice, setNotice] = useState("Connect Plex to use your library."); const [loading, setLoading] = useState(false); const lastFocus = useRef<HTMLElement | null>(null); const dialogTitle = useRef<HTMLHeadingElement>(null); const dialog = useRef<HTMLElement>(null);
  const source = demo ? demoMovies : movies; const eligible = useMemo(() => filterMovies(source, filters, excluded), [source, filters, excluded]); const genres = useMemo(() => [...new Set(source.flatMap(m => m.genres))].sort(), [source]); const sectors = spinning || winner ? wheelMovies : visualSample(eligible, 8); const activeServer = servers.find(s => s.id === serverId);
  useEffect(() => { api<{ authenticated: boolean }>("/api/plex/auth/status").then(r => { if (r.authenticated) { setConnected(true); loadServers(); } }).catch(() => undefined); }, []);
  useEffect(() => {
    if (!winner) return;
    dialogTitle.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); closeWinner(); return; }
      if (event.key !== "Tab") return;
      const focusable = [...(dialog.current?.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])') ?? [])];
      if (!focusable.length) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (active === dialogTitle.current || !dialog.current?.contains(active)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
      else if (event.shiftKey && active === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    window.addEventListener("keydown", onKey);
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = previousOverflow; };
  }, [winner]);
  async function loadServers() { try { const r = await api<{ servers: PlexServer[] }>("/api/plex/servers"); setServers(r.servers); setNotice(`${r.servers.length} secure server${r.servers.length === 1 ? "" : "s"} found.`); } catch (e) { setNotice((e as Error).message); } }
  async function connect() { setLoading(true); setNotice("Opening Plex authorization…"); try { const r = await api<{ url: string }>("/api/plex/auth/start", { method: "POST" }); window.open(r.url, "plex-auth", "popup,width=560,height=720"); for (let i = 0; i < 90; i++) { await new Promise(resolve => window.setTimeout(resolve, 1000)); const state = await api<{ authenticated: boolean; expired?: boolean }>("/api/plex/auth/status"); if (state.authenticated) { setConnected(true); setNotice("Plex connected. Choose a server."); await loadServers(); return; } if (state.expired) break; } setNotice("Plex authorization expired. Start again when you’re ready."); } catch (e) { setNotice((e as Error).message); } finally { setLoading(false); } }
  async function chooseServer(id: string) { setServerId(id); setLibraryId(""); setLibraries([]); setMovies([]); if (!id) return; setLoading(true); setNotice("Checking secure Plex routes…"); try { const r = await api<{ libraries: PlexLibrary[] }>(`/api/plex/libraries?server=${encodeURIComponent(id)}`); setLibraries(r.libraries); setNotice("Choose a movie library."); } catch (e) { setNotice(`${(e as Error).message}${diagnosticText(e)}`); } finally { setLoading(false); } }
  async function chooseLibrary(id: string) { setLibraryId(id); if (!id || !serverId) return; setLoading(true); try { const r = await api<{ movies: Movie[] }>(`/api/plex/movies?server=${encodeURIComponent(serverId)}&library=${encodeURIComponent(id)}`); setMovies(r.movies.map(m => ({ ...m, machineIdentifier: activeServer?.machineIdentifier }))); setNotice(`${r.movies.length} movies loaded.`); } catch (e) { setNotice((e as Error).message); } finally { setLoading(false); } }
  function spin(pool = eligible) {
    if (spinning) return;
    const next = chooseUniform(pool);
    if (!next) { setNotice("No movies match these filters. Clear a filter or exclusion."); return; }
    lastFocus.current = document.activeElement as HTMLElement;
    const sample = visualSample(pool, 8);
    if (!sample.some(movie => movie.id === next.id)) sample[sample.length - 1] = next;
    const winnerIndex = sample.findIndex(movie => movie.id === next.id);
    setWheelMovies(sample);
    setSpinning(true);
    setTurn(current => {
      const target = -((winnerIndex + 0.5) * 360) / sample.length;
      const currentAngle = ((current % 360) + 360) % 360;
      const targetAngle = ((target % 360) + 360) % 360;
      return current + 1080 + ((targetAngle - currentAngle + 360) % 360);
    });
    const reveal = () => { setWinner(next); setSpinning(false); };
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) reveal();
    else window.setTimeout(reveal, 1050);
  }
  function closeWinner() { setWinner(null); lastFocus.current?.focus(); }
  function excludeAndSpin() { if (!winner) return; const nextExcluded = new Set(excluded).add(winner.id); setExcluded(nextExcluded); closeWinner(); spin(filterMovies(source, filters, nextExcluded)); }
  async function disconnect() { await fetch("/api/plex/auth/disconnect", { method: "POST" }); setConnected(false); setServers([]); setLibraries([]); setMovies([]); setServerId(""); setLibraryId(""); setNotice("Disconnected. Nothing was saved."); }
  const artwork = (m: Movie) => m.demoArtwork || (connected && serverId && m.thumb ? `url(/api/plex/image?server=${encodeURIComponent(serverId)}&path=${encodeURIComponent(m.thumb)})` : undefined);
  const wheelBackground = sectors.length ? `conic-gradient(${sectors.map((movie, index) => `${movie.demoArtwork ? movie.demoArtwork.match(/#[0-9a-f]{6}/i)?.[0] : index % 2 ? "#20211f" : "#181917"} ${(index * 360) / sectors.length}deg ${((index + 1) * 360) / sectors.length}deg`).join(", ")})` : "var(--surface)";
  const wheelStyle = { transform: `rotate(${turn}deg)`, background: wheelBackground, "--counter-turn": `${-turn}deg` } as CSSProperties;
  return <main className="shell"><header className="topbar"><a className="wordmark" href="/" aria-label="Reel Roulette home"><span className="reel-mark">R</span> Reel Roulette</a><div className="top-actions"><span className="status"><span className="status-dot" /> {connected ? "Plex connected" : demo ? "Demo mode" : "Not connected"}</span>{connected ? <button className="text-button" onClick={disconnect}>Disconnect</button> : <button className="text-button" onClick={connect} disabled={loading}>Connect Plex</button>}</div></header>
    <section className="intro"><div><h1>Make the<br /><em>decision.</em></h1><p className="intro-copy">A fair turn through your movie library.<br />No browsing. No recommendations. Just tonight’s film.</p></div><div className="connection-note"><span className="line-label">{demo ? "DEMO SHELF" : connected ? "CONNECTED" : "READY WHEN YOU ARE"}</span><p>{connected ? "Your Plex credentials stay on the server. Select a secure remote library below." : "Connect Plex for a real library, or use the demo shelf for a visual test."}</p>{connected && <div className="library-controls"><select aria-label="Plex server" value={serverId} onChange={e => chooseServer(e.target.value)}><option value="">Server</option>{servers.map(s => <option value={s.id} key={s.id}>{s.name}</option>)}</select><select aria-label="Movie library" value={libraryId} onChange={e => chooseLibrary(e.target.value)} disabled={!serverId}><option value="">Movie library</option>{libraries.map(l => <option value={l.key} key={l.key}>{l.title}</option>)}</select></div>}{connected && <p className="connection-feedback">{notice}</p>}</div></section>
    <section className="stage" aria-label="Movie roulette"><div className="stage-meta"><span><strong>{eligible.length}</strong> eligible films{loading ? " · loading" : ""}</span><button className={`filter-trigger ${filtersOpen ? "active" : ""}`} onClick={() => setFiltersOpen(v => !v)} aria-expanded={filtersOpen}><Icon name="sliders" /> Filters {filters.genres.length || filters.watched !== "all" || filters.maxRuntime ? <sup>•</sup> : null}</button></div>
      {filtersOpen && <div className="filters"><label>Watched<select value={filters.watched} onChange={e => setFilters({ ...filters, watched: e.target.value as MovieFilters["watched"] })}><option value="all">All films</option><option value="unwatched">Unwatched only</option><option value="watched">Watched only</option></select></label><label>Maximum runtime<select value={filters.maxRuntime ?? ""} onChange={e => setFilters({ ...filters, maxRuntime: e.target.value ? Number(e.target.value) : null })}><option value="">Any length</option><option value="90">90 minutes</option><option value="120">120 minutes</option><option value="150">150 minutes</option></select></label><fieldset><legend>Genres</legend><div className="genre-list">{genres.map(g => <label key={g}><input type="checkbox" checked={filters.genres.includes(g)} onChange={() => setFilters({ ...filters, genres: filters.genres.includes(g) ? filters.genres.filter(x => x !== g) : [...filters.genres, g] })} /> {g}</label>)}</div></fieldset><button className="clear-button" onClick={() => setFilters({ watched: "all", genres: [], maxRuntime: null })}>Clear filters</button></div>}
      <div className="wheel-wrap"><div className="pointer" aria-hidden="true" /><div className="wheel" style={wheelStyle}><svg viewBox="0 0 100 100" aria-hidden="true" focusable="false"><circle cx="50" cy="50" r="49" fill="none" stroke="var(--amber)" strokeWidth=".4" />{sectors.map((_, i) => <line key={i} x1="50" y1="50" x2={50 + 49 * Math.sin((i / Math.max(sectors.length, 1)) * Math.PI * 2)} y2={50 - 49 * Math.cos((i / Math.max(sectors.length, 1)) * Math.PI * 2)} stroke="#eee9dc55" strokeWidth=".35" />)}</svg>{sectors.map((movie, index) => <button className="wheel-label" key={movie.id} disabled={spinning} style={{ left: `${50 + 32 * Math.sin(((index + 0.5) / sectors.length) * Math.PI * 2)}%`, top: `${50 - 32 * Math.cos(((index + 0.5) / sectors.length) * Math.PI * 2)}%`, "--counter-turn": `${-turn}deg` } as CSSProperties} onClick={() => { lastFocus.current = document.activeElement as HTMLElement; setWheelMovies(sectors); setWinner(movie); }}><span>{movie.title}</span></button>)}<div className="wheel-center"><button className="spin-button" onClick={() => spin()} disabled={!eligible.length || loading || spinning} aria-label={spinning ? "Choosing a film" : "Spin"}><Icon name="play" /><span>{spinning ? "Choosing" : "Spin"}</span></button></div></div></div><p className="fairness">Winner selection is uniform across all {eligible.length} eligible films. The wheel shows a readable sample without changing the odds.</p>
      {!connected && !demo && <button className="demo-action" onClick={() => { setDemo(true); setNotice("Demo content · Nothing is saved"); }}>Use demo shelf <span>for public visual testing</span></button>}{!source.length && <p className="empty-state">Connect Plex or choose the demo shelf to begin.</p>}
    </section>
    <footer className="footer"><span role="status" aria-live="polite">{notice}</span><span className="footer-links"><a href="/privacy">Privacy: no database, short-lived encrypted cookies.</a><span>·</span><a href={process.env.NEXT_PUBLIC_REPOSITORY_URL || "https://github.com/komreezy/reel-roulette"} target="_blank" rel="noreferrer">Open source</a></span></footer>
    {winner && <div className="dialog-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) closeWinner(); }}><section ref={dialog} className={`detail-sheet ${artwork(winner) ? "" : "no-artwork"}`} role="dialog" aria-modal="true" aria-labelledby="result-title" aria-describedby="result-description"><button className="close-button" onClick={closeWinner} aria-label="Close movie details"><Icon name="close" /></button>{artwork(winner) && <div className="detail-poster" style={{ backgroundImage: artwork(winner) }} />}<div className="detail-copy"><span className="line-label">YOUR NEXT FILM {demo ? "· DEMO" : "· PLEX"}</span><h2 id="result-title" tabIndex={-1} ref={dialogTitle}>{winner.title}</h2><p className="meta">{winner.year ?? "Year unknown"} <span>·</span> {winner.runtimeMinutes ? `${winner.runtimeMinutes} min` : "Runtime unknown"} <span>·</span> {winner.genres.join(" · ") || "Uncategorized"}</p><p className="summary" id="result-description">{winner.summary || "No summary was supplied by Plex. A film waiting for your full attention."}</p><div className="detail-actions">{connected && winner.machineIdentifier && <a className="primary-action" href={`https://app.plex.tv/desktop/#!/server/${encodeURIComponent(winner.machineIdentifier)}/details?key=${encodeURIComponent(`/library/metadata/${winner.plexKey}`)}`} target="_blank" rel="noreferrer">Open in Plex <Icon name="external" /></a>}<button className="secondary-action" onClick={() => { closeWinner(); spin(); }}>Spin again</button><button className="secondary-action" onClick={excludeAndSpin}>Exclude &amp; spin again</button></div></div></section></div>}
  </main>;
}
