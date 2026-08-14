import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Dendukuri's Residences | Family Flats",
  description:
    "Modern 1BHK and 2BHK family residences with parking and CCTV surveillance.",
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
