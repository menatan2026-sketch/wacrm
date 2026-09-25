import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { Cursor } from "@/components/chrome/Cursor";
import { Footer } from "@/components/chrome/Footer";
import { Navigation } from "@/components/chrome/Navigation";
import { SmoothScroll } from "@/components/chrome/SmoothScroll";
import { site } from "@/config/site";
import "./globals.css";

const sans = localFont({
  src: "./fonts/Archivo-Variable.woff2",
  variable: "--font-sans",
  weight: "100 900",
  display: "swap",
  declarations: [{ prop: "font-stretch", value: "62% 125%" }],
});

const mono = localFont({
  src: "./fonts/JetBrainsMono-Variable.woff2",
  variable: "--font-mono",
  weight: "100 800",
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(site.url),
  title: {
    default: `${site.name} — Your car. From anywhere.`,
    template: `%s — ${site.name}`,
  },
  description: site.description,
  openGraph: {
    type: "website",
    siteName: site.name,
    locale: site.locale,
    title: `${site.name} — Your car. From anywhere.`,
    description: site.description,
  },
  twitter: { card: "summary_large_image" },
};

export const viewport: Viewport = {
  themeColor: "#030304",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable}`}>
      <body>
        <a href="#main" className="sr-only">
          Skip to content
        </a>
        <SmoothScroll>
          <Navigation />
          <main id="main">{children}</main>
          <Footer />
        </SmoothScroll>
        <Cursor />
      </body>
    </html>
  );
}
