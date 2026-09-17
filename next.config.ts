import type { NextConfig } from "next";

/**
 * next-intl was wired up here but never used by a single component, and its
 * request config returned the wrong message shape. Translation is handled by
 * the typed catalogues in src/messages, selected from the bb_locale cookie in
 * src/lib/i18n.ts, so the plugin has been removed rather than left dead.
 */
const nextConfig: NextConfig = {
  reactStrictMode: true,
};

export default nextConfig;
