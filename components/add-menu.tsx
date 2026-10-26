"use client";
import { useEffect, useRef, useState } from "react";
import {
  Activity,
  Plus,
  SlidersHorizontal,
  StickyNote,
  Table2,
} from "lucide-react";
export type AddItemType = "expression" | "slider" | "note" | "table";
export default function AddMenu({
  onAdd,
  canAddExpression,
  canAddSlider,
  canAddItem,
}: {
  onAdd: (type: AddItemType) => void;
  canAddExpression: boolean;
  canAddSlider: boolean;
  canAddItem: boolean;
}) {
  const [open, setOpen] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    host.current
      ?.querySelector<HTMLButtonElement>('[role="menuitem"]:not(:disabled)')
      ?.focus();
    const dismiss = (e: PointerEvent) => {
      if (e.target instanceof Node && !host.current?.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, [open]);
  const entries = [
    {
      type: "expression" as const,
      label: "Expression",
      icon: Activity,
      enabled: canAddExpression,
    },
    {
      type: "note" as const,
      label: "Note",
      icon: StickyNote,
      enabled: canAddItem,
    },
    {
      type: "table" as const,
      label: "Point table",
      icon: Table2,
      enabled: canAddItem,
    },
    {
      type: "slider" as const,
      label: "Slider",
      icon: SlidersHorizontal,
      enabled: canAddSlider,
    },
  ];
  return (
    <div
      className="add-menu"
      ref={host}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          setOpen(false);
          trigger.current?.focus();
        }
        if (e.key === "Tab") setOpen(false);
        if (open && ["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const buttons = Array.from(
            host.current?.querySelectorAll<HTMLButtonElement>(
              '[role="menuitem"]:not(:disabled)',
            ) ?? [],
          );
          const index = buttons.indexOf(
            document.activeElement as HTMLButtonElement,
          );
          const next =
            e.key === "Home"
              ? 0
              : e.key === "End"
                ? buttons.length - 1
                : (index + (e.key === "ArrowUp" ? -1 : 1) + buttons.length) %
                  buttons.length;
          buttons[next]?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        className="icon-button"
        title="Add item"
        aria-label="Add item"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <Plus size={22} />
      </button>
      {open && (
        <div className="add-menu-content" role="menu" aria-label="Add to graph">
          {entries.map(({ type, label, icon: Icon, enabled }) => (
            <button
              key={type}
              role="menuitem"
              disabled={!enabled}
              onClick={() => {
                setOpen(false);
                onAdd(type);
              }}
            >
              <Icon size={19} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
