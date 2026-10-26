"use client";

import Link from "next/link";
import Script from "next/script";
import { useEffect, useState } from "react";

/**
 * Analytics and ad codes from Admin → Site settings, with cookie consent:
 *  - Google Analytics / Tag Manager start in Google's consent mode with cookies denied, and switch on when
 *    the visitor accepts (or straight away when consent isn't required).
 *  - The Meta Pixel only loads after the visitor accepts.
 * The choice is remembered for a year in the sf_consent cookie.
 */

type Props = {
  ga4: string;
  gtm: string;
  metaPixel: string;
  requireConsent: boolean;
  banner: { enabled: boolean; text: string; accept: string; decline: string; policy: { label: string; href: string } };
};

type Choice = "granted" | "denied" | null;

const readChoice = (): Choice => {
  const m = document.cookie.match(/(?:^|; )sf_consent=(granted|denied)/);
  return (m?.[1] as Choice) ?? null;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

export default function Tracking({ ga4, gtm, metaPixel, requireConsent, banner }: Props) {
  const [choice, setChoice] = useState<Choice>(requireConsent ? null : "granted");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (requireConsent) setChoice(readChoice());
    setReady(true);
  }, [requireConsent]);

  const decide = (c: "granted" | "denied") => {
    document.cookie = `sf_consent=${c}; path=/; max-age=${365 * 86400}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
    setChoice(c);
    window.gtag?.("consent", "update", { ad_storage: c, analytics_storage: c, ad_user_data: c, ad_personalization: c });
  };

  if (!ga4 && !gtm && !metaPixel) return null;
  const consentDefault = requireConsent ? "denied" : "granted";

  return (
    <>
      {(ga4 || gtm) && (
        <Script id="consent-default" strategy="afterInteractive">
          {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}window.gtag=gtag;
gtag('consent','default',{ad_storage:'${consentDefault}',analytics_storage:'${consentDefault}',ad_user_data:'${consentDefault}',ad_personalization:'${consentDefault}',wait_for_update:500});
if(document.cookie.indexOf('sf_consent=granted')>-1){gtag('consent','update',{ad_storage:'granted',analytics_storage:'granted',ad_user_data:'granted',ad_personalization:'granted'});}
gtag('js',new Date());${ga4 ? `gtag('config','${ga4}');` : ""}`}
        </Script>
      )}
      {ga4 && <Script id="ga4" src={`https://www.googletagmanager.com/gtag/js?id=${ga4}`} strategy="afterInteractive" />}
      {gtm && (
        <Script id="gtm" strategy="afterInteractive">
          {`(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${gtm}');`}
        </Script>
      )}
      {metaPixel && choice === "granted" && (
        <Script id="meta-pixel" strategy="afterInteractive">
          {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${metaPixel}');fbq('track','PageView');`}
        </Script>
      )}
      {ready && requireConsent && banner.enabled && choice === null && (
        <div role="dialog" aria-live="polite" aria-label="Cookies" className="fixed inset-x-2 bottom-2 z-[60] mx-auto flex max-w-3xl flex-wrap items-center gap-x-6 gap-y-3 border border-line bg-paper p-4 text-2xs text-ink shadow-lg sm:inset-x-4 sm:bottom-4">
          <p className="min-w-0 flex-1 basis-72 leading-relaxed">
            {banner.text}{" "}
            {banner.policy.href && banner.policy.label && (
              <Link href={banner.policy.href} className="underline">
                {banner.policy.label}
              </Link>
            )}
          </p>
          <div className="flex gap-2">
            <button type="button" onClick={() => decide("denied")} className="h-9 border border-ink/40 px-4 hover:border-ink">
              {banner.decline}
            </button>
            <button type="button" onClick={() => decide("granted")} className="h-9 border border-ink bg-ink px-4 text-paper hover:bg-ink-2">
              {banner.accept}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
