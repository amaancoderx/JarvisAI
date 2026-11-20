import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Jarvis · Just say it",
  description:
    "A voice-first AI agent for India. Say what you need in English, Hindi or Telugu. Jarvis gets it done across email, calendar, WhatsApp and the web, and asks before it acts. Built on Gemini and Google Cloud.",
  icons: { icon: "/logo.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#ff5b2e" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Noto+Sans+Devanagari:wght@400;600&family=Noto+Sans+Telugu:wght@400;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
