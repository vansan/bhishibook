import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

function getCleanDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) return undefined;
  let url = raw.trim();
  if ((url.startsWith('"') && url.endsWith('"')) || (url.startsWith("'") && url.endsWith("'"))) {
    url = url.slice(1, -1).trim();
  }
  // Remove channel_binding=require if present as it causes connection timeouts with pgbouncer/Prisma
  url = url
    .replace(/&channel_binding=require/g, "")
    .replace(/\?channel_binding=require&/g, "?")
    .replace(/\?channel_binding=require$/g, "");

  // Ensure connection and pool timeouts are generous (30s) so Neon cold-start wakeups never error
  if (!url.includes("connect_timeout=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}connect_timeout=30`;
  }
  if (!url.includes("pool_timeout=")) {
    const separator = url.includes("?") ? "&" : "?";
    url = `${url}${separator}pool_timeout=30`;
  }

  return url;
}

const cleanUrl = getCleanDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: cleanUrl ? { db: { url: cleanUrl } } : undefined,
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

