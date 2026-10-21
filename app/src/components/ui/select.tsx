import type * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Native select styled like the other form primitives (SPEC-0010).
 *
 * The settings window only needs option sets, so a native control keeps the
 * dependency surface small while staying keyboard- and screen-reader-friendly.
 */
function Select({ className, ...props }: React.ComponentProps<"select">) {
  return (
    <select
      data-slot="select"
      className={cn(
        "border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-sm shadow-xs transition-[color,box-shadow] outline-none",
        "focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]",
        "disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Select };
