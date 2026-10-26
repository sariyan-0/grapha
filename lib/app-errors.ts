export class UserError extends Error {}
export function errorMessage(error: unknown, fallback: string) {
  if (error instanceof UserError) return error.message;
  if (
    error instanceof Error &&
    ["QuotaExceededError", "NS_ERROR_DOM_QUOTA_REACHED"].includes(error.name)
  )
    return "This browser’s storage is full. Export JSON to keep your work.";
  if (error instanceof Error && error.name === "SecurityError")
    return "This browser is blocking local storage. Export JSON to keep your work.";
  return fallback;
}
