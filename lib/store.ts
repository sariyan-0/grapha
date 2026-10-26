import { create } from "zustand";
import { UserError } from "./app-errors";
import { isParameterName } from "./variable-names";
import { validWorkspaceItem, type WorkspaceItem } from "./workspace-items";
import type { Viewport } from "./math";
export type Expression = {
  id: string;
  text: string;
  latex?: string;
  color: string;
  visible: boolean;
};
export type Project = {
  version: 1;
  title: string;
  expressions: Expression[];
  viewport: Viewport;
  parameters?: Record<string, number>;
  items?: WorkspaceItem[];
};
export const colors = [
  "#a78bfa",
  "#36cfdd",
  "#f5b969",
  "#ee7298",
  "#6ed5a0",
  "#7ca6ff",
];
export const initial: Project = {
  version: 1,
  title: "A little wave theory",
  expressions: [
    {
      id: "1",
      text: "sin(x)",
      latex: "y=\\sin(x)",
      color: colors[0],
      visible: true,
    },
    {
      id: "2",
      text: "x^2/4-2",
      latex: "y=\\frac{x^2}{4}-2",
      color: colors[1],
      visible: true,
    },
    {
      id: "3",
      text: "2cos(x)",
      latex: "y=2\\cos(x)",
      color: colors[2],
      visible: true,
    },
  ],
  viewport: { x: 0, y: 0, scale: 70 },
};
function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
function validId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 120;
}
export function validateProject(value: unknown): Project {
  if (!record(value))
    throw new UserError(
      "This isn’t a Grapha project. Choose a Grapha JSON export.",
    );
  if (value.version !== 1)
    throw new UserError(
      "This project version isn’t supported. Open a version 1 Grapha export.",
    );
  if (typeof value.title !== "string" || value.title.length > 120)
    throw new UserError("The graph title must be 120 characters or fewer.");
  if (!Array.isArray(value.expressions) || value.expressions.length > 50)
    throw new UserError("A project can contain up to 50 expressions.");
  if (
    !value.expressions.every(
      (e) =>
        record(e) &&
        validId(e.id) &&
        typeof e.text === "string" &&
        e.text.length <= 10000 &&
        typeof e.color === "string" &&
        /^#[0-9a-f]{6}$/i.test(e.color) &&
        typeof e.visible === "boolean" &&
        (e.latex === undefined ||
          (typeof e.latex === "string" && e.latex.length <= 20000)),
    )
  )
    throw new UserError(
      "An expression in this project is damaged or incomplete. Choose another export.",
    );
  if (
    value.parameters !== undefined &&
    (!record(value.parameters) ||
      Object.keys(value.parameters).length > 16 ||
      Object.entries(value.parameters).some(
        ([key, n]) =>
          !isParameterName(key) ||
          typeof n !== "number" ||
          !Number.isFinite(n) ||
          Math.abs(n) > 10,
      ))
  )
    throw new UserError(
      "Use up to 16 named sliders with values between −10 and 10.",
    );
  if (
    value.items !== undefined &&
    (!Array.isArray(value.items) ||
      value.items.length > 50 ||
      !value.items.every(validWorkspaceItem))
  )
    throw new UserError(
      "A note or point table in this project is damaged. Choose another export.",
    );
  const ids = [
    ...value.expressions.map((e) => e.id),
    ...((value.items as WorkspaceItem[]) ?? []).map((item) => item.id),
  ];
  if (new Set(ids).size !== ids.length)
    throw new UserError(
      "This project contains duplicate items. Choose another export.",
    );
  const v = value.viewport;
  if (
    !record(v) ||
    ![v.x, v.y, v.scale].every(
      (n) => typeof n === "number" && Number.isFinite(n),
    ) ||
    Math.abs(v.x as number) > 1e9 ||
    Math.abs(v.y as number) > 1e9 ||
    (v.scale as number) < 2 ||
    (v.scale as number) > 2000
  )
    throw new UserError(
      "The graph view contains invalid coordinates or zoom values. Choose another export.",
    );
  return value as unknown as Project;
}
type Store = {
  project: Project;
  past: Project[];
  future: Project[];
  update: (patch: Partial<Project>, history?: boolean) => void;
  expression: (id: string, patch: Partial<Expression>) => void;
  add: (text?: string) => string | undefined;
  undo: () => void;
  redo: () => void;
  load: (p: Project) => void;
  restore: (p: Project) => void;
};
export const useGraph = create<Store>((set, get) => ({
  project: initial,
  past: [],
  future: [],
  update: (patch, history = true) =>
    set((s) => ({
      project: { ...s.project, ...patch },
      past: history ? [...s.past.slice(-79), s.project] : s.past,
      future: history ? [] : s.future,
    })),
  expression: (id, patch) =>
    get().update({
      expressions: get().project.expressions.map((e) =>
        e.id === id ? { ...e, ...patch } : e,
      ),
    }),
  add: (text = "") => {
    const p = get().project;
    if (p.expressions.length >= 50) return;
    const id = crypto.randomUUID();
    get().update({
      expressions: [
        ...p.expressions,
        {
          id,
          text,
          color: colors[p.expressions.length % colors.length],
          visible: true,
        },
      ],
    });
    return id;
  },
  undo: () =>
    set((s) =>
      s.past.length
        ? {
            project: s.past.at(-1)!,
            past: s.past.slice(0, -1),
            future: [s.project, ...s.future],
          }
        : {},
    ),
  redo: () =>
    set((s) =>
      s.future.length
        ? {
            project: s.future[0],
            past: [...s.past, s.project],
            future: s.future.slice(1),
          }
        : {},
    ),
  load: (p) => get().update(validateProject(p)),
  restore: (p) => set({ project: validateProject(p), past: [], future: [] }),
}));
function savedCollection(): unknown[] {
  let values: unknown;
  try {
    values = JSON.parse(localStorage.getItem("grapha-projects-v1") || "[]");
  } catch (error) {
    if (error instanceof SyntaxError)
      throw new UserError(
        "Your saved-graph collection couldn’t be read. It has not been changed.",
      );
    throw error;
  }
  if (!Array.isArray(values))
    throw new UserError(
      "Your saved-graph collection couldn’t be read. It has not been changed.",
    );
  return values;
}
function readableProjects(values: unknown[]): Project[] {
  return values.flatMap((value) => {
    try {
      return [validateProject(value)];
    } catch {
      return [];
    }
  });
}
export function readProjects(): Project[] {
  const values = savedCollection();
  const projects = readableProjects(values);
  if (values.length && !projects.length)
    throw new UserError(
      "The saved graphs in this collection couldn’t be read. The original data has not been changed.",
    );
  return projects;
}
export function saveProject(p: Project) {
  const values = savedCollection();
  // Preserve unreadable records instead of silently dropping the whole collection.
  const remaining = values.filter((value) => {
    try {
      return validateProject(value).title !== p.title;
    } catch {
      return true;
    }
  });
  if (
    remaining.length >= 20 &&
    remaining.some((value) => {
      try {
        validateProject(value);
        return false;
      } catch {
        return true;
      }
    })
  )
    throw new UserError(
      "Your collection contains unreadable graphs. Export JSON to keep this graph without replacing them.",
    );
  localStorage.setItem(
    "grapha-projects-v1",
    JSON.stringify([validateProject(p), ...remaining].slice(0, 20)),
  );
}
export function removeSavedProject(title: string) {
  const values = savedCollection();
  const remaining = values.filter((value) => {
    try {
      return validateProject(value).title !== title;
    } catch {
      return true;
    }
  });
  localStorage.setItem("grapha-projects-v1", JSON.stringify(remaining));
  return readableProjects(remaining);
}
