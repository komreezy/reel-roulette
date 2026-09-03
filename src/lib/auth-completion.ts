export type CompletionState = "connected" | "waiting" | "expired";

export function completionDocument(state: CompletionState = "connected") {
  const action = state === "connected"
    ? '<script>if(window.opener){window.opener.postMessage({type:"plex-auth-complete"},window.location.origin)}window.close()</script>'
    : state === "waiting" ? '<meta http-equiv="refresh" content="1">' : "";
  const title = state === "connected" ? "Plex connected" : state === "waiting" ? "Finishing connection…" : "Connection expired";
  const detail = state === "connected" ? "You can close this window or return to Reel Roulette." : state === "waiting" ? "This window will close automatically." : "Return to Reel Roulette and connect Plex again.";
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title>${action}<style>html{color-scheme:dark}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#111210;color:#f4f0e6;font-family:ui-monospace,SFMono-Regular,Menlo,monospace}main{max-width:28rem;padding:2rem;text-align:center}h1{font:400 2rem Georgia,serif}p,a{color:#aaa79e}a{display:inline-block;margin-top:1rem;color:#d99b3d}</style></head><body><main><h1>${title}</h1><p>${detail}</p><a href="/">Return to Reel Roulette</a></main></body></html>`;
}
