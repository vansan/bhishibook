import type { Metadata, Viewport } from "next";
import { PwaRegister } from "@/components/pwa-register";
import { getLocale } from "@/lib/i18n";
import "./globals.css";

export const metadata: Metadata = {
  title: "BhishiBook",
  description: "Multi-group bhishi management SaaS",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "BhishiBook",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#166534",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Follows the language toggle, so screen readers and browser translation see
  // the language actually on the page rather than always English.
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body>
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
