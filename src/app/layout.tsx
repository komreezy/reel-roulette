import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Reel Roulette — The Living Archive",
  description:
    "Leave tonight to chance. Pull a film from your Letterboxd watchlist, one unexpected discovery at a time.",
};

export const viewport: Viewport = {
  themeColor: "#0c0b16",
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
