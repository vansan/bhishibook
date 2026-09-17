"use client";

import { useEffect } from "react";

/**
 * Registers the service worker so BhishiBook can be installed on a phone.
 *
 * Only in production: in development the worker would sit in front of the dev
 * server's assets and serve stale bundles after every edit.
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // An unavailable service worker must never break the app; the site
        // works perfectly well without one.
      });
    };

    if (document.readyState === "complete") register();
    else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}
