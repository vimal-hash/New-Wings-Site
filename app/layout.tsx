import type { Metadata, Viewport } from "next";
import { Geist_Mono, Jost, Righteous } from "next/font/google";
import "./globals.css";

// Reading text, buttons and the menu: Jost, a calm geometric sans.
const jost = Jost({
  variable: "--font-read",
  subsets: ["latin"],
});

// The big lines in the sections: Righteous, the lettering of the New Wings Solutions logo (one weight, 400).
// Not preloaded: the first big line comes long after the opening. "block": never a stand-in font in its place.
const righteous = Righteous({
  variable: "--font-brand",
  weight: "400",
  subsets: ["latin"],
  display: "block",
  preload: false,
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "New Wings Solutions — cinema equipment, from the first light to the last seat.";

export const metadata: Metadata = {
  // Use the client's domain when configured. On Vercel, Next can resolve the deployment URL itself.
  metadataBase: process.env.NEXT_PUBLIC_SITE_URL ? new URL(process.env.NEXT_PUBLIC_SITE_URL) : undefined,
  title: "New Wings Solutions",
  description,
  openGraph: { title: "New Wings Solutions", description, type: "website", siteName: "New Wings Solutions" },
  twitter: { card: "summary_large_image", title: "New Wings Solutions", description },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#11151a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${jost.variable} ${righteous.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
