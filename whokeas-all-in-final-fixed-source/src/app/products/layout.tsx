import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Shop Products Online",
  description:
    "Browse technology, fashion, home, study and lifestyle products available from WHOKEAS ALL IN.",
};

export default function ProductsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return children;
}