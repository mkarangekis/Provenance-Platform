import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Registrata",
  description: "AI-amplified art intelligence for auction houses, galleries, and museums.",
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
