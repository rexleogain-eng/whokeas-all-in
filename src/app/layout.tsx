import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "WHOKEAS ALL IN",
    template: "%s | WHOKEAS ALL IN",
  },
  description:
    "A refined international marketplace for technology, home, fashion, study and lifestyle essentials with market-aware pricing.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>{children}</body>
    </html>
  );
}
