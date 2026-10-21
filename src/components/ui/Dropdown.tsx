"use client";

import { useEffect, useId, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";

export type DropdownOption = { value: string; label: string; hint?: string };

type Props = {
  options: DropdownOption[];
  /** Controlled value. Omit to let the component keep its own state (use defaultValue). */
  value?: string;
  defaultValue?: string;
  onChange?: (value: string) => void;
  /** Form field name: a hidden input carries the value when the form submits. */
  name?: string;
  /** Submit the surrounding form as soon as a value is picked (filter bars). */
  submitOnChange?: boolean;
  placeholder?: string;
  id?: string;
  "aria-label"?: string;
  disabled?: boolean;
  size?: "sm" | "md";
  className?: string;
  /** "dark" for use on the ink-coloured sidebar or footer. */
  tone?: "light" | "dark";
};

/**
 * The site's dropdown (used everywhere instead of the browser default select element).
 * Keyboard: ↓/↑/Enter/Space open and move, Home/End, type letters to jump, Esc closes.
 */
export default function Dropdown({
  options,
  value,
  defaultValue,
  onChange,
  name,
  submitOnChange,
  placeholder = "Select…",
  id,
  disabled,
  size = "md",
  className = "",
  tone = "light",
  ...rest
}: Props) {
  const [inner, setInner] = useState(defaultValue ?? options[0]?.value ?? "");
  const current = value ?? inner;
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [up, setUp] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const hiddenRef = useRef<HTMLInputElement>(null);
  const typed = useRef({ text: "", at: 0 });
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;

  const selectedIndex = Math.max(
    0,
    options.findIndex((o) => o.value === current),
  );
  const selected = options.find((o) => o.value === current);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open]);

  // Open upwards when there isn't room below; keep the active option in view.
  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const r = buttonRef.current.getBoundingClientRect();
    setUp(window.innerHeight - r.bottom < 280 && r.top > window.innerHeight - r.bottom);
  }, [open]);
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>(`[data-index="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const choose = (i: number) => {
    const opt = options[i];
    if (!opt) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (opt.value === current) return;
    if (value === undefined) setInner(opt.value);
    onChange?.(opt.value);
    if (submitOnChange) {
      // Let the hidden input pick up the new value before submitting.
      requestAnimationFrame(() => {
        if (hiddenRef.current) hiddenRef.current.value = opt.value;
        hiddenRef.current?.form?.requestSubmit();
      });
    }
  };

  const openAt = (i: number) => {
    setActive(i);
    setOpen(true);
  };

  const onKey = (e: KeyboardEvent) => {
    if (disabled) return;
    const last = options.length - 1;
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (open) setActive((a) => Math.min(last, a + 1));
        else openAt(selectedIndex);
        return;
      case "ArrowUp":
        e.preventDefault();
        if (open) setActive((a) => Math.max(0, a - 1));
        else openAt(selectedIndex);
        return;
      case "Home":
        if (open) {
          e.preventDefault();
          setActive(0);
        }
        return;
      case "End":
        if (open) {
          e.preventDefault();
          setActive(last);
        }
        return;
      case "Enter":
      case " ":
        e.preventDefault();
        if (open) choose(active);
        else openAt(selectedIndex);
        return;
      case "Escape":
        if (open) {
          e.preventDefault();
          setOpen(false);
        }
        return;
      case "Tab":
        setOpen(false);
        return;
    }
    // Type-ahead: jump to the first option starting with the typed letters.
    if (e.key.length === 1 && /\S/.test(e.key)) {
      const now = Date.now();
      typed.current.text = now - typed.current.at > 600 ? e.key.toLowerCase() : typed.current.text + e.key.toLowerCase();
      typed.current.at = now;
      const i = options.findIndex((o) => o.label.toLowerCase().startsWith(typed.current.text));
      if (i >= 0) {
        if (open) setActive(i);
        else choose(i);
      }
    }
  };

  const dark = tone === "dark";
  const h = size === "sm" ? "h-8 text-2xs" : "h-10 text-body";

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      {name && <input ref={hiddenRef} type="hidden" name={name} value={current} />}
      <button
        ref={buttonRef}
        type="button"
        id={id}
        disabled={disabled}
        aria-label={rest["aria-label"]}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? setOpen(false) : openAt(selectedIndex))}
        onKeyDown={onKey}
        className={`flex w-full min-w-0 items-center justify-between gap-2 border px-3 text-left transition-colors outline-none disabled:cursor-not-allowed disabled:opacity-50 ${h} ${
          dark
            ? "border-line-light bg-white/5 text-paper hover:bg-white/10 focus-visible:border-paper"
            : `border-line bg-white/60 hover:bg-white focus-visible:border-ink ${open ? "border-ink bg-white" : ""}`
        }`}
      >
        <span className={`min-w-0 truncate ${selected ? "" : "text-muted"}`}>{selected?.label ?? placeholder}</span>
        <svg viewBox="0 0 12 12" aria-hidden="true" className={`size-3 shrink-0 transition-transform duration-200 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.4">
          <path d="m3 4.5 3 3 3-3" />
        </svg>
      </button>

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          aria-activedescendant={`${listId}-${active}`}
          tabIndex={-1}
          className={`absolute left-0 z-50 max-h-72 w-full min-w-max overflow-auto border py-1 shadow-[0_12px_32px_-12px_rgb(25_25_25/0.35)] ${
            up ? "bottom-full mb-1" : "top-full mt-1"
          } ${dark ? "border-line-light bg-ink-2 text-paper" : "border-line bg-paper text-ink"}`}
        >
          {options.map((o, i) => {
            const isSel = o.value === current;
            return (
              <li
                key={o.value + i}
                id={`${listId}-${i}`}
                data-index={i}
                role="option"
                aria-selected={isSel}
                onPointerEnter={() => setActive(i)}
                onPointerDown={(e) => e.preventDefault()}
                onClick={() => choose(i)}
                className={`flex cursor-pointer items-start gap-2 px-3 py-2 text-left ${size === "sm" ? "text-2xs" : "text-body"} ${
                  i === active ? (dark ? "bg-white/10" : "bg-paper-2") : ""
                }`}
              >
                <svg viewBox="0 0 12 12" aria-hidden="true" className={`mt-[0.2em] size-3 shrink-0 ${isSel ? "opacity-100" : "opacity-0"}`} fill="none" stroke="currentColor" strokeWidth="1.6">
                  <path d="m2.5 6.2 2.3 2.3 4.7-5" />
                </svg>
                <span className="min-w-0">
                  <span className="block whitespace-nowrap">{o.label}</span>
                  {o.hint && <span className={`block text-2xs ${dark ? "text-paper/55" : "text-muted"}`}>{o.hint}</span>}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
