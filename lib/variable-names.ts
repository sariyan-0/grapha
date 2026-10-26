export const functionArities: Record<string, readonly [number, number]> = {
  sin: [1, 1],
  cos: [1, 1],
  tan: [1, 1],
  asin: [1, 1],
  acos: [1, 1],
  atan: [1, 1],
  sqrt: [1, 1],
  abs: [1, 1],
  exp: [1, 1],
  log: [1, 2],
  ln: [1, 1],
  log10: [1, 1],
  sinh: [1, 1],
  cosh: [1, 1],
  tanh: [1, 1],
  floor: [1, 2],
  ceil: [1, 2],
};
export function isVariableName(name: string) {
  return (
    /^[\p{L}][\p{L}\p{N}_]{0,31}$/u.test(name) &&
    !["pi", "e", "Infinity", "NaN"].includes(name) &&
    !Object.hasOwn(functionArities, name) &&
    !(name in Object.prototype)
  );
}
export function isParameterName(name: string) {
  return isVariableName(name) && !["x", "y"].includes(name);
}
