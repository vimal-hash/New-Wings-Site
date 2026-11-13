import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const description = "New Wings Solutions — cinema equipment, from the first light to the last seat.";

export const metadata: Metadata = {
  // Set NEXT_PUBLIC_SITE_URL to the live domain so share previews use absolute links.
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: "New Wings Solutions",
  description,
  openGraph: { title: "New Wings Solutions", description, type: "website", siteName: "New Wings Solutions" },
  twitter: { card: "summary_large_image", title: "New Wings Solutions", description },
};

export const viewport: Viewport = {
  width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#11151a",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
