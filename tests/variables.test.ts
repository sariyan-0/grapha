import test from "node:test";
import assert from "node:assert/strict";
import { compileExpression, sampleInverse, toWorld } from "../lib/math";
import { expressionLatex } from "../lib/math-notation";
import { initial, validateProject } from "../lib/store";
import { convertLatexToAsciiMath } from "mathlive/ssr";

test("dependent variable labels are not restricted to y", () => {
  for (const label of ["r", "v", "s", "R", "alpha", "θ"]) {
    const expression = compileExpression(`${label}=5sin(6)`);
    assert.equal(expression.error, undefined, label);
    assert.ok(Math.abs(expression.fn!(7) - 5 * Math.sin(6)) < 1e-12);
    assert.equal(expression.variables?.output, label);
  }
});
test("an unambiguous input is inferred and named functions choose it explicitly", () => {
  for (const [source, input, output, value] of [
    ["v=2t+3", "t", "v", 7],
    ["sin(z)", "z", "y", Math.sin(2)],
    ["f(u)=u^2", "u", "f(u)", 4],
    ["g(theta)=cos(theta)", "theta", "g(theta)", Math.cos(2)],
    ["s=θ^2", "θ", "s", 4],
  ] as const) {
    const compiled = compileExpression(source);
    assert.equal(compiled.error, undefined, source);
    assert.ok(Math.abs(compiled.fn!(2) - value) < 1e-12, source);
    assert.equal(compiled.variables?.input, input);
    assert.equal(compiled.variables?.output, output);
  }
});
test("undefined parameters stay parameters when the input is explicit or unambiguous", () => {
  assert.equal(compileExpression("a*t").issue?.parameter, "a");
  assert.equal(compileExpression("f(t)=t+k").issue?.parameter, "k");
  assert.equal(compileExpression("f(t)=t+k", { k: 4 }).fn!(2), 6);
  assert.equal(compileExpression("u*v").issue?.kind, "invalid");
  assert.match(compileExpression("u*v").error!, /Choose an input/);
  assert.equal(compileExpression("f(u)=u*v", { v: 3 }).fn!(2), 6);
  // An explicit argument remains an input even if a slider uses the same name.
  assert.equal(compileExpression("f(t)=t^2", { t: 9 }).fn!(2), 4);
});
test("horizontal equations are sampled in the correct coordinate system", () => {
  assert.equal(compileExpression("sin(y)").inverseFn!(Math.PI / 2), 1);
  const compiled = compileExpression("x=2");
  assert.equal(compiled.fn, undefined);
  assert.equal(compiled.inverseFn!(5), 2);
  const viewport = { x: -1, y: 3, scale: 70 };
  for (const point of sampleInverse(
    compiled.inverseFn!,
    viewport,
    900,
    600,
  ).flat()) {
    assert.ok(
      Math.abs(toWorld(point.x, point.y, viewport, 900, 600).x - 2) < 1e-10,
    );
  }
  const rational = compileExpression("x=1/(y-2)");
  assert.ok(
    sampleInverse(rational.inverseFn!, { x: 0, y: 0, scale: 70 }, 900, 600)
      .length > 1,
  );
});
test("renamed inputs retain denominator guards and mathematical validation", () => {
  const compiled = compileExpression("r=1/(t-2)");
  assert.ok(Number.isNaN(compiled.fn!(2)));
  assert.equal(compiled.fn?.denominators?.[0](2), 0);
  for (const input of [
    "r=r+1",
    "e=2",
    "constructor",
    "f(pi)=pi",
    "x^2+y^2=9",
    'f(t)=import("bad")',
  ])
    assert.ok(compileExpression(input).error, input);
  assert.ok(compileExpression("r=").issue);
});
test("named equations retain their notation without an extra y prefix", () => {
  for (const input of ["r=5sin(6)", "f(t)=t^2", "x=2"]) {
    const restored = convertLatexToAsciiMath(expressionLatex(input));
    assert.doesNotMatch(restored, /^y=/);
    assert.equal(compileExpression(restored).error, undefined);
  }
});
test("custom sliders round-trip and reserved names are rejected", () => {
  const project = { ...initial, parameters: { k: 2, theta: 3 } };
  assert.deepEqual(
    validateProject(JSON.parse(JSON.stringify(project))),
    project,
  );
  for (const name of ["x", "y", "pi", "e", "sin", "constructor", "__proto__"])
    assert.throws(
      () => validateProject({ ...initial, parameters: { [name]: 1 } }),
      name,
    );
});
