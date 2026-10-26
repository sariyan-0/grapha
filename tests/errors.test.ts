import test from "node:test";
import assert from "node:assert/strict";
import { compileExpression } from "../lib/math";
import { errorMessage, UserError } from "../lib/app-errors";
import {
  parseProjectJson,
  writeCurrentProject,
  shareSnapshot,
  canvasPng,
} from "../lib/project-io";
import {
  initial,
  readProjects,
  saveProject,
  removeSavedProject,
} from "../lib/store";
import { restoreSession } from "../lib/restore-session";

function memoryStorage(values: Record<string, string> = {}) {
  const entries = new Map(Object.entries(values));
  return {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => {
      entries.set(key, value);
    },
  };
}
test("incomplete mathematical input gets useful prompts without parser internals", () => {
  for (const [source, message] of [
    ["1/(x-)", "subtraction"],
    ["x+", "addition"],
    ["x^", "exponent"],
    ["1/()", "denominator"],
    ["sin(", "input"],
    ["(x+2", "parentheses"],
    ["|x", "absolute-value"],
  ]) {
    const result = compileExpression(source);
    assert.equal(result.issue?.kind, "incomplete", source);
    assert.match(result.error!, new RegExp(message));
    assert.ok(result.issue?.hint);
    assert.equal(result.fn, undefined);
    assert.doesNotMatch(result.error!, /char \d|SyntaxError|Value expected/);
  }
});
test("invalid functions, unsupported operators and unbound parameters are explained", () => {
  assert.equal(compileExpression("sin(x,2)").issue?.kind, "invalid");
  assert.equal(compileExpression("constructor(x)").issue?.kind, "unsupported");
  assert.equal(compileExpression("unknown(x)").issue?.kind, "unsupported");
  assert.equal(compileExpression("x<2").issue?.kind, "unsupported");
  assert.equal(compileExpression("x)").issue?.kind, "invalid");
  assert.equal(compileExpression("a*x").issue?.parameter, "a");
  assert.equal(compileExpression("a*x", { a: 2 }).fn!(3), 6);
  assert.equal(compileExpression("1/0").issue?.kind, "invalid");
  assert.equal(compileExpression("sqrt(-1)").issue?.kind, "invalid");
  assert.ok(compileExpression("sqrt(x)").fn);
});
test("bad JSON and damaged records report friendly errors without changing work", () => {
  for (const source of [
    "{broken",
    JSON.stringify({ ...initial, expressions: [null] }),
    JSON.stringify({ ...initial, viewport: null }),
    JSON.stringify({ ...initial, version: 2 }),
    JSON.stringify({
      ...initial,
      items: [{ id: "1", type: "note", text: "" }],
    }),
  ]) {
    assert.throws(
      () => parseProjectJson(source),
      (error) =>
        error instanceof UserError &&
        !/Cannot read|Unexpected token|SyntaxError/.test(error.message),
    );
  }
  assert.deepEqual(parseProjectJson(JSON.stringify(initial)), initial);
});
test("a damaged share link falls back to the saved graph", () => {
  const saved = { ...initial, title: "Keep this graph" };
  const session = restoreSession(
    "#graph=not-base64!",
    memoryStorage({ "grapha-current-v1": JSON.stringify(saved) }),
  );
  assert.deepEqual(session.project, saved);
  assert.equal(session.canAutosave, true);
  assert.ok(session.error);
});
test("unreadable sessions pause autosave and retry preserves the original", () => {
  const broken = "{unreadable";
  const storage = memoryStorage({ "grapha-current-v1": broken });
  assert.equal(restoreSession("", storage).canAutosave, false);
  assert.equal(storage.getItem("grapha-current-v1"), broken);
  writeCurrentProject(initial, storage);
  assert.equal(storage.getItem("grapha-recovery-v1"), broken);
  assert.deepEqual(JSON.parse(storage.getItem("grapha-current-v1")!), initial);
});
test("a failed recovery backup never overwrites the original saved session", () => {
  const broken = "{unreadable";
  let wroteCurrent = false;
  assert.throws(() =>
    writeCurrentProject(initial, {
      getItem: (key) => (key === "grapha-current-v1" ? broken : null),
      setItem: (key) => {
        if (key === "grapha-current-v1") wroteCurrent = true;
        throw new DOMException("Full", "QuotaExceededError");
      },
    }),
  );
  assert.equal(wroteCurrent, false);
});
test("error messages hide technical details and explain storage failures", () => {
  assert.equal(
    errorMessage(new Error("internal stack detail"), "Try again."),
    "Try again.",
  );
  assert.match(
    errorMessage(new DOMException("quota", "QuotaExceededError"), "fallback"),
    /storage is full/,
  );
  assert.equal(
    errorMessage(new UserError("Choose another file."), "fallback"),
    "Choose another file.",
  );
});
test("oversized share snapshots fail with an export alternative", () => {
  assert.throws(
    () =>
      shareSnapshot({
        ...initial,
        items: [{ id: "note", type: "note", text: "x".repeat(25000) }],
      }),
    /Export JSON/,
  );
});
test("PNG exports report a missing canvas or encoder failure", async () => {
  await assert.rejects(canvasPng(null), /isn’t ready/);
  await assert.rejects(
    canvasPng({
      toBlob: (callback: BlobCallback) => callback(null),
    } as HTMLCanvasElement),
    /couldn’t be created/,
  );
  const blob = new Blob(["png"]);
  assert.equal(
    await canvasPng({
      toBlob: (callback: BlobCallback) => callback(blob),
    } as HTMLCanvasElement),
    blob,
  );
});
test("saving and deleting graphs preserve unrelated unreadable records", () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const bad = { not: "a graph" };
  const storage = memoryStorage({
    "grapha-projects-v1": JSON.stringify([initial, bad]),
  });
  Object.defineProperty(globalThis, "localStorage", {
    value: storage,
    configurable: true,
  });
  try {
    assert.equal(readProjects().length, 1);
    saveProject({ ...initial, title: "New graph" });
    assert.ok(
      JSON.parse(storage.getItem("grapha-projects-v1")!).some(
        (item: unknown) => JSON.stringify(item) === JSON.stringify(bad),
      ),
    );
    removeSavedProject("New graph");
    assert.ok(
      JSON.parse(storage.getItem("grapha-projects-v1")!).some(
        (item: unknown) => JSON.stringify(item) === JSON.stringify(bad),
      ),
    );
    storage.setItem("grapha-projects-v1", "{broken");
    assert.throws(() => saveProject(initial), UserError);
    assert.equal(storage.getItem("grapha-projects-v1"), "{broken");
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});

test("expression feedback renders a correction instead of a parser exception", async () => {
  const { createElement } = await import("react");
  const { renderToStaticMarkup } = await import("react-dom/server");
  const { default: ExpressionFeedback } =
    await import("../components/expression-feedback");
  const html = renderToStaticMarkup(
    createElement(ExpressionFeedback, {
      id: "feedback",
      source: "1/(x-)",
      issue: compileExpression("1/(x-)").issue,
      editing: false,
      onAddParameter: () => {},
    }),
  );
  assert.match(html, /Finish the subtraction/);
  assert.match(html, /aria-live="polite"/);
  assert.doesNotMatch(html, /Value expected|char 8/);
});
