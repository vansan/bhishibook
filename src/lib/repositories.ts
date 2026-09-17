import { prisma } from "@/lib/prisma";

export type OverviewStat = {
  label: string;
  value: string;
};

export type PlatformOverview = {
  groupCount: number;
  memberCount: number;
  activeGroupCount: number;
  freeGroupCount: number;
};

export type GroupOverview = {
  groupName: string;
  memberCount: number;
  totalShares: number;
  monthlyCollection: number;
  activeCycleName: string | null;
  contributionDueDay: number | null;
  distributionBase: string | null;
  distributeFines: boolean | null;
};

export async function getPlatformOverview(): Promise<PlatformOverview | null> {
  try {
    const [groupCount, activeGroupCount, freeGroupCount, memberCount] =
      await Promise.all([
        prisma.group.count(),
        prisma.group.count({ where: { status: "ACTIVE" } }),
        prisma.group.count({ where: { planStatus: "FREE" } }),
        prisma.groupMember.count()
      ]);

    return {
      groupCount,
      activeGroupCount,
      freeGroupCount,
      memberCount
    };
  } catch {
    return null;
  }
}

export async function getPrimaryGroupOverview(): Promise<GroupOverview | null> {
  try {
    const group = await prisma.group.findFirst({
      orderBy: { createdAt: "asc" },
      include: {
        cycles: {
          orderBy: { startsOn: "desc" },
          take: 1
        },
        members: {
          where: { status: "ACTIVE" },
          select: {
            shareCount: true,
            monthlyHafta: true
          }
        }
      }
    });

    if (!group) {
      return null;
    }

    const cycle = group.cycles[0] ?? null;
    const totalShares = group.members.reduce(
      (total, member) => total + member.shareCount,
      0
    );
    const monthlyCollection = group.members.reduce(
      (total, member) => total + Number(member.monthlyHafta),
      0
    );

    return {
      groupName: group.name,
      memberCount: group.members.length,
      totalShares,
      monthlyCollection,
      activeCycleName: cycle?.name ?? null,
      contributionDueDay: cycle?.contributionDueDay ?? null,
      distributionBase: cycle?.distributionBase ?? null,
      distributeFines: cycle?.distributeFines ?? null
    };
  } catch {
    return null;
  }
}
