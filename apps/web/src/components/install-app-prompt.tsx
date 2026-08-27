import { Download, Share2, X } from "lucide-react";
import { useEffect, useState } from "react";

import { BRAND } from "@/lib/site";

type InstallChoice = { outcome: "accepted" | "dismissed"; platform: string };

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<InstallChoice>;
};

const DISMISS_KEY = "pgkhata-install-prompt-dismissed";

function isAppleMobile() {
  const { maxTouchPoints, platform, userAgent } = window.navigator;
  return /iPad|iPhone|iPod/.test(userAgent) || (platform === "MacIntel" && maxTouchPoints > 1);
}

function isStandalone() {
  const standaloneNavigator = window.navigator as Navigator & { standalone?: boolean };
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    standaloneNavigator.standalone === true
  );
}

/** A mobile-only, browser-native path to install the owner app. */
export function InstallAppPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent>();
  const [appleMobile, setAppleMobile] = useState(false);
  const [standalone, setStandalone] = useState(true);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setAppleMobile(isAppleMobile());
    setStandalone(isStandalone());
    setDismissed(window.sessionStorage.getItem(DISMISS_KEY) === "true");

    const media = window.matchMedia("(display-mode: standalone)");
    const updateStandaloneState = () => setStandalone(isStandalone());
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDeferredPrompt(undefined);
      setStandalone(true);
    };

    media.addEventListener("change", updateStandaloneState);
    window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
    window.addEventListener("appinstalled", onInstalled);

    return () => {
      media.removeEventListener("change", updateStandaloneState);
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    window.sessionStorage.setItem(DISMISS_KEY, "true");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferredPrompt) return;

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    setDeferredPrompt(undefined);
    if (choice.outcome === "accepted") setStandalone(true);
  };

  const showPrompt = !standalone && !dismissed && (appleMobile || Boolean(deferredPrompt));
  if (!showPrompt) return null;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-3 z-50 px-3 md:hidden">
      <section
        aria-label={`Install ${BRAND} as an app`}
        className="pointer-events-auto mx-auto flex max-w-md items-start gap-3 rounded-2xl border border-border bg-card p-3.5 shadow-xl"
      >
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
          {appleMobile ? (
            <Share2 className="size-4" aria-hidden="true" />
          ) : (
            <Download className="size-4" aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">Install {BRAND}</p>
          {appleMobile ? (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              In Safari, tap Share, then choose{" "}
              <span className="font-medium text-foreground">Add to Home Screen</span>.
            </p>
          ) : (
            <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
              Open {BRAND} like an app with a faster, full-screen workspace.
            </p>
          )}
          {!appleMobile ? (
            <button
              type="button"
              className="mt-2 inline-flex h-8 items-center rounded-lg bg-primary px-3 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              onClick={() => void install()}
            >
              Install app
            </button>
          ) : null}
        </div>
        <button
          type="button"
          className="-mr-1 -mt-1 inline-flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={dismiss}
          aria-label="Dismiss install app prompt"
        >
          <X className="size-4" aria-hidden="true" />
        </button>
      </section>
    </div>
  );
}
