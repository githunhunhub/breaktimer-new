import { Plus, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import type {
  Settings,
  WorkingHours,
  WorkingHoursRange,
} from "@/types/settings";

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

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Working Hours</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="working-hours-enabled">
            Restrict breaks to working hours
          </Label>
          <Switch
            id="working-hours-enabled"
            checked={settings.workingHoursEnabled}
            onCheckedChange={(checked) =>
              onPatch({ workingHoursEnabled: checked })
            }
          />
        </div>
        <div className="flex flex-col gap-4">
          {WORKING_HOURS_DAYS.map((day) => (
            <DayRow
              key={day.key}
              day={day}
              workingHours={settings[day.key]}
              disabled={!settings.workingHoursEnabled}
              onChange={(value) => updateDay(day.key, value)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

interface DayRowProps {
  day: WorkingHoursDay;
  workingHours: WorkingHours;
  disabled: boolean;
  onChange: (workingHours: WorkingHours) => void;
}

function DayRow({ day, workingHours, disabled, onChange }: DayRowProps) {
  const controlsDisabled = disabled || !workingHours.enabled;

  function replaceRange(index: number, range: WorkingHoursRange) {
    onChange({
      ...workingHours,
      ranges: workingHours.ranges.map((current, currentIndex) =>
        currentIndex === index ? range : current,
      ),
    });
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-3">
        <Switch
          aria-label={day.label}
          checked={workingHours.enabled}
          disabled={disabled}
          onCheckedChange={(checked) =>
            onChange({ ...workingHours, enabled: checked })
          }
        />
        <span className="text-sm font-medium">{day.label}</span>
      </div>
      {workingHours.enabled && (
        <div className="flex flex-col gap-2 pl-12">
          {workingHours.ranges.map((range, index) => (
            <div key={index} className="flex items-center gap-2">
              <Input
                type="time"
                aria-label={`${day.label} start ${index + 1}`}
                className="w-32"
                value={minutesToTimeValue(range.fromMinutes)}
                disabled={controlsDisabled}
                onChange={(event) => {
                  const minutes = timeValueToMinutes(event.target.value);
                  if (minutes !== null) {
                    replaceRange(index, updateRangeStart(range, minutes));
                  }
                }}
              />
              <span aria-hidden className="text-muted-foreground text-sm">
                to
              </span>
              <Input
                type="time"
                aria-label={`${day.label} end ${index + 1}`}
                className="w-32"
                value={minutesToTimeValue(range.toMinutes)}
                disabled={controlsDisabled}
                onChange={(event) => {
                  const minutes = timeValueToMinutes(event.target.value);
                  if (minutes !== null) {
                    replaceRange(index, updateRangeEnd(range, minutes));
                  }
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${day.label} range ${index + 1}`}
                disabled={controlsDisabled || workingHours.ranges.length <= 1}
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
            </div>
          ))}
          <div>
            <Button
              type="button"
              variant="outline"
              size="sm"
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
              Add range
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
