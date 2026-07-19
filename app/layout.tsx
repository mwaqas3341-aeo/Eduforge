import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "eduforge — Result Card Generator",
  description: "Generate school result cards from Excel, in seconds.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
