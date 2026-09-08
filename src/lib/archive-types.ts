import type { Movie } from "./models";

export const ARCHIVE_ACCENTS = [
  "#b9a1f2",
  "#f1a698",
  "#d7ef9c",
  "#9edee2",
] as const;

export type ArchivePull = {
  serial: number;
  movie: Movie;
  accent: string;
  slotSeed: number;
};

export type HeroBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};
