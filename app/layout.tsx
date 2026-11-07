import type { Metadata } from "next";
import "./globals.css";
import "./glass-theme.css";

export const metadata: Metadata = {
  title: "Recall — Incident intelligence",
  description: "Resolve with context. Learn from every incident. Powered by Hindsight memory.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
