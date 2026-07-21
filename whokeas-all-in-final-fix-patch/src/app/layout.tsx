import type { Metadata } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "WHOKEAS ALL IN",
    template: "%s | WHOKEAS ALL IN",
  },
  description:
    "A modern Tanzanian marketplace for technology, lifestyle, study and original products.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
