import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Hermes Chat — Free AI, Auto-Switching",
  description: "Hermes Agent: every free AI model with daily auto-fallback, teams, MCP, unlimited uploads, app builder.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
