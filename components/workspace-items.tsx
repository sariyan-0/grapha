"use client";
import { Plus, StickyNote, Table2, X } from "lucide-react";
import { useGraph } from "@/lib/store";
import type { WorkspaceItem } from "@/lib/workspace-items";

export default function WorkspaceItems({
  selected,
  onSelect,
}: {
  selected: string;
  onSelect: (id: string) => void;
}) {
  const { project, update } = useGraph();
  const items = project.items ?? [];
  function replace(item: WorkspaceItem) {
    update({
      items: items.map((existing) =>
        existing.id === item.id ? item : existing,
      ),
    });
  }
  return items.map((item) => (
    <div
      className={`workspace-item ${selected === item.id ? "selected" : ""}`}
      key={item.id}
      onFocusCapture={() => onSelect(item.id)}
      onClick={() => onSelect(item.id)}
    >
      <div className="workspace-item-heading">
        {item.type === "note" ? (
          <StickyNote size={15} />
        ) : (
          <button
            className="table-visibility"
            style={{ color: item.color }}
            aria-label={
              item.visible ? "Hide table points" : "Show table points"
            }
            aria-pressed={item.visible}
            onClick={() => replace({ ...item, visible: !item.visible })}
          >
            <Table2 size={17} />
          </button>
        )}
        <span>{item.type === "note" ? "Note" : "Point table"}</span>
        <button
          className="icon-button"
          aria-label={`Delete ${item.type}`}
          onClick={() =>
            update({
              items: items.filter((existing) => existing.id !== item.id),
            })
          }
        >
          <X size={15} />
        </button>
      </div>
      {item.type === "note" ? (
        <textarea
          aria-label="Note"
          placeholder="Write a note…"
          maxLength={10000}
          value={item.text}
          autoFocus={selected === item.id}
          onChange={(e) => replace({ ...item, text: e.target.value })}
        />
      ) : (
        <>
          <table className="point-table">
            <thead>
              <tr>
                <th scope="col">x</th>
                <th scope="col">y</th>
                <th scope="col">
                  <span className="sr-only">Remove row</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {item.rows.map((row, index) => (
                <tr key={row.id}>
                  {(["x", "y"] as const).map((axis) => (
                    <td key={axis}>
                      <input
                        aria-label={`${axis} coordinate, row ${index + 1}`}
                        inputMode="decimal"
                        placeholder="—"
                        maxLength={80}
                        value={row[axis]}
                        autoFocus={
                          selected === item.id && index === 0 && axis === "x"
                        }
                        aria-invalid={
                          Boolean(row[axis].trim()) &&
                          !Number.isFinite(Number(row[axis]))
                        }
                        onChange={(e) =>
                          replace({
                            ...item,
                            rows: item.rows.map((existing) =>
                              existing.id === row.id
                                ? { ...existing, [axis]: e.target.value }
                                : existing,
                            ),
                          })
                        }
                      />
                    </td>
                  ))}
                  <td>
                    <button
                      aria-label={`Remove point row ${index + 1}`}
                      onClick={() =>
                        replace({
                          ...item,
                          rows: item.rows.filter(
                            (existing) => existing.id !== row.id,
                          ),
                        })
                      }
                    >
                      <X size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {item.rows.some((row) =>
            [row.x, row.y].some(
              (value) => value.trim() && !Number.isFinite(Number(value)),
            ),
          ) && <p className="table-error">Use numbers for x and y.</p>}
          <div className="table-footer">
            <button
              disabled={item.rows.length >= 100}
              onClick={() =>
                replace({
                  ...item,
                  rows: [
                    ...item.rows,
                    { id: crypto.randomUUID(), x: "", y: "" },
                  ],
                })
              }
            >
              <Plus size={13} />
              Add row
            </button>
            <input
              type="color"
              aria-label="Table point color"
              value={item.color}
              onChange={(e) => replace({ ...item, color: e.target.value })}
            />
          </div>
        </>
      )}
    </div>
  ));
}
