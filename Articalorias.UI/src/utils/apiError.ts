import { AxiosError } from "axios";

/**
 * Extracts a user-friendly error message from an Axios error.
 *
 * Handles both the custom middleware shape ({ StatusCode, Message } / { message })
 * and the ASP.NET ProblemDetails shape ({ title, status, errors }).
 */
export function extractApiError(err: unknown, fallback = "An unexpected error occurred."): string {
  if (err instanceof AxiosError && err.response) {
    const d = err.response.data;
    if (typeof d === "string" && d.length > 0) return d;
    if (d && typeof d === "object") {
      // Custom middleware: { Message: "..." } (PascalCase)
      if (typeof d.Message === "string" && d.Message.length > 0) return d.Message;
      // Custom middleware: { message: "..." } (camelCase, e.g. from manual JSON)
      if (typeof d.message === "string" && d.message.length > 0) return d.message;
      // ASP.NET ProblemDetails: { title: "..." }
      if (typeof d.title === "string" && d.title.length > 0) return d.title;
      // ASP.NET model validation: { errors: { field: ["msg", ...] } }
      if (d.errors && typeof d.errors === "object") {
        const msgs = Object.values(d.errors as Record<string, string[]>).flat();
        if (msgs.length > 0) return msgs.join(" ");
      }
    }
    // Fall back to HTTP status text
    if (err.response.statusText) return err.response.statusText;
  }
  if (err instanceof Error && err.message) {
    // Network errors
    if (err.message === "Network Error") return "Unable to connect to the server.";
    return err.message;
  }
  return fallback;
}

/**
 * Returns true when the error is an Axios 404.
 */
export function isNotFound(err: unknown): boolean {
  return err instanceof AxiosError && err.response?.status === 404;
}

/**
 * Extracts the machine-readable ErrorCode from an API error response.
 * Returns undefined when no code is present (legacy endpoints, network errors, etc.).
 */
export function extractApiErrorCode(err: unknown): string | undefined {
  if (err instanceof AxiosError && err.response?.data) {
    const d = err.response.data;
    if (d && typeof d === "object" && typeof d.ErrorCode === "string") return d.ErrorCode;
  }
  return undefined;
}
