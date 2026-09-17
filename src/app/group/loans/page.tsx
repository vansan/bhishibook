import { CircleDollarSign, TrendingUp } from "lucide-react";
import { ActionForm, Field, SelectField } from "@/components/ui/action-form";
import { requireGroupAdmin } from "@/lib/auth";
import { getMessages } from "@/lib/i18n";
import { atLeastZero, decimalToPaise, formatPaise, sumPaise } from "@/lib/money";
import { prisma } from "@/lib/prisma";
import { createLoanAction, generateInterestAction } from "../actions";
import { LoanRow } from "./loan-row";

const today = () => new Date().toISOString().slice(0, 10);

export default async function LoansPage() {
  const scope = await requireGroupAdmin();
  const t = await getMessages();

  const cycle = await prisma.cycle.findFirst({
    where: { groupId: scope.groupId, status: { in: ["ACTIVE", "DRAFT", "CLOSING"] } },
    orderBy: { startsOn: "desc" },
    select: { id: true, maxLoanCorpusMultiple: true, monthlyInterestRate: true },
  });

  if (!cycle) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.loans.title}</h1>
        <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          {t.group.noCycle}
        </p>
      </section>
    );
  }

  const [members, loans] = await Promise.all([
    prisma.groupMember.findMany({
      where: { groupId: scope.groupId, status: "ACTIVE" },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        contributions: { select: { amountPaid: true } },
      },
    }),
    prisma.loan.findMany({
      where: { cycleId: cycle.id },
      orderBy: [{ status: "asc" }, { disbursedOn: "desc" }],
      select: {
        id: true,
        principal: true,
        disbursedOn: true,
        dueOn: true,
        status: true,
        interestRate: true,
        member: { select: { displayName: true } },
        repayments: { select: { principalAmount: true } },
        interestDues: { select: { amountDue: true, amountPaid: true } },
        fines: { select: { amount: true, amountPaid: true, waivedAmount: true } },
      },
    }),
  ]);

  const whole = { whole: true } as const;
  const multiple = Number(cycle.maxLoanCorpusMultiple.toFixed(2));

  const memberOptions = members.map((member) => {
    const contributed = sumPaise(
      member.contributions.map((row) => decimalToPaise(row.amountPaid))
    );
    const headroom = Math.floor(contributed * multiple);
    return {
      value: member.id,
      label: `${member.displayName} — ${t.loans.canBorrow} ${formatPaise(headroom, whole)}`,
    };
  });

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold sm:text-3xl">{t.loans.title}</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t.loans.subtitle}
          </p>
        </div>

        <div className="rounded-lg border border-[var(--line)] bg-white p-4">
          <ActionForm
            action={generateInterestAction}
            compact
            submitLabel={t.loans.generateInterest}
            variant="secondary"
          >
            <p className="flex items-start gap-2 text-xs text-[var(--muted)]">
              <TrendingUp className="mt-0.5 shrink-0" size={14} />
              {t.loans.generateInterestHint}
            </p>
          </ActionForm>
        </div>
      </div>

      <div className="mt-6 rounded-lg border border-[var(--line)] bg-white p-5">
        <h2 className="flex items-center gap-2 text-base font-semibold">
          <CircleDollarSign size={18} />
          {t.loans.newLoan}
        </h2>
        <ActionForm
          action={createLoanAction}
          className="mt-4"
          pendingLabel={t.loans.creating}
          submitLabel={t.loans.newLoan}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SelectField
              label={t.common.member}
              name="memberId"
              options={[{ value: "", label: t.loans.selectMember }, ...memberOptions]}
              required
            />
            <Field
              hint={`${t.group.borrowingLimit}: ${multiple}x`}
              label={t.loans.principal}
              name="principal"
              required
            />
            <Field
              defaultValue={today()}
              label={t.loans.disbursedOn}
              name="disbursedOn"
              required
              type="date"
            />
            <Field label={t.common.notes} name="notes" />
          </div>
        </ActionForm>
      </div>

      {loans.length === 0 ? (
        <p className="mt-6 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-center text-sm text-[var(--muted)]">
          {t.loans.noLoans}
        </p>
      ) : (
        <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
          <table className="w-full min-w-[860px] text-sm">
            <caption className="sr-only">{t.loans.title}</caption>
            <thead>
              <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.common.member}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.loans.principal}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.member.outstandingPrincipal}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  {t.loans.owes}
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  {t.loans.dueBy}
                </th>
                <th className="px-4 py-3 text-right font-medium" scope="col">
                  <span className="sr-only">{t.loans.repay}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {loans.map((loan) => {
                const principal = decimalToPaise(loan.principal);
                const outstandingPrincipal = atLeastZero(
                  principal -
                    sumPaise(loan.repayments.map((r) => decimalToPaise(r.principalAmount)))
                );
                const outstandingInterest = sumPaise(
                  loan.interestDues.map((due) =>
                    atLeastZero(decimalToPaise(due.amountDue) - decimalToPaise(due.amountPaid))
                  )
                );
                const outstandingFine = sumPaise(
                  loan.fines.map((fine) =>
                    atLeastZero(
                      decimalToPaise(fine.amount) -
                        decimalToPaise(fine.amountPaid) -
                        decimalToPaise(fine.waivedAmount)
                    )
                  )
                );
                const totalOwed =
                  outstandingPrincipal + outstandingInterest + outstandingFine;

                return (
                  <LoanRow
                    key={loan.id}
                    labels={{
                      repay: t.loans.repay,
                      repayHint: t.loans.repayHint,
                      amount: t.common.amount,
                      paidOn: t.contributions.paidOn,
                      notes: t.common.notes,
                      closed: t.loans.closed,
                      overdue: t.loans.overdue,
                      interest: t.member.interest,
                      fines: t.group.fines,
                    }}
                    loan={{
                      id: loan.id,
                      memberName: loan.member.displayName,
                      principalLabel: formatPaise(principal, whole),
                      outstandingPrincipalLabel: formatPaise(outstandingPrincipal, whole),
                      totalOwedLabel: formatPaise(totalOwed, whole),
                      totalOwedRupees: (totalOwed / 100).toFixed(2),
                      interestLabel: formatPaise(outstandingInterest, whole),
                      fineLabel: formatPaise(outstandingFine, whole),
                      dueOn: loan.dueOn.toISOString().slice(0, 10),
                      isClosed: loan.status === "CLOSED",
                      isOverdue: loan.status !== "CLOSED" && loan.dueOn < new Date(),
                    }}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
