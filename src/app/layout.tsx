import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import organization from "@/data/organization.json";
import { JsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import "./globals.css";

// Temporary free stand-ins until the client's designer supplies licensed brand fonts.
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const head = IBM_Plex_Mono({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-head", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: SITE_NAME, template: `%s - ${SITE_NAME}` },
  icons: { icon: "/brand/favicon.jpg", apple: "/brand/favicon.jpg" },
};

export const viewport: Viewport = { themeColor: "#191919" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={`${body.variable} ${head.variable}`}>
      <body>
        <JsonLd data={{ "@context": "https://schema.org", ...organization }} />
        <JsonLd
          data={{
            "@context": "https://schema.org",
            "@type": "WebSite",
            "@id": `${SITE_URL}/#website`,
            url: `${SITE_URL}/`,
            name: SITE_NAME,
            publisher: { "@id": `${SITE_URL}/#organization` },
          }}
        />
        {children}
      </body>
    </html>
  );
}
