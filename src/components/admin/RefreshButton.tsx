"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshFromTwenty } from "@/app/admin/actions";

export default function RefreshButton() {
  const [pending, start] = useTransition();
  const router = useRouter();
  return (
    <button
      onClick={() =>
        start(async () => {
          await refreshFromTwenty();
          router.refresh();
        })
      }
      disabled={pending}
      className="inline-flex h-9 items-center gap-2 border border-ink bg-ink px-4 text-2xs text-paper transition-colors hover:bg-transparent hover:text-ink disabled:opacity-60"
    >
      <svg viewBox="0 0 16 16" className={`size-3.5 ${pending ? "animate-spin" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
        <path d="M13.5 8A5.5 5.5 0 1 1 11.9 4.1M13.5 2.5v3h-3" />
      </svg>
      {pending ? "Refreshing…" : "Refresh from Twenty"}
    </button>
  );
}
