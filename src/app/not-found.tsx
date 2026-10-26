import Link from "next/link";
import { getTexts } from "@/server/site-config";

export default async function NotFound() {
  const texts = await getTexts();
  return (
    <section className="grid min-h-[60vh] place-items-center px-gap text-center">
      <div className="max-w-xl">
        <h1 className="mono mb-4 text-display">{texts["notFound.title"]}</h1>
        <p className="mb-6 text-ink-2">{texts["notFound.text"]}</p>
        <Link className="arrow-link" href="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
