import { parse, type MathNode } from "mathjs";
import {
  functionArities as functions,
  isParameterName,
} from "./variable-names";
import {
  splitNamedExpression,
  expressionVariables,
  type ExpressionVariables,
} from "./expression-variables";
import {
  checkIncompleteInput,
  expressionError,
  ExpressionError,
  type ExpressionIssue,
} from "./expression-errors";
export type Evaluator = ((x: number) => number) & {
  denominators?: ((x: number) => number)[];
};
export type CompiledExpression = {
  fn?: Evaluator;
  inverseFn?: Evaluator;
  variables?: ExpressionVariables;
  error?: string;
  issue?: ExpressionIssue;
};
const cache = new Map<string, CompiledExpression>();
export function compileExpression(
  source: string,
  parameters: Record<string, number> = {},
): CompiledExpression {
  const key = source + JSON.stringify(parameters);
  const cached = cache.get(key);
  if (cached) return cached;
  let result: CompiledExpression;
  try {
    let input = source
      .trim()
      .replace(/π/g, "pi")
      .replace(/²/g, "^2")
      .replace(/³/g, "^3")
      .replace(/−/g, "-")
      .replace(/×/g, "*")
      .replace(/÷/g, "/")
      .replace(/√\s*\(/g, "sqrt(")
      .replace(/√([a-z0-9.]+)/gi, "sqrt($1)");
    if (input.length > 500)
      expressionError(
        "unsupported",
        "This expression is too long.",
        "Keep each expression under 500 characters.",
      );
    const form = splitNamedExpression(input);
    input = form.body;
    checkIncompleteInput(input);
    input = input.replace(/\|([^|]+)\|/g, "abs($1)");
    const node = parse(input);
    const variables = expressionVariables(node, form, parameters);
    let count = 0,
      hasInput = false;
    node.traverse((n: MathNode, path, parent) => {
      count++;
      if (count > 120)
        expressionError(
          "unsupported",
          "This expression is too complex.",
          "Split the calculation into smaller expressions.",
        );
      if (
        ![
          "OperatorNode",
          "ConstantNode",
          "SymbolNode",
          "FunctionNode",
          "ParenthesisNode",
        ].includes(n.type)
      )
        expressionError(
          "unsupported",
          "This type of expression isn’t supported.",
          "Use a real-valued function such as y = sin(x).",
        );
      if (
        n.type === "ConstantNode" &&
        typeof (n as MathNode & { value: unknown }).value !== "number"
      )
        expressionError(
          "invalid",
          "Use numbers in mathematical expressions.",
          "Use a note from the + menu for written text.",
        );
      if (n.type === "FunctionNode") {
        const call = n as MathNode & { fn: MathNode; args: MathNode[] };
        const name = call.fn.toString(),
          arity = Object.hasOwn(functions, name) ? functions[name] : undefined;
        if (!arity)
          expressionError(
            "unsupported",
            `The function “${name}” isn’t supported.`,
            "Try sin(x), sqrt(x), or log(x).",
          );
        if (call.args.length < arity[0] || call.args.length > arity[1])
          expressionError(
            "invalid",
            `Check the inputs to ${name}.`,
            arity[0] === arity[1]
              ? `Use ${name}(x) with one input.`
              : name === "log"
                ? "Use log(x) or log(x, base)."
                : `Use ${name}(x) or ${name}(x, digits).`,
          );
      }
      if (n.type === "SymbolNode") {
        const name = n.toString();
        hasInput ||= name === variables.input;
        if (Object.hasOwn(functions, name)) {
          if (!(parent?.type === "FunctionNode" && path === "fn"))
            expressionError(
              "incomplete",
              `Add an input to ${name}.`,
              `For example, ${name}(x).`,
            );
        } else if (
          ![variables.input, "pi", "e", ...Object.keys(parameters)].includes(
            name,
          )
        )
          expressionError(
            "invalid",
            `“${name}” doesn’t have a value yet.`,
            isParameterName(name) && Object.keys(parameters).length < 16
              ? `Add a slider for ${name}, or replace it with a number.`
              : `The input for this graph is ${variables.input}. Use f(${name}) = … to change it.`,
            isParameterName(name) && Object.keys(parameters).length < 16
              ? name
              : undefined,
          );
      }
      if (
        n.type === "OperatorNode" &&
        !["+", "-", "*", "/", "^"].includes((n as MathNode & { op: string }).op)
      )
        expressionError(
          "unsupported",
          "This operator isn’t supported.",
          "Use +, −, ×, ÷, or ^.",
        );
    });
    const denominators: ((x: number) => number)[] = [];
    node.traverse((n) => {
      if (
        n.type === "OperatorNode" &&
        (n as MathNode & { op: string }).op === "/"
      ) {
        const denominator = (
          n as MathNode & { args: MathNode[] }
        ).args[1].compile();
        denominators.push((x) => {
          try {
            const value: unknown = denominator.evaluate({
              ...parameters,
              [variables.input]: x,
              ln: Math.log,
            });
            return typeof value === "number" ? value : NaN;
          } catch {
            return NaN;
          }
        });
      }
    });
    const code = node.compile();
    const evaluate: Evaluator = (value) => {
      try {
        const y: unknown = code.evaluate({
          ...parameters,
          [variables.input]: value,
          ln: Math.log,
        });
        return typeof y === "number" && Number.isFinite(y) ? y : NaN;
      } catch {
        return NaN;
      }
    };
    evaluate.denominators = denominators;
    result =
      variables.axis === "horizontal"
        ? { inverseFn: evaluate, variables }
        : { fn: evaluate, variables };
    if (!hasInput && !Number.isFinite(evaluate(0)))
      expressionError(
        "invalid",
        "This result is undefined, complex, or too large to plot.",
        "Check denominators, square roots, logarithms, and large powers.",
      );
  } catch (error) {
    const issue =
      error instanceof ExpressionError
        ? error.issue
        : {
            kind: "invalid" as const,
            message: "Check the expression’s syntax.",
            hint: "Use matching parentheses and an expression such as 1/(x − 2).",
          };
    result = { error: issue.message, issue };
  }
  if (cache.size > 150) cache.clear();
  cache.set(key, result);
  return result;
}
export type Viewport = { x: number; y: number; scale: number };
export function toScreen(
  x: number,
  y: number,
  v: Viewport,
  w: number,
  h: number,
) {
  return { x: w / 2 + (x - v.x) * v.scale, y: h / 2 - (y - v.y) * v.scale };
}
export function toWorld(
  x: number,
  y: number,
  v: Viewport,
  w: number,
  h: number,
) {
  return { x: (x - w / 2) / v.scale + v.x, y: (h / 2 - y) / v.scale + v.y };
}
export function tickStep(scale: number) {
  const raw = 85 / scale,
    magnitude = 10 ** Math.floor(Math.log10(raw));
  return [1, 2, 5, 10].find((n) => n * magnitude >= raw)! * magnitude;
}
export function sample(
  fn: Evaluator,
  v: Viewport,
  w: number,
  h: number,
): { x: number; y: number }[][] {
  const segments: { x: number; y: number }[][] = [];
  let segment: { x: number; y: number }[] = [];
  const point = (px: number) => {
    const x = (px - w / 2) / v.scale + v.x;
    return { x: px, y: h / 2 - (fn(x) - v.y) * v.scale };
  };
  const emit = (p: { x: number; y: number }) => {
    if (!Number.isFinite(p.y) || Math.abs(p.y) > h * 8) {
      if (segment.length > 1) segments.push(segment);
      segment = [];
    } else segment.push(p);
  };
  const walk = (
    a: { x: number; y: number },
    b: { x: number; y: number },
    depth: number,
  ) => {
    const m = point((a.x + b.x) / 2),
      error = Math.abs(m.y - (a.y + b.y) / 2);
    const ax = (a.x - w / 2) / v.scale + v.x,
      bx = (b.x - w / 2) / v.scale + v.x;
    // A canceled denominator still leaves a hole in the original expression.
    const crossesHole =
      fn.denominators?.some((d) => {
        const l = d(ax),
          r = d(bx);
        return l === 0 || r === 0 || l * r < 0;
      }) ?? false;
    if (
      !Number.isFinite(a.y) &&
      !Number.isFinite(b.y) &&
      !Number.isFinite(m.y)
    ) {
      emit({ x: m.x, y: NaN });
      return;
    }
    if (
      depth < 9 &&
      (crossesHole ||
        error > 0.65 ||
        Math.abs(a.y - b.y) > h / 3 ||
        !Number.isFinite(m.y)) &&
      b.x - a.x > 0.004
    ) {
      walk(a, m, depth + 1);
      walk(m, b, depth + 1);
      return;
    }
    if (
      crossesHole ||
      !Number.isFinite(m.y) ||
      error > 5 ||
      Math.abs(a.y - b.y) > h / 2
    ) {
      emit({ x: m.x, y: NaN });
    } else emit(b);
  };
  let a = point(0);
  emit(a);
  for (let px = 3; px < w + 3; px += 3) {
    const b = point(Math.min(px, w));
    walk(a, b, 0);
    a = b;
  }
  if (segment.length > 1) segments.push(segment);
  return segments;
}
export function sampleInverse(
  fn: Evaluator,
  v: Viewport,
  w: number,
  h: number,
) {
  return sample(fn, { x: v.y, y: v.x, scale: v.scale }, h, w).map((segment) =>
    segment.map((point) => ({ x: w - point.y, y: h - point.x })),
  );
}
export type Finding = { kind: string; x: number; y: number };
export function analyze(fn: Evaluator, min: number, max: number): Finding[] {
  const findings: Finding[] = [];
  const add = (kind: string, x: number, y: number) => {
    if (
      Number.isFinite(y) &&
      !findings.some((p) => p.kind === kind && Math.abs(p.x - x) < 0.001)
    )
      findings.push({ kind, x, y });
  };
  const y0 = fn(0);
  if (Number.isFinite(y0)) add("Y-intercept", 0, y0);
  const delta = (max - min) / 1000;
  const derivative = (x: number) => (fn(x + 1e-5) - fn(x - 1e-5)) / 2e-5;
  const bisect = (f: Evaluator, l: number, r: number) => {
    for (let i = 0; i < 45; i++) {
      const m = (l + r) / 2;
      if (f(l) * f(m) <= 0) r = m;
      else l = m;
    }
    return (l + r) / 2;
  };
  for (let i = 0; i < 1000; i++) {
    const a = min + i * delta,
      b = a + delta,
      ya = fn(a),
      yb = fn(b);
    if (ya === 0) add("Root", a, 0);
    else if (ya * yb < 0) {
      const x = bisect(fn, a, b);
      // A sign change alone can also be a pole. Check the residual first.
      if (Math.abs(fn(x)) < 1e-6) add("Root", x, 0);
    }
    if (
      Math.abs(derivative(a)) < 1e-9 &&
      derivative(a - delta) * derivative(a + delta) < 0
    ) {
      add(derivative(a - delta) > 0 ? "Local maximum" : "Local minimum", a, ya);
    }
    if (derivative(a) * derivative(b) < 0) {
      const x = bisect(derivative, a, b),
        y = fn(x);
      if (Math.abs(derivative(x)) < 1e-3)
        add(derivative(a) > 0 ? "Local maximum" : "Local minimum", x, y);
    }
  }
  return findings.slice(0, 40).sort((a, b) => a.x - b.x);
}
