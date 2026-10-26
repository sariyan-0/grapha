import test from "node:test";
import assert from "node:assert/strict";
import {
  analyze,
  compileExpression,
  sample,
  toScreen,
  toWorld,
} from "../lib/math";
import { initial, validateProject } from "../lib/store";
test("safe real-valued evaluation supports essential functions and precedence", () => {
  for (const [text, x, y] of [
    ["2x+3", 2, 7],
    ["x^2-4", 3, 5],
    ["sin(pi/2)", 0, 1],
    ["2cos(x)", 0, 2],
    ["sqrt(x)", 9, 3],
    ["abs(x)", -3, 3],
    ["e^x", 0, 1],
    ["log(e)", 0, 1],
    ["sin(cos(x))", 0, Math.sin(1)],
    ["y = |x|", -4, 4],
    ["ln(x)", Math.E, 1],
  ] as const) {
    const result = compileExpression(text);
    assert.equal(result.error, undefined, text);
    assert.ok(Math.abs(result.fn!(x) - y) < 1e-10, text);
  }
});
test("undefined and complex values never enter the renderer", () => {
  assert.ok(Number.isNaN(compileExpression("1/x").fn!(0)));
  assert.ok(Number.isNaN(compileExpression("sqrt(x)").fn!(-1)));
});
test("unsafe and unsupported syntax is rejected", () => {
  for (const s of [
    'import("foo")',
    "x=2; x",
    "a+x",
    "[1,2,3]",
    "x!",
    "random()",
    "x; x",
  ])
    assert.ok(compileExpression(s).error, s);
});
test("screen and world transforms round-trip across pans and zooms", () => {
  for (const scale of [2, 70, 2000]) {
    const v = { x: 13.5, y: -2.4, scale };
    const p = toScreen(-4.2, 8.9, v, 1200, 800),
      r = toWorld(p.x, p.y, v, 1200, 800);
    assert.ok(Math.abs(r.x + 4.2) < 1e-10);
    assert.ok(Math.abs(r.y - 8.9) < 1e-10);
  }
});
test("rational and tangent asymptotes split into separate paths", () => {
  const v = { x: 0, y: 0, scale: 70 };
  for (const input of ["1/(x-2)", "tan(x)"]) {
    const segments = sample(compileExpression(input).fn!, v, 1000, 700);
    assert.ok(segments.length > 1, input);
    for (const segment of segments)
      for (let i = 1; i < segment.length; i++)
        assert.ok(Math.abs(segment[i].y - segment[i - 1].y) < 350, input);
  }
});
test("removable discontinuity is not joined through an undefined sample", () => {
  const segments = sample(
    compileExpression("(x^2-1)/(x-1)").fn!,
    { x: 1, y: 0, scale: 70 },
    600,
    600,
  );
  assert.ok(segments.length >= 2);
});
test("removable discontinuities between initial samples also split paths", () => {
  const segments = sample(
    compileExpression("(x^2-1)/(x-1)").fn!,
    { x: 0.137, y: 0, scale: 73 },
    701,
    500,
  );
  assert.ok(segments.length >= 2);
});
test("numerical analysis verifies roots and extrema and rejects poles", () => {
  const findings = analyze(compileExpression("x^2-4").fn!, -5, 5);
  assert.ok(
    findings.some((p) => p.kind === "Root" && Math.abs(p.x - 2) < 1e-6),
  );
  assert.ok(
    findings.some((p) => p.kind === "Root" && Math.abs(p.x + 2) < 1e-6),
  );
  assert.ok(
    findings.some(
      (p) =>
        p.kind === "Local minimum" &&
        Math.abs(p.x) < 1e-5 &&
        Math.abs(p.y + 4) < 1e-5,
    ),
  );
  assert.ok(
    !analyze(compileExpression("1/(x-2)").fn!, -5, 5).some(
      (p) => p.kind === "Root",
    ),
  );
});
test("project round-trip preserves state and rejects corrupt imports", () => {
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(initial))),
    initial,
  );
  for (const value of [
    null,
    {},
    { ...initial, version: 2 },
    { ...initial, viewport: { x: 0, y: 0, scale: 0 } },
    {
      ...initial,
      expressions: [
        { id: "x", text: "x", color: "javascript:bad", visible: true },
      ],
    },
  ])
    assert.throws(() => validateProject(value));
});

test("parameter values update evaluation without stale cache entries", () => {
  assert.equal(compileExpression("a*x", { a: 2 }).fn!(3), 6);
  assert.equal(compileExpression("a*x", { a: 4 }).fn!(3), 12);
  assert.ok(compileExpression("a*x").error);
});
test("MathLive notation round-trips into the mathematical evaluator", async () => {
  const { convertAsciiMathToLatex, convertLatexToAsciiMath } =
    await import("mathlive");
  for (const source of [
    "sin(x)",
    "x^2/4-2",
    "2cos(x)",
    "sqrt(x)",
    "abs(x)",
    "1/(x-2)",
  ]) {
    const notation = convertAsciiMathToLatex(`y=${source}`);
    const roundtrip = convertLatexToAsciiMath(notation);
    const expected = compileExpression(source).fn!(3),
      actual = compileExpression(roundtrip).fn!(3);
    assert.ok(Math.abs(expected - actual) < 1e-10, roundtrip);
  }
});

test("notes and point tables survive project serialization", () => {
  const items: import("../lib/workspace-items").WorkspaceItem[] = [
    { id: "note-1", type: "note", text: "Check the roots near zero." },
    {
      id: "table-1",
      type: "table",
      color: "#36cfdd",
      visible: true,
      rows: [
        { id: "r1", x: "-2", y: "4" },
        { id: "r2", x: "0", y: "0" },
      ],
    },
  ];
  const project = { ...initial, items };
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(project))),
    project,
  );
  for (const item of [
    { id: "bad", type: "note", text: 4 },
    { id: "bad", type: "table", color: "#fff", visible: true, rows: [] },
    {
      id: "bad",
      type: "table",
      color: "#36cfdd",
      visible: true,
      rows: [{ x: null, y: "4" }],
    },
  ])
    assert.throws(() => validateProject({ ...initial, items: [item] }));
});
test("point tables plot complete finite pairs and skip hidden or unfinished rows", async () => {
  const { tablePoints } = await import("../lib/workspace-items");
  const table: import("../lib/workspace-items").PointTable = {
    id: "points",
    type: "table",
    color: "#36cfdd",
    visible: true,
    rows: [
      { id: "1", x: "-2", y: "4" },
      { id: "2", x: "", y: "0" },
      { id: "3", x: "2", y: "Infinity" },
      { id: "4", x: "a", y: "2" },
    ],
  };
  assert.deepEqual(tablePoints([table]), [
    { id: "points", x: -2, y: 4, color: "#36cfdd" },
  ]);
  assert.deepEqual(tablePoints([{ ...table, visible: false }]), []);
});
