import type { NextConfig } from "next";

/**
 * LEGACY_SITE_URL: while pages such as projects, blog posts and galleries are still being rebuilt,
 * set this to where the old WordPress site stays reachable (e.g. https://old.spanfloors.com).
 * Any URL this app does not handle is then served from there, so no indexed page returns 404.
 */
const legacy = process.env.LEGACY_SITE_URL?.replace(/\/$/, "");

const nextConfig: NextConfig = {
  output: "standalone", // small self-contained server for Docker
  trailingSlash: true, // spanfloors.com URLs all end with "/"
  poweredByHeader: false,
  // Uploads, backups and the WordPress export are mounted or kept outside the build; never trace them in.
  outputFileTracingExcludes: { "*": ["storage/**", "backups/**", "wordpress/**", "deploy/seed/**"] },
  experimental: { serverActions: { bodySizeLimit: "26mb" } }, // media uploads up to 25 MB
  async headers() {
    // Only previews may be shown inside a frame, and only by this site (the admin's device preview).
    const csp = (frameAncestors: string) => ({
      key: "Content-Security-Policy",
      value: [
          "default-src 'self'",
          "base-uri 'self'",
          "object-src 'none'",
          `frame-ancestors ${frameAncestors}`,
          "form-action 'self'",
          "img-src 'self' data: blob: https:",
          "media-src 'self' https:",
          "font-src 'self' data:",
          "style-src 'self' 'unsafe-inline'",
          // Next.js hydration uses inline scripts; analytics hosts are added when configured.
          "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://www.google-analytics.com https://connect.facebook.net",
          "connect-src 'self' https://www.google-analytics.com https://*.google-analytics.com https://*.analytics.google.com https://www.googletagmanager.com https://www.facebook.com https://connect.facebook.net",
          "frame-src 'self' https://www.googletagmanager.com https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.google.com",
        ].join("; "),
    });
    const common = [
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=()" },
      { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
      { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    ];
    return [
      { source: "/((?!preview/).*)", headers: [...common, csp("'none'"), { key: "X-Frame-Options", value: "DENY" }] },
      { source: "/preview/:path*", headers: [...common, csp("'self'"), { key: "X-Frame-Options", value: "SAMEORIGIN" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }, { key: "Cache-Control", value: "no-store" }] },
      // The admin is never cached by browsers or proxies.
      { source: "/admin/:path*", headers: [{ key: "Cache-Control", value: "no-store" }, { key: "X-Robots-Tag", value: "noindex, nofollow" }] },
    ];
  },
  async rewrites() {
    return legacy ? { beforeFiles: [], afterFiles: [], fallback: [{ source: "/:path*", destination: `${legacy}/:path*` }] } : [];
  },
};

export default nextConfig;
