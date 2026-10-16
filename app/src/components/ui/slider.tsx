import type * as React from "react";

import { cn } from "@/lib/utils";

/** Range input styled to match the form primitives (SPEC-0010). */
function Slider({
  className,
  ...props
}: Omit<React.ComponentProps<"input">, "type">) {
  return (
    <input
      type="range"
      data-slot="slider"
      className={cn(
        "accent-primary h-9 w-full cursor-pointer disabled:cursor-not-allowed disabled:opacity-50",
        className,
      )}
      {...props}
    />
  );
}

export { Slider };
