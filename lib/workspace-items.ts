export type Note = { id: string; type: "note"; text: string };
export type PointTable = {
  id: string;
  type: "table";
  color: string;
  visible: boolean;
  rows: { id: string; x: string; y: string }[];
};
export type WorkspaceItem = Note | PointTable;

export function validWorkspaceItem(value: unknown): value is WorkspaceItem {
  if (!value || typeof value !== "object") return false;
  const item = value as WorkspaceItem;
  if (typeof item.id !== "string" || !item.id || item.id.length > 120)
    return false;
  if (item.type === "note")
    return typeof item.text === "string" && item.text.length <= 10000;
  if (item.type !== "table") return false;
  return (
    /^#[0-9a-f]{6}$/i.test(item.color) &&
    typeof item.visible === "boolean" &&
    Array.isArray(item.rows) &&
    item.rows.length <= 100 &&
    item.rows.every(
      (row) =>
        row &&
        typeof row.id === "string" &&
        row.id.length > 0 &&
        row.id.length <= 120 &&
        typeof row.x === "string" &&
        row.x.length <= 80 &&
        typeof row.y === "string" &&
        row.y.length <= 80,
    ) &&
    new Set(item.rows.map((row) => row.id)).size === item.rows.length
  );
}
export function tablePoints(items: WorkspaceItem[] = []) {
  return items.flatMap((item) =>
    item.type === "table" && item.visible
      ? item.rows.flatMap((row) => {
          if (!row.x.trim() || !row.y.trim()) return [];
          const x = Number(row.x),
            y = Number(row.y);
          return Number.isFinite(x) && Number.isFinite(y)
            ? [{ id: item.id, x, y, color: item.color }]
            : [];
        })
      : [],
  );
}
