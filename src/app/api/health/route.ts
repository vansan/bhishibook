import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const dbUrlRaw = process.env.DATABASE_URL;
  const dbUrlSet = Boolean(dbUrlRaw);
  const secretSet = Boolean(process.env.SESSION_SECRET);

  let host = "not-configured";
  if (dbUrlRaw) {
    try {
      const parsed = new URL(dbUrlRaw.replace(/^.*@/, "https://"));
      host = parsed.host;
    } catch {
      host = "configured-but-unparseable";
    }
  }

  let dbStatus = "unknown";
  let memberCount = 0;
  let userCount = 0;
  let errorDetail: string | null = null;

  try {
    const [members, users] = await Promise.all([
      prisma.groupMember.count(),
      prisma.user.count(),
    ]);
    dbStatus = "connected";
    memberCount = members;
    userCount = users;
  } catch (err: unknown) {
    dbStatus = "error";
    errorDetail = err instanceof Error ? err.message : String(err);
  }

  return NextResponse.json({
    status: dbStatus === "connected" ? "ok" : "error",
    database: {
      status: dbStatus,
      targetHost: host,
      error: errorDetail,
    },
    counts: {
      members: memberCount,
      users: userCount,
    },
    env: {
      DATABASE_URL_CONFIGURED: dbUrlSet,
      SESSION_SECRET_CONFIGURED: secretSet,
      NODE_ENV: process.env.NODE_ENV,
    },
  });
}
