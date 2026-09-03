import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel Roulette — one film for tonight",
  description: "A fair, poster-led way to choose a movie from your Plex library.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col" data-design-contract="projection-room / graphite / ivory / amber / poster-led / fair-full-pool-selection">{children}</body>
    </html>
  );
}
