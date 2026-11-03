import { ipc } from "./ipc";

type DiagnosticReporter = (
  message: string,
  stack: string,
) => void | Promise<void>;

export function installGlobalErrorLogging(
  report: DiagnosticReporter = reportFrontendError,
): () => void {
  const onError = (event: ErrorEvent) => {
    reportSafely(report, errorEventDetails(event));
  };
  const onUnhandledRejection = (event: PromiseRejectionEvent) => {
    reportSafely(report, errorDetails(event.reason));
  };

  window.addEventListener("error", onError);
  window.addEventListener("unhandledrejection", onUnhandledRejection);

  return () => {
    window.removeEventListener("error", onError);
    window.removeEventListener("unhandledrejection", onUnhandledRejection);
  };
}

function reportFrontendError(message: string, stack: string) {
  return ipc.logFrontendError(message, stack);
}

function reportSafely(
  report: DiagnosticReporter,
  details: { message: string; stack: string },
) {
  try {
    void Promise.resolve(report(details.message, details.stack)).catch(
      () => {},
    );
  } catch {
    // Diagnostics must never create another unhandled frontend error.
  }
}

function errorEventDetails(event: ErrorEvent) {
  const details = errorDetails(event.error);
  const location =
    event.filename && event.lineno
      ? `${event.filename}:${event.lineno}:${event.colno}`
      : "";
  return {
    message: event.message || details.message,
    stack: joinDetails(location, details.stack),
  };
}

function errorDetails(error: unknown) {
  if (error instanceof Error) {
    return {
      message: error.message || error.name,
      stack: error.stack ?? "",
    };
  }

  return {
    message: typeof error === "string" ? error : String(error),
    stack: "",
  };
}

function joinDetails(...parts: Array<string | undefined>) {
  return parts.filter(Boolean).join("\n");
}
