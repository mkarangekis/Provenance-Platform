import type { Metadata } from "next";
import { DM_Serif_Display, Instrument_Sans, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const fontSans = Instrument_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const fontDisplay = DM_Serif_Display({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400"],
});

const fontMono = JetBrains_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

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
      <body className={`${fontSans.variable} ${fontDisplay.variable} ${fontMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
