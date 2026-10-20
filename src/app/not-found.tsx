import Link from "next/link";

export default function NotFound() {
  return (
    <section className="grid min-h-[60vh] place-items-center px-gap text-center">
      <div>
        <h1 className="mono mb-4 text-display">Page not found</h1>
        <Link className="arrow-link" href="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
