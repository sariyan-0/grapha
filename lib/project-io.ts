import { validateProject, type Project } from "./store";
import { UserError } from "./app-errors";
export const MAX_PROJECT_BYTES = 5 * 1024 * 1024;
export function parseProjectJson(text: string): Project {
  if (text.length > MAX_PROJECT_BYTES)
    throw new UserError(
      "This project is too large. Choose a JSON file smaller than 5 MB.",
    );
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    throw new UserError(
      "This file isn’t valid JSON. Choose a Grapha JSON export.",
    );
  }
  return validateProject(value);
}
export function shareSnapshot(project: Project) {
  const bytes = new TextEncoder().encode(JSON.stringify(project));
  if (bytes.length > 22000)
    throw new UserError(
      "This graph is too large for a share link. Export JSON to share it instead.",
    );
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""));
}
export function writeCurrentProject(
  project: Project,
  storage: Pick<Storage, "getItem" | "setItem">,
) {
  const key = "grapha-current-v1";
  const previous = storage.getItem(key);
  if (previous) {
    try {
      parseProjectJson(previous);
    } catch {
      // Keep the original before replacing an unreadable saved session.
      const backup =
        storage.getItem("grapha-recovery-v1") === null
          ? "grapha-recovery-v1"
          : `grapha-recovery-${crypto.randomUUID()}`;
      storage.setItem(backup, previous);
    }
  }
  storage.setItem(key, JSON.stringify(validateProject(project)));
}
export function canvasPng(canvas: HTMLCanvasElement | null): Promise<Blob> {
  return new Promise((resolve, reject) => {
    if (!canvas) {
      reject(
        new UserError(
          "The graph isn’t ready to export. Wait a moment and try again.",
        ),
      );
      return;
    }
    try {
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(
                new UserError(
                  "The image couldn’t be created. Try again, or export JSON.",
                ),
              ),
        "image/png",
      );
    } catch {
      reject(
        new UserError(
          "The image couldn’t be exported. Try again, or export JSON.",
        ),
      );
    }
  });
}
