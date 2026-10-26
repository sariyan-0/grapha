import test from "node:test";
import assert from "node:assert/strict";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import Workspace from "../components/workspace";
import { initial, useGraph } from "../lib/store";
import { restoreSession } from "../lib/restore-session";

const saved = {
  ...initial,
  title: "Saved work",
  expressions: [{ ...initial.expressions[0], id: "saved-expression" }],
  viewport: { x: 3, y: -2, scale: 91 },
};
const storage = (values: Record<string, string>) => ({
  getItem: (key: string) => values[key] ?? null,
});

test("startup markup doesn't expose demo rows before browser restoration", () => {
  const html = renderToStaticMarkup(createElement(Workspace));
  assert.match(html, /Opening graph/);
  assert.doesNotMatch(html, /expression-row|math-editor|graph-canvas/);
});

test("a saved graph replaces the demo without merging extra expressions", () => {
  const session = restoreSession(
    "",
    storage({ "grapha-current-v1": JSON.stringify(saved) }),
  );
  assert.deepEqual(session.project, saved);
  assert.equal(session.project.expressions.length, 1);
  assert.equal(session.error, "");
});

test("an intentionally empty saved workspace stays empty", () => {
  const session = restoreSession(
    "",
    storage({
      "grapha-current-v1": JSON.stringify({ ...saved, expressions: [] }),
    }),
  );
  assert.deepEqual(session.project.expressions, []);
});

test("shared snapshots take precedence and restore Unicode titles", () => {
  const shared = { ...saved, title: "Graph — π" };
  const hash = `#graph=${encodeURIComponent(Buffer.from(JSON.stringify(shared)).toString("base64"))}`;
  assert.deepEqual(
    restoreSession(
      hash,
      storage({ "grapha-current-v1": JSON.stringify(initial) }),
    ).project,
    shared,
  );
});

test("malformed preferences don't discard a valid saved graph", () => {
  const session = restoreSession(
    "",
    storage({
      "grapha-current-v1": JSON.stringify(saved),
      "grapha-preferences-v1": "{broken",
    }),
  );
  assert.deepEqual(session.project, saved);
  assert.equal(session.light, false);
  assert.equal(session.error, "");
});

test("restoration handles unavailable browser storage", () => {
  const session = restoreSession("", {
    getItem: () => {
      throw new Error("Storage unavailable");
    },
  });
  assert.deepEqual(session.project, initial);
  assert.ok(session.error);
});

test("restoration doesn't add the demo graph to undo history", () => {
  const before = useGraph.getState();
  try {
    useGraph.getState().update({ title: "Previous session" });
    useGraph.getState().restore(saved);
    assert.deepEqual(useGraph.getState().project, saved);
    assert.deepEqual(useGraph.getState().past, []);
    assert.deepEqual(useGraph.getState().future, []);
    useGraph.getState().undo();
    assert.deepEqual(useGraph.getState().project, saved);
  } finally {
    useGraph.setState(before, true);
  }
});

test("the first editor frame contains typeset fractions, not ASCII notation", async () => {
  const { default: MathEditor } = await import("../components/math-editor");
  const html = renderToStaticMarkup(
    createElement(MathEditor, {
      text: "(1)/(x)",
      onChange: () => {},
      onEnter: () => {},
    }),
  );
  assert.match(html, /ML__mfrac/);
  assert.doesNotMatch(html, /y = \(1\)\/\(x\)/);
  assert.match(html, /aria-busy="true"/);
});

test("the preview uses saved LaTeX and keeps unsafe text escaped", async () => {
  const { renderMathPreview } = await import("../lib/math-notation");
  assert.match(renderMathPreview("1/x", "y=\\frac{1}{x}"), /ML__mfrac/);
  const html = renderMathPreview("", '<img src=x onerror="alert(1)">');
  assert.doesNotMatch(html, /<(?:img|script|iframe)[\s>]/i);
  assert.equal(renderMathPreview("", "\\href{javascript:alert(1)}{x}"), "");
});

test("reduced motion persists alongside appearance without changing the graph", () => {
  const session = restoreSession(
    "",
    storage({
      "grapha-current-v1": JSON.stringify(saved),
      "grapha-preferences-v1": JSON.stringify({
        light: true,
        reduceMotion: true,
      }),
    }),
  );
  assert.equal(session.reduceMotion, true);
  assert.equal(session.light, true);
  assert.deepEqual(session.project, saved);
  assert.equal(restoreSession("", storage({})).reduceMotion, false);
});
