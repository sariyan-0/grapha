import type { MathNode } from "mathjs";
import { expressionError } from "./expression-errors";
import { functionArities, isVariableName } from "./variable-names";
export type ExpressionVariables = {
  input: string;
  output: string;
  axis: "vertical" | "horizontal";
};
export function splitNamedExpression(source: string) {
  const sides = source.split("=");
  if (sides.length === 1)
    return {
      body: source,
      labelled: false,
      output: "y",
      argument: undefined as string | undefined,
      axis: "vertical" as const,
    };
  if (sides.length !== 2)
    expressionError(
      "invalid",
      "Use one equation per row.",
      "For example, r = sin(t) or f(t) = t².",
    );
  const label = sides[0].trim(),
    body = sides[1].trim();
  if (!label)
    expressionError(
      "incomplete",
      "Add a name before the equals sign.",
      "For example, r = sin(t).",
    );
  if (!body)
    expressionError(
      "incomplete",
      "Finish the right side of the equation.",
      "Enter an expression after =.",
    );
  const named = label.match(
    /^([\p{L}][\p{L}\p{N}_]*)\s*\(\s*([\p{L}][\p{L}\p{N}_]*)\s*\)$/u,
  );
  if (named) {
    if (!isVariableName(named[1]) || !isVariableName(named[2]))
      expressionError(
        "unsupported",
        "Choose a different function or input name.",
        "Names such as f(t), g(u), and h(z) are supported; π, e, and built-in function names are reserved.",
      );
    return {
      body,
      output: `${named[1]}(${named[2]})`,
      labelled: true,
      argument: named[2],
      axis: "vertical" as const,
    };
  }
  if (!isVariableName(label))
    expressionError(
      "unsupported",
      "Use a variable or function name on the left.",
      "Try r = sin(t) or f(t) = t². Implicit equations are not supported yet.",
    );
  return {
    body,
    output: label,
    labelled: true,
    argument: undefined as string | undefined,
    axis: label === "x" ? ("horizontal" as const) : ("vertical" as const),
  };
}
export function expressionVariables(
  node: MathNode,
  form: ReturnType<typeof splitNamedExpression>,
  parameters: Record<string, number>,
): ExpressionVariables {
  const free = new Set<string>();
  node.traverse((n, path, parent) => {
    if (
      n.type !== "SymbolNode" ||
      (parent?.type === "FunctionNode" && path === "fn")
    )
      return;
    const name = n.toString();
    if (
      !["pi", "e"].includes(name) &&
      !Object.hasOwn(functionArities, name) &&
      !Object.hasOwn(parameters, name)
    )
      free.add(name);
  });
  let input = form.argument;
  if (!input) {
    const coordinate = form.axis === "horizontal" ? "y" : "x";
    if (free.has(coordinate)) input = coordinate;
    else if (free.size === 1) input = [...free][0];
    else if (free.size > 1) {
      const candidates = [...free].filter(
        (name) => !["a", "b", "c"].includes(name),
      );
      if (candidates.length === 1) input = candidates[0];
      else
        expressionError(
          "invalid",
          "Choose an input variable.",
          "Use a named function such as f(t) = … to choose the input, and sliders for other values.",
        );
    } else input = coordinate;
  }
  if (!isVariableName(input))
    expressionError(
      "invalid",
      "Choose a different input name.",
      "Use a letter or name such as t, u, z, or theta. Constants and reserved names cannot be inputs.",
    );
  if (!form.labelled && input === "y")
    return { input, output: "x", axis: "horizontal" };
  if (input === form.output)
    expressionError(
      "unsupported",
      `“${form.output}” appears on both sides of the equation.`,
      "Use a different input variable, for example r = sin(t).",
    );
  return { input, output: form.output, axis: form.axis };
}
