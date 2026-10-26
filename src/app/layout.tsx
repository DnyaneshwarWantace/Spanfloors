import type { Metadata, Viewport } from "next";
import { Inter, IBM_Plex_Mono } from "next/font/google";
import { JsonLd, SITE_NAME, SITE_URL } from "@/lib/seo";
import { siteStructuredData } from "@/server/site-ld";
import { getConfig, identityUrls } from "@/server/site-config";
import "./globals.css";

// Temporary free stand-ins until the client's designer supplies licensed brand fonts.
const body = Inter({ subsets: ["latin"], variable: "--font-body", display: "swap" });
const head = IBM_Plex_Mono({ subsets: ["latin"], weight: ["300", "400"], variable: "--font-head", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const [urls, tracking] = await Promise.all([identityUrls(), getConfig("config.tracking")]);
  const icon = urls.favicon ?? "/brand/favicon.jpg";
  return {
    metadataBase: new URL(SITE_URL),
    title: { default: SITE_NAME, template: `%s - ${SITE_NAME}` },
    icons: { icon, apple: icon },
    verification: {
      ...(tracking.googleVerification ? { google: tracking.googleVerification } : {}),
      ...(tracking.bingVerification ? { other: { "msvalidate.01": tracking.bingVerification } } : {}),
    },
  };
}

export const viewport: Viewport = { themeColor: "#191919" };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-US" className={`${body.variable} ${head.variable}`}>
      <body>
        {(await siteStructuredData()).map((d, i) => (
          <JsonLd key={i} data={d} />
        ))}
        {children}
      </body>
    </html>
  );
}
