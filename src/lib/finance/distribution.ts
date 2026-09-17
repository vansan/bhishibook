import { atLeastZero, sumPaise, type Paise } from "@/lib/money";

/**
 * End-of-cycle distribution.
 *
 * Agreed rules:
 *   - Everyone shares, borrowers included.
 *   - Split is by shares: 1,000/month is 1 share, 2,000/month is 2 shares.
 *   - Configurable base: interest only, or corpus plus interest.
 *   - Fines are included in the distributable pool by default, but a group can
 *     choose to leave them in the corpus instead.
 */

export type DistributionBase = "INTEREST_ONLY" | "CORPUS_PLUS_INTEREST";

export type DistributionSettings = {
  base: DistributionBase;
  /** When false, collected fines stay in the corpus instead of being shared. */
  distributeFines: boolean;
};

export type DistributionMember = {
  memberId: string;
  displayName: string;
  shareCount: number;
  /** Hafta the member actually paid in over the cycle. */
  corpusContributedPaise: Paise;
  /** Anything still owed, netted off the payout. */
  outstandingDuesPaise: Paise;
  /** Excluded from the payout but still counted for share maths. */
  excludeFromPayout?: boolean;
};

export type DistributionPools = {
  interestCollectedPaise: Paise;
  finesCollectedPaise: Paise;
};

export type MemberSettlement = {
  memberId: string;
  displayName: string;
  shareCount: number;
  corpusContributedPaise: Paise;
  interestSharePaise: Paise;
  fineSharePaise: Paise;
  corpusReturnedPaise: Paise;
  deductionsPaise: Paise;
  payoutPaise: Paise;
};

export type DistributionResult = {
  totalShares: number;
  distributablePaise: Paise;
  retainedInCorpusPaise: Paise;
  settlements: MemberSettlement[];
  totalPayoutPaise: Paise;
};

/**
 * Split a pool across members by share count without losing or inventing a
 * single paise.
 *
 * Plain rounding does not add back up: three equal shares of 100 paise would
 * each round to 33 and quietly lose 1. This uses the largest-remainder method,
 * handing the leftover paise to the members with the biggest fractional claim,
 * so the parts always sum to exactly the pool.
 *
 * Ties break on share count, then member id, so the same input always produces
 * the same output and a re-run of the cycle close cannot shuffle money around.
 */
export function splitByShares(
  poolPaise: Paise,
  members: Array<{ memberId: string; shareCount: number }>
): Map<string, Paise> {
  const result = new Map<string, Paise>();
  const totalShares = members.reduce((total, m) => total + Math.max(m.shareCount, 0), 0);

  if (totalShares <= 0 || poolPaise <= 0) {
    for (const member of members) result.set(member.memberId, 0);
    return result;
  }

  const remainders: Array<{ memberId: string; remainder: number; shareCount: number }> = [];
  let allocated = 0;

  for (const member of members) {
    const shares = Math.max(member.shareCount, 0);
    const exact = poolPaise * shares;
    const base = Math.floor(exact / totalShares);
    result.set(member.memberId, base);
    allocated += base;
    remainders.push({
      memberId: member.memberId,
      remainder: exact % totalShares,
      shareCount: shares,
    });
  }

  let leftover = poolPaise - allocated;
  remainders.sort(
    (a, b) =>
      b.remainder - a.remainder ||
      b.shareCount - a.shareCount ||
      a.memberId.localeCompare(b.memberId)
  );

  for (let index = 0; leftover > 0 && index < remainders.length; index += 1) {
    const entry = remainders[index];
    result.set(entry.memberId, (result.get(entry.memberId) ?? 0) + 1);
    leftover -= 1;
  }

  return result;
}

/** Build the full per-member settlement for a cycle close. */
export function buildDistribution(
  members: DistributionMember[],
  pools: DistributionPools,
  settings: DistributionSettings
): DistributionResult {
  const totalShares = members.reduce((total, m) => total + Math.max(m.shareCount, 0), 0);

  const sharedFinesPaise = settings.distributeFines ? atLeastZero(pools.finesCollectedPaise) : 0;
  const retainedInCorpusPaise = atLeastZero(pools.finesCollectedPaise) - sharedFinesPaise;
  const interestPoolPaise = atLeastZero(pools.interestCollectedPaise);

  const interestShares = splitByShares(interestPoolPaise, members);
  const fineShares = splitByShares(sharedFinesPaise, members);

  const settlements: MemberSettlement[] = members.map((member) => {
    const interestSharePaise = interestShares.get(member.memberId) ?? 0;
    const fineSharePaise = fineShares.get(member.memberId) ?? 0;
    const corpusReturnedPaise =
      settings.base === "CORPUS_PLUS_INTEREST" ? member.corpusContributedPaise : 0;

    const gross = interestSharePaise + fineSharePaise + corpusReturnedPaise;
    // Outstanding dues are netted off, but never turn a payout negative: a
    // member who owes more than their share settles the rest separately.
    const deductionsPaise = Math.min(atLeastZero(member.outstandingDuesPaise), gross);
    const payoutPaise = member.excludeFromPayout ? 0 : gross - deductionsPaise;

    return {
      memberId: member.memberId,
      displayName: member.displayName,
      shareCount: member.shareCount,
      corpusContributedPaise: member.corpusContributedPaise,
      interestSharePaise,
      fineSharePaise,
      corpusReturnedPaise,
      deductionsPaise,
      payoutPaise,
    };
  });

  return {
    totalShares,
    distributablePaise: interestPoolPaise + sharedFinesPaise,
    retainedInCorpusPaise,
    settlements,
    totalPayoutPaise: sumPaise(settlements.map((s) => s.payoutPaise)),
  };
}
