export type ExpressionIssue = {
  kind: "incomplete" | "invalid" | "unsupported";
  message: string;
  hint: string;
  parameter?: string;
};
export class ExpressionError extends Error {
  constructor(public issue: ExpressionIssue) {
    super(issue.message);
  }
}
export function expressionError(
  kind: ExpressionIssue["kind"],
  message: string,
  hint: string,
  parameter?: string,
): never {
  throw new ExpressionError({ kind, message, hint, parameter });
}
export function checkIncompleteInput(input: string) {
  if (!input)
    expressionError(
      "incomplete",
      "Enter an expression.",
      "Try y = sin(x) or y = x².",
    );
  if (/placeholder|[□▢?]/.test(input))
    expressionError(
      "incomplete",
      "Fill in the empty part.",
      "Add a value in the fraction, root, or exponent.",
    );
  if (/\*\*/.test(input))
    expressionError(
      "invalid",
      "Use ^ for powers.",
      "Write x^2 instead of x**2.",
    );
  if (/[<>≤≥]/.test(input))
    expressionError(
      "unsupported",
      "Inequalities aren’t supported yet.",
      "Enter an equation such as y = x².",
    );
  if (input.includes("="))
    expressionError(
      "unsupported",
      "Use one equation per row.",
      "For example, r = sin(t) or f(t) = t².",
    );
  const operator = input.match(/([+\-*/^])\s*\)*\s*$/)?.[1];
  if (operator) {
    const descriptions: Record<string, [string, string]> = {
      "+": ["Finish the addition.", "Add a number or expression after +."],
      "-": ["Finish the subtraction.", "Add a number or expression after −."],
      "*": [
        "Finish the multiplication.",
        "Add a number or expression after ×.",
      ],
      "/": [
        "Add a denominator.",
        "Enter a nonzero number or expression below the fraction bar.",
      ],
      "^": ["Add an exponent.", "Enter a power, for example x²."],
    };
    expressionError("incomplete", ...descriptions[operator]);
  }
  if (/\/\s*\(\s*\)$/.test(input) || /\/\s*\(\s*$/.test(input))
    expressionError(
      "incomplete",
      "Add a denominator.",
      "Enter a number or expression below the fraction bar.",
    );
  if (/\(\s*\)/.test(input) || /\(\s*$/.test(input))
    expressionError(
      "incomplete",
      "Add an input inside the parentheses.",
      "For example, sin(x) or sqrt(x).",
    );
  let balance = 0;
  for (const char of input) {
    if (char === "(") balance++;
    if (char === ")") balance--;
    if (balance < 0)
      expressionError(
        "invalid",
        "There’s an extra closing parenthesis.",
        "Remove the extra ) or add its matching (.",
      );
  }
  if (balance > 0)
    expressionError(
      "incomplete",
      "Close the parentheses.",
      "Add a matching ) after the input.",
    );
  if ((input.match(/\|/g)?.length ?? 0) % 2)
    expressionError(
      "incomplete",
      "Close the absolute-value bars.",
      "For example, |x|.",
    );
}
