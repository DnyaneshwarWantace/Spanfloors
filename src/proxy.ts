import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "sf_session";
const MAIN_ORIGIN = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.spanfloors.com").replace(/\/$/, "");

/** Old blog category slugs → the tag name the posts carry on the new site. */
const BLOG_CATEGORIES: Record<string, string> = {
  "span-floors-wood": "Span Floors Wood",
  "engineered-wooden-flooring": "Engineered Wooden Flooring",
  "decking-and-renovation": "Decking and Renovation",
  "span-floors": "Span Floors",
  "wooden-flooring": "Wooden Flooring",
  news: "News",
  "span-floors-wooden-pergolas": "Span Floors Wooden Pergolas",
  "facades-soffits": "Facades & Soffits",
  "wooden-facades": "Wooden Facades",
  "wooden-cladding-soffits": "Wooden Cladding & Soffits",
  "laminate-flooring": "Laminate Flooring",
};

export function proxy(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  const host = (req.headers.get("host") ?? "").toLowerCase();

  // Old blog subdomain → same post on the main site (301 keeps search rankings).
  // blog.spanfloors.com/<slug>/ → www.spanfloors.com/blog/<slug>/ ; category/tag/author/page archives → /blog/
  if (host.startsWith("blog.")) {
    const cat = pathname.match(/^\/category\/([^/]+)/)?.[1];
    if (cat && BLOG_CATEGORIES[cat]) return NextResponse.redirect(`${MAIN_ORIGIN}/blog/?tag=${encodeURIComponent(BLOG_CATEGORIES[cat])}`, 301);
    const archive = /^\/(category|tag|author|page|feed|wp-content|wp-json|wp-admin)\b/.test(pathname);
    const target = archive || pathname === "/" ? "/blog/" : `/blog${pathname.endsWith("/") ? pathname : `${pathname}/`}`;
    return NextResponse.redirect(`${MAIN_ORIGIN}${target}`, 301);
  }

  // Admin: no session cookie → sign-in page. The session itself is verified in the admin layout.
  if (pathname.startsWith("/admin") && !pathname.startsWith("/admin/login")) {
    if (!req.cookies.get(SESSION_COOKIE)) {
      const url = req.nextUrl.clone();
      url.pathname = "/admin/login/";
      url.search = pathname === "/admin/" || pathname === "/admin" ? "" : `?next=${encodeURIComponent(pathname + search)}`;
      return NextResponse.redirect(url);
    }
  }
  return NextResponse.next();
}

// Everything except static assets.
export const config = { matcher: ["/((?!_next/static|_next/image|favicon|brand/).*)"] };
