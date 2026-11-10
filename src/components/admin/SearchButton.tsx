"use client";

/** Sidebar button that opens the Ctrl/Cmd-K search. */
export default function SearchButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("admin:search"))}
      className="flex h-9 w-full items-center justify-between rounded-sm border border-line-light px-3 text-2xs text-paper/70 transition-colors hover:bg-white/10 hover:text-paper"
    >
      <span>Search…</span>
      <kbd className="font-sans text-paper/50">Ctrl K</kbd>
    </button>
  );
}
