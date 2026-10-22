import type { CSSProperties, ReactNode } from "react";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";

interface SettingsCardToggle {
  label: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}

interface SettingsCardProps {
  title: string;
  helperText?: string;
  children?: ReactNode;
  toggle?: SettingsCardToggle;
  style?: CSSProperties;
}

/** Shared settings group frame matching the legacy header-toggle layout (SPEC-0010). */
export function SettingsCard({
  title,
  helperText,
  children,
  toggle,
  style,
}: SettingsCardProps) {
  return (
    <Card data-settings-group={title} style={style}>
      <CardHeader className="flex-row items-center justify-between gap-4">
        <CardTitle className="text-base">{title}</CardTitle>
        {toggle && (
          <Switch
            aria-label={toggle.label}
            checked={toggle.checked}
            disabled={toggle.disabled}
            onCheckedChange={toggle.onCheckedChange}
          />
        )}
      </CardHeader>
      {helperText && (
        <CardDescription className="px-6">{helperText}</CardDescription>
      )}
      {children && <CardContent>{children}</CardContent>}
    </Card>
  );
}
