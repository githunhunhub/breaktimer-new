import { Loader2, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/lib/i18n";
import { type AppInfo } from "@/lib/ipc";
import type { Settings } from "@/types/settings";
import type { UpdateCheckResult, UpdateLinkKind } from "@/types/updates";

import type { SettingsClient } from "./settings-window";
import { SettingsCard } from "./settings-card";

interface UpdatesCardProps {
  settings: Settings;
  onPatch: (patch: Partial<Settings>) => void;
  client: SettingsClient;
}

/** Update check card (SPEC-0017). */
export function UpdatesCard({ settings, onPatch, client }: UpdatesCardProps) {
  const { locale, t } = useI18n();
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);
  const [result, setResult] = useState<UpdateCheckResult | null>(null);
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    let unlisten: (() => void) | undefined;

    client
      .getAppInfo?.()
      ?.then((info) => {
        if (active) setAppInfo(info);
      })
      .catch(() => {});

    client
      .getUpdateStatus?.()
      ?.then((status) => {
        if (active && status) setResult(status);
      })
      .catch(() => {});

    const statusListener = client.onUpdateStatus?.((next) => {
      if (active) setResult(next);
    });
    statusListener
      ?.then((stopListening) => {
        if (active) {
          unlisten = stopListening;
        } else {
          stopListening();
        }
      })
      .catch(() => {});

    return () => {
      active = false;
      unlisten?.();
    };
  }, [client]);

  async function handleCheck() {
    if (checking || !client.checkForUpdate) return;

    setChecking(true);
    setError(null);
    try {
      setResult(await client.checkForUpdate());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setChecking(false);
    }
  }

  function openLink(kind: UpdateLinkKind) {
    client.openUpdateLink?.(kind).catch((cause: unknown) => {
      setError(cause instanceof Error ? cause.message : String(cause));
    });
  }

  const currentVersion = appInfo?.version ?? result?.currentVersion ?? "—";
  const available = result?.status === "available" ? result : null;
  const downloads = available?.downloads;
  const published = formatPublished(available?.publishedAt ?? null, locale);
  const statusText = checking
    ? t("settings.updates.checking")
    : statusMessage(result, t);

  return (
    <SettingsCard title={t("settings.updates.title")}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="check-for-updates">
              {t("settings.updates.autoCheck")}
            </Label>
            <span className="text-muted-foreground text-xs">
              {t("settings.updates.autoCheckHint")}
            </span>
          </div>
          <Switch
            id="check-for-updates"
            checked={settings.checkForUpdates}
            onCheckedChange={(checked) => onPatch({ checkForUpdates: checked })}
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <span className="text-muted-foreground text-sm">
            {t("settings.updates.currentVersion", {
              version: currentVersion,
            })}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={handleCheck}
            disabled={checking || !client.checkForUpdate}
          >
            {checking ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <RefreshCw className="size-4" />
            )}
            {checking
              ? t("settings.updates.checking")
              : t("settings.updates.check")}
          </Button>
        </div>

        <div aria-live="polite" className="text-sm">
          <p
            className={
              result?.status === "unavailable" || error
                ? "text-destructive"
                : undefined
            }
          >
            {error
              ? `${t("settings.updates.unavailable")} ${error}`
              : statusText}
          </p>
          {available && published && (
            <p className="text-muted-foreground mt-1 text-xs">
              {t("settings.updates.publishedAt", { date: published })}
            </p>
          )}
        </div>

        {available && downloads && (
          <div className="flex flex-col gap-2">
            <p className="text-sm font-medium">
              {t("settings.updates.downloadsTitle")}
            </p>
            <div className="flex flex-wrap gap-2">
              {downloads.baidu && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLink("baidu")}
                >
                  {t("settings.updates.baidu")}
                </Button>
              )}
              {downloads.quark && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openLink("quark")}
                >
                  {t("settings.updates.quark")}
                </Button>
              )}
            </div>
            {!downloads.baidu && !downloads.quark && (
              <p className="text-muted-foreground text-xs">
                {t("settings.updates.downloadsUnavailable")}
              </p>
            )}
            {downloads.baiduCode && (
              <p className="text-muted-foreground text-xs">
                {t("settings.updates.baiduCode", {
                  code: downloads.baiduCode,
                })}
              </p>
            )}
          </div>
        )}

        {available && appInfo && (
          <div className="rounded-md border border-dashed p-3 text-sm">
            <p className="font-medium">
              {appInfo?.portable
                ? t("settings.updates.portableTitle")
                : t("settings.updates.installedTitle")}
            </p>
            {appInfo?.portable ? (
              <ol className="text-muted-foreground mt-2 list-decimal space-y-1 pl-5 text-xs">
                <li>{t("settings.updates.portableStep1")}</li>
                <li>{t("settings.updates.portableStep2")}</li>
                <li>{t("settings.updates.portableStep3")}</li>
                <li>{t("settings.updates.portableStep4")}</li>
                <li>{t("settings.updates.portableStep5")}</li>
              </ol>
            ) : (
              <p className="text-muted-foreground mt-2 text-xs">
                {t("settings.updates.installedHint")}
              </p>
            )}
          </div>
        )}
      </div>
    </SettingsCard>
  );
}

function statusMessage(
  result: UpdateCheckResult | null,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (!result) return "";

  switch (result.status) {
    case "upToDate":
      return t("settings.updates.upToDate");
    case "available":
      return t("settings.updates.available", {
        version: result.latestVersion ?? "",
      });
    case "noRelease":
      return t("settings.updates.noRelease");
    case "unavailable": {
      const key = result.error ?? "network";
      return `${t("settings.updates.unavailable")} ${t(
        `settings.updates.errors.${key}`,
      )}`;
    }
  }
}

function formatPublished(value: string | null, locale: string): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString(locale);
}
