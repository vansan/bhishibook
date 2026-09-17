import {
  Banknote,
  Building2,
  CircleDollarSign,
  Clock3,
  Languages,
  ReceiptText,
  ShieldCheck,
  Users
} from "lucide-react";

export const platform = {
  name: "BhishiBook",
  freeModeLabel: "Free for all groups",
  defaultGroupName: "MaitriNidhi"
};

export const demoStats = {
  platform: [
    { label: "Groups", value: "1", icon: Building2 },
    { label: "Members", value: "33", icon: Users },
    { label: "Corpus", value: "₹35,000", icon: Banknote },
    { label: "Languages", value: "EN / MR", icon: Languages }
  ],
  group: [
    { label: "This month", value: "₹35,000", icon: Banknote },
    { label: "Active loans", value: "0", icon: CircleDollarSign },
    { label: "Receipts", value: "Ready", icon: ReceiptText },
    { label: "Due window", value: "1-10", icon: Clock3 }
  ],
  member: [
    { label: "My shares", value: "1", icon: ShieldCheck },
    { label: "Hafta due", value: "₹1,000", icon: Banknote },
    { label: "Loans", value: "None", icon: CircleDollarSign },
    { label: "Receipts", value: "0", icon: ReceiptText }
  ]
};

export const roadmap = [
  "SaaS foundation with superadmin, group admin, and member roles",
  "Group branding with custom group name and Powered by BhishiBook footer",
  "English and Marathi language foundation",
  "Member, cycle, contribution, loan, fine, receipt, ledger, and audit data model",
  "Next phase: working contribution, fine, loan, and ledger screens"
];
