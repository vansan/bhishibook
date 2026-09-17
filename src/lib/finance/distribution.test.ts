import { describe, expect, it } from "vitest";
import { rupeesToPaise, sumPaise } from "@/lib/money";
import { buildDistribution, splitByShares, type DistributionMember } from "./distribution";

describe("splitByShares", () => {
  it("splits evenly when it divides cleanly", () => {
    const result = splitByShares(rupeesToPaise("3000"), [
      { memberId: "a", shareCount: 1 },
      { memberId: "b", shareCount: 1 },
      { memberId: "c", shareCount: 1 },
    ]);
    expect(result.get("a")).toBe(rupeesToPaise("1000"));
    expect(result.get("c")).toBe(rupeesToPaise("1000"));
  });

  it("gives a 2-share member twice a 1-share member", () => {
    const result = splitByShares(rupeesToPaise("4000"), [
      { memberId: "a", shareCount: 1 },
      { memberId: "b", shareCount: 1 },
      { memberId: "c", shareCount: 2 },
    ]);
    expect(result.get("a")).toBe(rupeesToPaise("1000"));
    expect(result.get("c")).toBe(rupeesToPaise("2000"));
  });

  it("never loses a paise to rounding", () => {
    // 100 paise across 3 shares cannot divide evenly.
    const result = splitByShares(100, [
      { memberId: "a", shareCount: 1 },
      { memberId: "b", shareCount: 1 },
      { memberId: "c", shareCount: 1 },
    ]);
    expect(sumPaise([...result.values()])).toBe(100);
    expect([...result.values()].sort()).toEqual([33, 33, 34]);
  });

  it("adds back up across the real 35-share group", () => {
    // 33 members: 31 on one share, 2 on two shares.
    const members = Array.from({ length: 33 }, (_, index) => ({
      memberId: `m${String(index).padStart(2, "0")}`,
      shareCount: index >= 31 ? 2 : 1,
    }));
    for (const pool of [1, 99, 12_345, rupeesToPaise("41234.57")]) {
      const result = splitByShares(pool, members);
      expect(sumPaise([...result.values()])).toBe(pool);
    }
  });

  it("is deterministic across runs", () => {
    const members = [
      { memberId: "b", shareCount: 1 },
      { memberId: "a", shareCount: 1 },
      { memberId: "c", shareCount: 1 },
    ];
    const first = splitByShares(100, members);
    const second = splitByShares(100, members);
    expect([...first.entries()]).toEqual([...second.entries()]);
  });

  it("handles an empty pool and a group with no shares", () => {
    expect(splitByShares(0, [{ memberId: "a", shareCount: 1 }]).get("a")).toBe(0);
    expect(splitByShares(100, [{ memberId: "a", shareCount: 0 }]).get("a")).toBe(0);
  });
});

describe("buildDistribution", () => {
  const members: DistributionMember[] = [
    {
      memberId: "a",
      displayName: "Amit",
      shareCount: 1,
      corpusContributedPaise: rupeesToPaise("12000"),
      outstandingDuesPaise: 0,
    },
    {
      memberId: "b",
      displayName: "Sanjay",
      shareCount: 2,
      corpusContributedPaise: rupeesToPaise("24000"),
      outstandingDuesPaise: 0,
    },
  ];

  const pools = {
    interestCollectedPaise: rupeesToPaise("3000"),
    finesCollectedPaise: rupeesToPaise("600"),
  };

  it("shares interest only, by shares, when that is the base", () => {
    const result = buildDistribution(members, pools, {
      base: "INTEREST_ONLY",
      distributeFines: true,
    });
    expect(result.totalShares).toBe(3);
    // ₹3,600 across 3 shares: ₹1,200 and ₹2,400.
    expect(result.settlements[0].payoutPaise).toBe(rupeesToPaise("1200"));
    expect(result.settlements[1].payoutPaise).toBe(rupeesToPaise("2400"));
    expect(result.settlements[0].corpusReturnedPaise).toBe(0);
  });

  it("returns the corpus too when the group chooses that base", () => {
    const result = buildDistribution(members, pools, {
      base: "CORPUS_PLUS_INTEREST",
      distributeFines: true,
    });
    expect(result.settlements[0].payoutPaise).toBe(rupeesToPaise("13200"));
    expect(result.settlements[1].payoutPaise).toBe(rupeesToPaise("26400"));
  });

  it("keeps fines in the corpus when fine sharing is switched off", () => {
    const result = buildDistribution(members, pools, {
      base: "INTEREST_ONLY",
      distributeFines: false,
    });
    expect(result.retainedInCorpusPaise).toBe(rupeesToPaise("600"));
    expect(result.distributablePaise).toBe(rupeesToPaise("3000"));
    expect(result.settlements[0].fineSharePaise).toBe(0);
    expect(result.settlements[0].payoutPaise).toBe(rupeesToPaise("1000"));
  });

  it("nets outstanding dues off the payout", () => {
    const withDues = [
      { ...members[0], outstandingDuesPaise: rupeesToPaise("200") },
      members[1],
    ];
    const result = buildDistribution(withDues, pools, {
      base: "INTEREST_ONLY",
      distributeFines: true,
    });
    expect(result.settlements[0].deductionsPaise).toBe(rupeesToPaise("200"));
    expect(result.settlements[0].payoutPaise).toBe(rupeesToPaise("1000"));
  });

  it("never turns a payout negative when dues exceed the share", () => {
    const deepInDebt = [
      { ...members[0], outstandingDuesPaise: rupeesToPaise("99999") },
      members[1],
    ];
    const result = buildDistribution(deepInDebt, pools, {
      base: "INTEREST_ONLY",
      distributeFines: true,
    });
    expect(result.settlements[0].payoutPaise).toBe(0);
    expect(result.settlements[0].deductionsPaise).toBe(rupeesToPaise("1200"));
  });

  it("gives a borrower their full share, same as everyone else", () => {
    // Borrowers are explicitly included in the distribution.
    const result = buildDistribution(members, pools, {
      base: "INTEREST_ONLY",
      distributeFines: true,
    });
    expect(result.settlements.every((s) => s.payoutPaise > 0)).toBe(true);
  });

  it("excludes a member the group voted to pay nothing, without shifting shares", () => {
    const withDefaulter = [{ ...members[0], excludeFromPayout: true }, members[1]];
    const result = buildDistribution(withDefaulter, pools, {
      base: "INTEREST_ONLY",
      distributeFines: true,
    });
    expect(result.settlements[0].payoutPaise).toBe(0);
    // The other member's share is unchanged: the excluded amount stays in the
    // corpus for the group to decide on, rather than silently inflating others.
    expect(result.settlements[1].payoutPaise).toBe(rupeesToPaise("2400"));
  });

  it("handles a cycle where nothing was earned", () => {
    const result = buildDistribution(
      members,
      { interestCollectedPaise: 0, finesCollectedPaise: 0 },
      { base: "INTEREST_ONLY", distributeFines: true }
    );
    expect(result.totalPayoutPaise).toBe(0);
  });
});
