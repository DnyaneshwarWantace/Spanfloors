import "server-only";
import { SITE_NAME, SITE_URL } from "@/lib/seo";
import { getSettings } from "./settings";
import { getConfig } from "./site-config";

export type Studio = { name: string; address: string; phone?: string; hours?: string; mapUrl?: string; lat?: number | null; lng?: number | null; city?: string; country?: string };

/** Experience studios from Site settings. */
export async function getStudios(): Promise<Studio[]> {
  return getConfig("config.studios");
}

/** Organization, website and one local business per studio, for Google and AI search. */
export async function siteStructuredData() {
  const s = await getSettings(["site.name", "seo.defaultDescription"]).catch(() => null);
  const [studios, contact] = await Promise.all([getStudios().catch(() => []), getConfig("config.contact")]);
  const name = s?.["site.name"] || SITE_NAME;
  const org = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name,
    url: `${SITE_URL}/`,
    description: s?.["seo.defaultDescription"] || "Engineered wood flooring, laminate, decking and facades.",
    logo: { "@type": "ImageObject", "@id": `${SITE_URL}/#logo`, url: `${SITE_URL}/brand/span-floors-logo.png` },
    image: { "@id": `${SITE_URL}/#logo` },
    ...(contact.phone ? { telephone: contact.phone.replace(/\s+/g, "") } : {}),
    ...(contact.email ? { email: contact.email } : {}),
    sameAs: contact.social.map((x) => x.url),
  };
  const website = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: `${SITE_URL}/`,
    name,
    inLanguage: "en-IN",
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  const places = studios.map((st, i) => ({
    "@context": "https://schema.org",
    "@type": "HomeAndConstructionBusiness",
    "@id": `${SITE_URL}/#studio-${i + 1}`,
    name: `${name} ${st.name}`,
    parentOrganization: { "@id": `${SITE_URL}/#organization` },
    url: `${SITE_URL}/`,
    image: `${SITE_URL}/brand/span-floors-logo.png`,
    address: { "@type": "PostalAddress", streetAddress: st.address, ...(st.city ? { addressLocality: st.city } : {}), addressCountry: st.country || "IN" },
    ...(st.phone ? { telephone: st.phone.replace(/\s+/g, "") } : {}),
    ...(st.hours ? { openingHours: st.hours } : {}),
    ...(typeof st.lat === "number" && typeof st.lng === "number" ? { geo: { "@type": "GeoCoordinates", latitude: st.lat, longitude: st.lng } } : {}),
    ...(st.mapUrl ? { hasMap: st.mapUrl } : {}),
  }));
  return [org, website, ...places];
}
