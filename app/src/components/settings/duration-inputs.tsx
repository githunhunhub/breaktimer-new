import { Input } from "@/components/ui/input";

import { joinDurationSeconds, splitSeconds } from "./durations";

interface DurationInputsProps {
  minutesId?: string;
  value: number;
  disabled: boolean;
  minutesLabel: string;
  secondsLabel: string;
  onChange: (seconds: number) => void;
}

export function DurationInputs({
  minutesId,
  value,
  disabled,
  minutesLabel,
  secondsLabel,
  onChange,
}: DurationInputsProps) {
  const { minutes, seconds } = splitSeconds(value);

  return (
    <div className="flex items-center gap-2">
      <Input
        id={minutesId}
        type="number"
        min={0}
        className="w-20"
        aria-label={minutesLabel}
        value={minutes}
        disabled={disabled}
        onChange={(event) =>
          onChange(joinDurationSeconds(Number(event.target.value), seconds))
        }
      />
      <span className="text-muted-foreground text-sm">min</span>
      <Input
        type="text"
        className="w-14 px-2 text-center tabular-nums"
        aria-label={secondsLabel}
        value={seconds}
        disabled={disabled}
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={2}
        onChange={(event) =>
          onChange(
            joinDurationSeconds(
              minutes,
              Math.min(59, Math.max(0, Number(event.target.value) || 0)),
            ),
          )
        }
      />
      <span className="text-muted-foreground text-sm">sec</span>
    </div>
  );
}
