import type { Metadata } from "next";
import { notFound, permanentRedirect, redirect } from "next/navigation";
import ContentView from "@/views/ContentView";
import { findRedirect, firstSectionPhoto, getContentByPath } from "@/server/content";
import { buildMetadata } from "@/server/metadata";
import { logNotFound } from "@/server/seo-audit";

export const revalidate = 60;

type Props = { params: Promise<{ slug: string[] }> };

const toPath = (slug: string[]) => `/${slug.map((s) => decodeURIComponent(s)).join("/")}/`;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const path = toPath((await params).slug);
  const c = await getContentByPath(path);
  if (!c) return {};
  const isPost = c.type === "post";
  return buildMetadata({
    path,
    title: c.title,
    description: c.excerpt,
    seoTitle: c.seoTitle,
    seoDescription: c.seoDescription,
    robots: c.robots,
    canonical: c.canonicalUrl,
    ogTitle: c.ogTitle,
    ogDescription: c.ogDescription,
    ogImage: c.ogImage,
    photo: c.featured?.url ?? (await firstSectionPhoto(c.layout)),
    kicker: isPost ? "Span Floors blog" : "Span Floors",
    type: isPost ? "article" : "website",
    publishedTime: c.publishedAt,
    modifiedTime: c.updatedAt,
    author: c.authorName,
  });
}

export default async function CmsPage({ params }: Props) {
  const path = toPath((await params).slug);
  const c = await getContentByPath(path);

  if (!c) {
    const r = await findRedirect(path);
    if (r) (r.permanent ? permanentRedirect : redirect)(r.toPath);
    // (The referring page isn't read here: request headers would stop this route from being cached.)
    logNotFound(path, null);
    notFound();
  }

  return <ContentView c={c} path={path} />;
}
