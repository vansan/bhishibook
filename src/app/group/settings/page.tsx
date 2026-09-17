import { CalendarRange, Landmark, ShieldAlert } from "lucide-react";
import { ActionForm, Field, SelectField } from "@/components/ui/action-form";
import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { decimalToPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import {
  createCycleAction,
  updateCycleAction,
  updateFineRuleAction,
  updateGroupSettingsAction,
} from "../actions";

const isoDay = (value: Date) => value.toISOString().slice(0, 10);

function defaultCycleDates() {
  const start = new Date();
  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCFullYear(end.getUTCFullYear() + 1);
  end.setUTCDate(0); // last day of the previous month, a clean 12 month cycle
  return { start: isoDay(start), end: isoDay(end) };
}

export default async function GroupSettingsPage() {
  const scope = await requireGroupAdmin();
  const t = await getMessages();

  const [group, cycle, fineRules] = await Promise.all([
    prisma.group.findUniqueOrThrow({
      where: { id: scope.groupId },
      select: { name: true, defaultLang: true, poweredByEnabled: true },
    }),
    prisma.cycle.findFirst({
      where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
      orderBy: { startsOn: "desc" },
      select: {
        id: true,
        name: true,
        startsOn: true,
        endsOn: true,
        contributionDueDay: true,
        monthlyInterestRate: true,
        maxRepaymentMonths: true,
        maxLoanCorpusMultiple: true,
        distributionBase: true,
        distributeFines: true,
      },
    }),
    prisma.fineRule.findMany({
      where: { groupId: scope.groupId },
      orderBy: { appliesTo: "asc" },
      select: {
        id: true,
        name: true,
        appliesTo: true,
        fixedPerDay: true,
        graceDays: true,
        maxFineDays: true,
        distributeFine: true,
        active: true,
      },
    }),
  ]);

  const defaults = defaultCycleDates();
  const yesNo = [
    { value: "yes", label: t.settings.yes },
    { value: "no", label: t.settings.no },
  ];

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
      <div>
        <h1 className="text-2xl font-bold sm:text-3xl">{t.settings.title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
          {t.settings.subtitle}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <Landmark size={18} />
          {t.settings.branding}
        </h2>
        <ActionForm
          action={updateGroupSettingsAction}
          className="mt-4"
          submitLabel={t.common.save}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field
              defaultValue={group.name}
              hint={t.settings.groupNameHint}
              label={t.superadmin.groupName}
              name="name"
              required
            />
            <SelectField
              defaultValue={group.defaultLang}
              label={t.app.language}
              name="defaultLang"
              options={[
                { value: "en", label: "English" },
                { value: "mr", label: "मराठी" },
              ]}
            />
            <SelectField
              defaultValue={group.poweredByEnabled ? "yes" : "no"}
              label={t.settings.showPoweredBy}
              name="poweredByEnabled"
              options={yesNo}
            />
          </div>
        </ActionForm>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CalendarRange size={18} />
          {cycle ? t.settings.currentCycle : t.settings.startCycle}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          {cycle ? t.settings.cycleHint : t.settings.startCycleHint}
        </p>

        <ActionForm
          action={cycle ? updateCycleAction : createCycleAction}
          className="mt-4"
          hidden={cycle ? { cycleId: cycle.id } : undefined}
          submitLabel={cycle ? t.common.save : t.settings.startCycle}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Field
              defaultValue={cycle?.name ?? `${new Date().getUTCFullYear()} Cycle`}
              label={t.settings.cycleName}
              name="name"
              required
            />
            <Field
              defaultValue={cycle ? isoDay(cycle.startsOn) : defaults.start}
              label={t.settings.startsOn}
              name="startsOn"
              required
              type="date"
            />
            <Field
              defaultValue={cycle ? isoDay(cycle.endsOn) : defaults.end}
              label={t.settings.endsOn}
              name="endsOn"
              required
              type="date"
            />
            <Field
              defaultValue={cycle?.contributionDueDay ?? 10}
              hint={t.settings.dueDayHint}
              label={t.settings.dueDay}
              min="1"
              name="contributionDueDay"
              required
              type="number"
            />
            <Field
              defaultValue={cycle?.monthlyInterestRate.toFixed(2) ?? "3.00"}
              hint={t.settings.interestHint}
              label={t.group.interestRate}
              name="monthlyInterestRate"
              required
            />
            <Field
              defaultValue={cycle?.maxRepaymentMonths ?? 6}
              label={t.group.repaymentWindow}
              min="1"
              name="maxRepaymentMonths"
              required
              type="number"
            />
            <Field
              defaultValue={cycle?.maxLoanCorpusMultiple.toFixed(2) ?? "2.00"}
              hint={t.settings.multipleHint}
              label={t.group.borrowingLimit}
              name="maxLoanCorpusMultiple"
              required
            />
            <SelectField
              defaultValue={cycle?.distributionBase ?? "INTEREST_ONLY"}
              label={t.group.distribution}
              name="distributionBase"
              options={[
                { value: "INTEREST_ONLY", label: t.common.interestOnly },
                { value: "CORPUS_PLUS_INTEREST", label: t.common.corpusPlusInterest },
              ]}
            />
            <SelectField
              defaultValue={cycle ? (cycle.distributeFines ? "yes" : "no") : "yes"}
              label={t.settings.shareFines}
              name="distributeFines"
              options={yesNo}
            />
          </div>
        </ActionForm>
      </div>

      <div className="rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <ShieldAlert size={18} />
          {t.settings.fineRules}
        </h2>
        <p className="mt-1 text-sm text-[var(--muted)]">{t.settings.fineRulesHint}</p>

        <div className="mt-4 space-y-5">
          {fineRules.map((rule) => (
            <div
              className="rounded-md border border-[var(--line)] p-4"
              key={rule.id}
            >
              <h3 className="text-sm font-semibold">
                {rule.appliesTo === "INTEREST"
                  ? t.settings.interestFineRule
                  : t.settings.contributionFineRule}
              </h3>
              <ActionForm
                action={updateFineRuleAction}
                className="mt-3"
                hidden={{ fineRuleId: rule.id }}
                submitLabel={t.common.save}
                variant="secondary"
              >
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                  <Field
                    defaultValue={(decimalToPaise(rule.fixedPerDay) / 100).toFixed(2)}
                    label={t.superadmin.finePerDay}
                    name="fixedPerDay"
                    required
                  />
                  <Field
                    defaultValue={rule.graceDays}
                    hint={t.settings.graceHint}
                    label={t.settings.graceDays}
                    min="0"
                    name="graceDays"
                    required
                    type="number"
                  />
                  <Field
                    defaultValue={rule.maxFineDays}
                    hint={t.settings.capHint}
                    label={t.settings.maxFineDays}
                    min="0"
                    name="maxFineDays"
                    required
                    type="number"
                  />
                  <SelectField
                    defaultValue={rule.distributeFine ? "yes" : "no"}
                    label={t.settings.shareFines}
                    name="distributeFine"
                    options={yesNo}
                  />
                  <SelectField
                    defaultValue={rule.active ? "yes" : "no"}
                    label={t.settings.ruleActive}
                    name="active"
                    options={yesNo}
                  />
                </div>
              </ActionForm>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
