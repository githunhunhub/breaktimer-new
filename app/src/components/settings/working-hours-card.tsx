import { Copy, Plus, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import type {
  Settings,
  WorkingHours,
  WorkingHoursRange,
} from "@/types/settings";

import { SettingsCard } from "./settings-card";
import {
  DEFAULT_WORKING_HOURS_RANGE,
  WORKING_HOURS_DAYS,
  minutesToTimeValue,
  timeValueToMinutes,
  updateRangeEnd,
  updateRangeStart,
  type WorkingHoursDay,
  type WorkingHoursDayKey,
} from "./working-hours";

interface WorkingHoursCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
}

export function WorkingHoursCard({ settings, onPatch }: WorkingHoursCardProps) {
  function updateDay(key: WorkingHoursDayKey, value: WorkingHours) {
    onPatch({ [key]: value } as Partial<Settings>);
  }

  function copyDayToDays(
    sourceKey: WorkingHoursDayKey,
    targetKeys: WorkingHoursDayKey[],
  ) {
    const source = settings[sourceKey];
    const patch: Partial<Record<WorkingHoursDayKey, WorkingHours>> = {};

    targetKeys.forEach((targetKey) => {
      patch[targetKey] = {
        enabled: source.enabled,
        ranges: source.ranges.map((range) => ({ ...range })),
      };
    });

    onPatch(patch as Partial<Settings>);
  }

  return (
    <SettingsCard
      title="Working Hours"
      toggle={{
        label: "Restrict breaks to working hours",
        checked: settings.workingHoursEnabled,
        onCheckedChange: (checked) => onPatch({ workingHoursEnabled: checked }),
      }}
    >
      <div className="flex flex-col gap-2">
        {WORKING_HOURS_DAYS.map((day) => (
          <DayRow
            key={day.key}
            day={day}
            workingHours={settings[day.key]}
            disabled={!settings.workingHoursEnabled}
            onChange={(value) => updateDay(day.key, value)}
            onCopy={(targetKeys) => copyDayToDays(day.key, targetKeys)}
          />
        ))}
      </div>
    </SettingsCard>
  );
}

interface DayRowProps {
  day: WorkingHoursDay;
  workingHours: WorkingHours;
  disabled: boolean;
  onChange: (workingHours: WorkingHours) => void;
  onCopy: (targetKeys: WorkingHoursDayKey[]) => void;
}

function DayRow({
  day,
  workingHours,
  disabled,
  onChange,
  onCopy,
}: DayRowProps) {
  const controlsDisabled = disabled || !workingHours.enabled;
  const [copyOpen, setCopyOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<WorkingHoursDayKey[]>([]);

  function replaceRange(index: number, range: WorkingHoursRange) {
    onChange({
      ...workingHours,
      ranges: workingHours.ranges.map((current, currentIndex) =>
        currentIndex === index ? range : current,
      ),
    });
  }

  function toggleTargetDay(key: WorkingHoursDayKey) {
    setSelectedDays((current) =>
      current.includes(key)
        ? current.filter((selected) => selected !== key)
        : [...current, key],
    );
  }

  function applyCopy() {
    if (selectedDays.length === 0) return;
    onCopy(selectedDays);
    setSelectedDays([]);
    setCopyOpen(false);
  }

  return (
    <div className="flex flex-col gap-2">
      {workingHours.ranges.map((range, index) => (
        <div key={index} className="flex min-h-9 items-center gap-2">
          <div className="flex w-32 shrink-0 items-center gap-2">
            {index === 0 ? (
              <>
                <Switch
                  aria-label={day.label}
                  checked={workingHours.enabled}
                  disabled={disabled}
                  onCheckedChange={(checked) =>
                    onChange({ ...workingHours, enabled: checked })
                  }
                />
                <span className="text-sm font-medium">{day.label}</span>
              </>
            ) : null}
          </div>

          {workingHours.enabled ? (
            <>
              <CompactTimeInput
                aria-label={`${day.label} start ${index + 1}`}
                value={minutesToTimeValue(range.fromMinutes)}
                disabled={controlsDisabled}
                onCommit={(minutes) =>
                  replaceRange(index, updateRangeStart(range, minutes))
                }
              />
              <span aria-hidden className="text-muted-foreground text-sm">
                to
              </span>
              <CompactTimeInput
                aria-label={`${day.label} end ${index + 1}`}
                value={minutesToTimeValue(range.toMinutes)}
                disabled={controlsDisabled}
                onCommit={(minutes) =>
                  replaceRange(index, updateRangeEnd(range, minutes))
                }
              />

              {index === 0 ? (
                <div className="relative flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Add ${day.label} range`}
                    disabled={controlsDisabled}
                    onClick={() =>
                      onChange({
                        ...workingHours,
                        ranges: [
                          ...workingHours.ranges,
                          { ...DEFAULT_WORKING_HOURS_RANGE },
                        ],
                      })
                    }
                  >
                    <Plus />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Copy ${day.label} ranges`}
                    aria-expanded={copyOpen}
                    disabled={controlsDisabled}
                    onClick={() => setCopyOpen((open) => !open)}
                  >
                    <Copy />
                  </Button>

                  {copyOpen && (
                    <div
                      role="dialog"
                      aria-label={`Copy ${day.label} ranges`}
                      className="bg-popover absolute top-10 right-0 z-20 w-52 rounded-md border p-3 shadow-md"
                      onKeyDown={(event) => {
                        if (event.key === "Escape") setCopyOpen(false);
                      }}
                    >
                      <p className="mb-3 text-sm font-semibold">
                        Copy ranges to:
                      </p>
                      <div className="mb-4 flex flex-col gap-2">
                        {WORKING_HOURS_DAYS.map((otherDay) => {
                          const isSource = otherDay.key === day.key;

                          return (
                            <label
                              key={otherDay.key}
                              className="flex items-center gap-2 text-sm"
                            >
                              <input
                                type="checkbox"
                                aria-label={otherDay.label}
                                checked={
                                  isSource ||
                                  selectedDays.includes(otherDay.key)
                                }
                                disabled={isSource}
                                onChange={() => toggleTargetDay(otherDay.key)}
                                className="accent-primary size-4"
                              />
                              <span>{otherDay.label}</span>
                            </label>
                          );
                        })}
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={selectedDays.length === 0}
                        onClick={applyCopy}
                      >
                        Apply
                      </Button>
                    </div>
                  )}
                </div>
              ) : (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${day.label} range ${index + 1}`}
                  disabled={controlsDisabled}
                  onClick={() =>
                    onChange({
                      ...workingHours,
                      ranges: workingHours.ranges.filter(
                        (_, currentIndex) => currentIndex !== index,
                      ),
                    })
                  }
                >
                  <Trash2 />
                </Button>
              )}
            </>
          ) : null}
        </div>
      ))}
    </div>
  );
}

interface CompactTimeInputProps {
  "aria-label": string;
  value: string;
  disabled: boolean;
  onCommit: (minutes: number) => void;
}

function CompactTimeInput({
  "aria-label": ariaLabel,
  value,
  disabled,
  onCommit,
}: CompactTimeInputProps) {
  return (
    <Input
      type="time"
      step={60}
      aria-label={ariaLabel}
      className="w-[6.5rem] px-1.5 tabular-nums [&::-webkit-calendar-picker-indicator]:ml-0 [&::-webkit-calendar-picker-indicator]:p-0 [&::-webkit-datetime-edit]:p-0"
      value={value}
      disabled={disabled}
      onChange={(event) => {
        const minutes = timeValueToMinutes(event.target.value);
        if (minutes !== null) onCommit(minutes);
      }}
    />
  );
}
