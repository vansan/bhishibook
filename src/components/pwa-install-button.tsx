"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
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
  const [showAndroidGuide, setShowAndroidGuide] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);

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
    } else {
      setShowAndroidGuide(true);
    }
  };

  return (
    <>
      <button
        className={cn(
          variant === "primary"
            ? "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[var(--primary)] px-4 py-2 text-sm font-semibold !text-white text-white shadow-xs hover:bg-[var(--primary-strong)]"
            : variant === "banner"
              ? "focus-ring inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-emerald-600 px-2.5 py-1 text-xs font-bold !text-white text-white shadow-xs hover:bg-emerald-700"
              : "focus-ring inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-emerald-300 bg-emerald-50/70 px-3 py-2 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100",
          className
        )}
        onClick={handleInstallClick}
        style={variant === "primary" || variant === "banner" ? { color: "#ffffff" } : undefined}
        type="button"
      >
        <Download className="shrink-0" size={13} />
        <span className="shrink-0">{label}</span>
      </button>

      {showAndroidGuide && mounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowAndroidGuide(false);
              }}
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                    <Smartphone className="text-[var(--primary)]" size={20} />
                    <span>Android वर इन्स्टॉल करा</span>
                  </div>
                  <button
                    aria-label="Close"
                    className="rounded-lg p-1 text-[var(--muted)] hover:bg-slate-100"
                    onClick={() => setShowAndroidGuide(false)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      1
                    </span>
                    <p>
                      Chrome ब्राऊझरच्या वरच्या उजव्या कोपऱ्यातील <strong>३ ठिपक्यांवर (⋮)</strong> टॅप करा.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      2
                    </span>
                    <p>
                      खालील पर्यायांमधून <strong>&ldquo;Install app&rdquo;</strong> किंवा <strong>&ldquo;Add to Home screen&rdquo;</strong> निवडा.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      3
                    </span>
                    <p>आता <strong>BhishiBook</strong> चे ॲप तुमच्या मोबाईलच्या होम स्क्रीनवर तयार होईल!</p>
                  </div>
                </div>
                <button
                  className="mt-5 w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold !text-white text-white shadow-sm"
                  onClick={() => setShowAndroidGuide(false)}
                  style={{ color: "#ffffff" }}
                  type="button"
                >
                  समजले (Got it)
                </button>
              </div>
            </div>,
            document.body
          )
        : null}

      {showIosGuide && mounted
        ? createPortal(
            <div
              aria-modal="true"
              className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 p-4"
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowIosGuide(false);
              }}
              role="dialog"
            >
              <div className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-white p-5 shadow-2xl">
                <div className="flex items-center justify-between border-b border-[var(--line)] pb-3">
                  <div className="flex items-center gap-2 font-bold text-[var(--foreground)]">
                    <Smartphone className="text-[var(--primary)]" size={20} />
                    <span>iPhone / iPad वर इन्स्टॉल करा</span>
                  </div>
                  <button
                    aria-label="Close"
                    className="rounded-lg p-1 text-[var(--muted)] hover:bg-slate-100"
                    onClick={() => setShowIosGuide(false)}
                    type="button"
                  >
                    <X size={18} />
                  </button>
                </div>
                <div className="mt-4 space-y-3 text-sm text-[var(--foreground)]">
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      1
                    </span>
                    <p>
                      Safari मध्ये खालील <strong>Share</strong> बटणावर (
                      <span className="inline-block rounded bg-slate-100 px-1 font-mono">⎋</span>) टॅप करा.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      2
                    </span>
                    <p>
                      खाली स्क्रोल करून <strong>&ldquo;Add to Home Screen&rdquo;</strong> (
                      <span className="inline-block rounded bg-slate-100 px-1 font-mono">⊞</span>) निवडा.
                    </p>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-[var(--primary)]">
                      3
                    </span>
                    <p>आता <strong>BhishiBook</strong> तुमच्या मोबाईलच्या होम स्क्रीनवरून थेट अ‍ॅपप्रमाणे उघडू शकता!</p>
                  </div>
                </div>
                <button
                  className="mt-5 w-full rounded-xl bg-[var(--primary)] py-2.5 text-sm font-semibold !text-white text-white shadow-sm"
                  onClick={() => setShowIosGuide(false)}
                  style={{ color: "#ffffff" }}
                  type="button"
                >
                  समजले (Got it)
                </button>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
