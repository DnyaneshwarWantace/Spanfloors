"use client";

import { useState } from "react";
import { btn } from "./ui";

/** Two-step destructive button: first click asks, second click submits the server action. */
export default function ConfirmButton({ action, id, label, confirmLabel }: { action: (f: FormData) => Promise<void>; id: string; label: string; confirmLabel: string }) {
  const [asking, setAsking] = useState(false);
  return asking ? (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      <span className="text-2xs text-brand">{confirmLabel}</span>
      <button className={btn.danger}>Yes, {label.toLowerCase()}</button>
      <button type="button" className={btn.ghost} onClick={() => setAsking(false)}>
        Cancel
      </button>
    </form>
  ) : (
    <button type="button" className={btn.ghost} onClick={() => setAsking(true)}>
      {label}…
    </button>
  );
}
