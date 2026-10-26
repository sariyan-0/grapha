import { initial, validateProject, type Project } from "./store";

type StorageReader = Pick<Storage, "getItem">;
export function restoreSession(hash: string, storage: StorageReader) {
  let project: Project = initial;
  let light = false;
  let reduceMotion = false;
  let error = "";
  const shared = new URLSearchParams(hash.replace(/^#/, "")).get("graph");

  let canAutosave = true;
  let sharedOpened = false;
  if (shared) {
    try {
      if (shared.length > 30000) throw new Error("Link too long");
      const bytes = Uint8Array.from(atob(shared), (char) => char.charCodeAt(0));
      project = validateProject(JSON.parse(new TextDecoder().decode(bytes)));
      sharedOpened = true;
    } catch {
      error =
        "This share link is incomplete or invalid. Your saved workspace will be opened instead.";
    }
  }
  if (!sharedOpened) {
    try {
      const saved = storage.getItem("grapha-current-v1");
      if (saved) project = validateProject(JSON.parse(saved));
    } catch {
      canAutosave = false;
      error =
        "Your previous graph couldn’t be read. Local saving is paused so it won’t be overwritten. You can export this workspace or retry saving.";
    }
  }

  // A broken appearance preference shouldn't prevent a graph from opening.
  try {
    const preferences = JSON.parse(
      storage.getItem("grapha-preferences-v1") || "{}",
    );
    light = preferences?.light === true;
    reduceMotion = preferences?.reduceMotion === true;
  } catch {}

  return { project, light, reduceMotion, error, canAutosave };
}
