"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
  prompt(): Promise<void>;
}

function subscribeStandalone(callback: () => void) {
  if (typeof window === "undefined") return () => {};
  const mql = window.matchMedia("(display-mode: standalone)");
  mql.addEventListener("change", callback);
  return () => mql.removeEventListener("change", callback);
}

function getStandaloneSnapshot() {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

function getStandaloneServerSnapshot() {
  return false;
}

function subscribeIos() {
  return () => {};
}

function getIosSnapshot() {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/.test(window.navigator.userAgent.toLowerCase());
}

function getIosServerSnapshot() {
  return false;
}

export function PwaInstallButton({
  label = "अ‍ॅप इन्स्टॉल करा",
  className,
  variant = "ghost",
}: {
  label?: string;
  className?: string;
  variant?: "ghost" | "primary" | "banner";
}) {
  const isStandalone = useSyncExternalStore(
    subscribeStandalone,
    getStandaloneSnapshot,
    getStandaloneServerSnapshot
  );
  const isIos = useSyncExternalStore(subscribeIos, getIosSnapshot, getIosServerSnapshot);
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setInstalled(true);
      setPromptEvent(null);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, []);

  if (isStandalone || installed) return null;
  // If not iOS and no install prompt caught, still show install button if mobile browser
  if (!promptEvent && !isIos) return null;

  const handleInstallClick = async () => {
    if (promptEvent) {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      if (choice.outcome === "accepted") {
        setInstalled(true);
      }
      setPromptEvent(null);
    } else if (isIos) {
      setShowIosGuide(true);
    }
  };

  return (
    <>
      <button
        className={cn(
          variant === "primary"
            ? "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white shadow-xs hover:bg-[var(--primary-strong)]"
            : variant === "banner"
              ? "focus-ring inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
              : "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100",
          className
        )}
        onClick={handleInstallClick}
        type="button"
      >
        <Download size={15} />
        <span>{label}</span>
      </button>

      {showIosGuide ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 backdrop-blur-xs sm:items-center">
          <div className="w-full max-w-sm rounded-xl border border-[var(--line)] bg-white p-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
              <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                <Smartphone className="text-[var(--primary)]" size={20} />
                <span>iPhone / iPad वर इन्स्टॉल करा</span>
              </div>
              <button
                className="rounded p-1 text-[var(--muted)] hover:bg-slate-100"
                onClick={() => setShowIosGuide(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>
            <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
              <p>
                1. Safari मध्ये खालील <strong>Share</strong> बटणावर (
                <span className="inline-block rounded bg-slate-100 px-1 font-mono">⎋</span>) टॅप करा.
              </p>
              <p>
                2. खाली स्क्रोल करून <strong>&ldquo;Add to Home Screen&rdquo;</strong> (
                <span className="inline-block rounded bg-slate-100 px-1 font-mono">⊞</span>) निवडा.
              </p>
              <p>3. आता BhishiBook तुमच्या मोबाईलच्या होम स्क्रीनवरून थेट अ‍ॅपप्रमाणे उघडू शकता!</p>
            </div>
            <button
              className="mt-5 w-full rounded-md bg-[var(--primary)] py-2 text-sm font-semibold text-white"
              onClick={() => setShowIosGuide(false)}
              type="button"
            >
              समजले (Got it)
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}
