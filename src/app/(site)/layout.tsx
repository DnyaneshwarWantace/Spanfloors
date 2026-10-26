import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AnnouncementBar from "@/components/AnnouncementBar";
import Tracking from "@/components/Tracking";
import { getConfig, getTexts, identityUrls } from "@/server/site-config";

/** Dates from the admin without a time zone are India time. */
const parseUntil = (v: string) => (v ? new Date(/[zZ]|[+-]\d\d:\d\d$/.test(v) ? v : `${v}+05:30`) : null);

export default async function SiteLayout({ children }: { children: React.ReactNode }) {
  const [header, footer, contact, bar, tracking, cookies, urls, texts] = await Promise.all([
    getConfig("config.header"),
    getConfig("config.footer"),
    getConfig("config.contact"),
    getConfig("config.announcement"),
    getConfig("config.tracking"),
    getConfig("config.cookies"),
    identityUrls(),
    getTexts(),
  ]);
  const until = parseUntil(bar.until);
  const showBar = bar.enabled && bar.text && !(until && until.getTime() < Date.now());
  return (
    <>
      {showBar && <AnnouncementBar text={bar.text} link={bar.link} tone={bar.tone} id={String(bar.text.length) + bar.text.slice(0, 12)} />}
      <Header left={header.left} right={header.right} button={header.button} logo={urls.logo} />
      <main>{children}</main>
      <Footer footer={footer} contact={contact} logo={urls.logoLight} texts={texts} />
      <Tracking ga4={tracking.ga4} gtm={tracking.gtm} metaPixel={tracking.metaPixel} requireConsent={tracking.requireConsent} banner={cookies} />
    </>
  );
}
