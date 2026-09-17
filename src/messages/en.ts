export const en = {
  app: {
    poweredBy: "Powered by BhishiBook",
    freeSoftware: "Currently free software for all groups",
    language: "Language",
  },
  nav: {
    superadmin: "Superadmin",
    group: "Group Admin",
    member: "Member",
    login: "Login",
    logout: "Logout",
  },
  login: {
    title: "Sign in to BhishiBook",
    subtitle: "Use the email and password your group admin gave you.",
    email: "Email",
    password: "Password",
    submit: "Sign in",
    submitting: "Signing in...",
  },
  denied: {
    title: "You do not have access to this page",
    subtitle:
      "This area belongs to a different role or a different group. If you think this is wrong, ask your group admin.",
    backHome: "Back to my dashboard",
  },
  common: {
    perMonth: "per month",
    shares: "shares",
    active: "active",
    collected: "collected",
    months: "months",
    interestOnly: "Interest only",
    corpusPlusInterest: "Corpus plus interest",
    sharedWithMembers: "Shared with members",
    keptInCorpus: "Kept in corpus",
  },
  superadmin: {
    title: "BhishiBook Superadmin",
    subtitle: "Manage groups, platform settings, languages, and SaaS access.",
    groups: "Groups",
    activeGroups: "Active groups",
    members: "Members",
    corpusManaged: "Corpus managed",
    onFreePlan: "on the free plan",
    haftaAcrossGroups: "Hafta collected across all groups",
  },
  group: {
    title: "Group workspace",
    subtitle:
      "Your classmates bhishi workspace. Contributions, loans, fines, receipts, and reports live here.",
    members: "Members",
    expectedThisMonth: "Expected this month",
    outOnLoan: "Out on loan",
    haftaWindow: "Hafta window",
    fineFromThe: "Fine from day",
    cycleRules: "Cycle rules",
    interestRate: "Interest rate",
    perMonthRate: "per month",
    repaymentWindow: "Repayment window",
    borrowingLimit: "Borrowing limit",
    ofCorpusContributed: "of corpus contributed",
    distribution: "Distribution",
    fines: "Fines",
    availableToLend: "Available to lend",
    noCycle: "No cycle has been started for this group yet.",
  },
  member: {
    title: "My Passbook",
    subtitle: "Your hafta, loans, interest dues, receipts, and final distribution.",
    myShares: "My shares",
    paidInSoFar: "Paid in so far",
    totalDues: "Total dues",
    nothingOutstanding: "Nothing outstanding",
    receipts: "Receipts",
    myLoans: "My loans",
    outstandingPrincipal: "Outstanding principal",
    activeLoans: "Active loans",
    interestOutstanding: "Interest outstanding",
    canStillBorrow: "I can still borrow",
    hafta: "Hafta",
    interest: "Interest",
    fines: "Fines",
  },
};

/**
 * Every other locale is typed against this one, so adding a key here and
 * forgetting to translate it is a compile error rather than a missing string
 * in front of a member.
 *
 * Deliberately not `as const`: that would pin each value to its exact English
 * literal and make every translation a type error.
 */
export type Messages = typeof en;
