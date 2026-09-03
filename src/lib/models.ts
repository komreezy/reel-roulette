export type WatchedFilter = "all" | "unwatched" | "watched";
export type Movie = { id: string; title: string; year?: number; summary?: string; runtimeMinutes?: number; contentRating?: string; genres: string[]; watched: boolean; rating?: number; audienceRating?: number; thumb?: string; art?: string; demoArtwork?: string; plexKey: string; libraryKey: string; libraryTitle?: string; machineIdentifier?: string };
export type MovieFilters = { watched: WatchedFilter; genres: string[]; maxRuntime: number | null };
export type PlexServer = { id: string; name: string; product: string; machineIdentifier: string; connections: { uri: string; local: boolean; relay: boolean }[] };
export type PlexLibrary = { key: string; title: string; type: "movie" };
