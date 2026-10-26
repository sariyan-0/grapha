import { convertAsciiMathToLatex, convertLatexToMarkup } from "mathlive/ssr";

export function expressionLatex(text: string, latex?: string) {
  return latex ?? convertAsciiMathToLatex(text);
}

export function renderMathPreview(text: string, latex?: string) {
  try {
    const value = expressionLatex(text, latex);
    return value ? convertLatexToMarkup(value, { defaultMode: "math" }) : "";
  } catch {
    // Incomplete notation can still be opened and corrected in the live editor.
    return "";
  }
}
