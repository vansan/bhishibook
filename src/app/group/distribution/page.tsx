import { AlertTriangle, PieChart } from "lucide-react";
import { ActionForm, Field } from "@/components/ui/action-form";
import { requireGroupAdmin } from "@/lib/auth";
import { getLocale, getMessages } from "@/lib/i18n";
import { formatMemberName } from "@/lib/members";
import { formatPaise } from "@/lib/money";
import { previewDistribution } from "@/lib/services/distribution";
import { closeCycleAction } from "../actions";

export default async function DistributionPage() {
  const scope = await requireGroupAdmin();
  const [t, locale, preview] = await Promise.all([
    getMessages(),
    getLocale(),
    previewDistribution(scope.groupId),
  ]);

  if (!preview) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <h1 className="text-2xl font-bold sm:text-3xl">{t.distribution.title}</h1>
        <p className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white p-6 text-sm text-[var(--muted)]">
          {t.group.noCycle}
        </p>
      </section>
    );
  }

  const whole = { whole: true } as const;

  return (
    <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-bold sm:text-3xl">{t.distribution.title}</h1>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
        {t.distribution.subtitle}
      </p>

      <p
        className={
          preview.isClosed
            ? "mt-4 inline-flex items-center gap-2 rounded-md bg-blue-50 px-3 py-2 text-sm font-medium text-[var(--primary)]"
            : "mt-4 inline-flex items-center gap-2 rounded-md bg-amber-50 px-3 py-2 text-sm font-medium text-[var(--warn)]"
        }
      >
        <PieChart size={15} />
        {preview.cycleName} — {preview.isClosed ? t.distribution.closed : t.distribution.notClosed}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Summary
          label={t.distribution.interestPool}
          value={formatPaise(preview.interestCollectedPaise, whole)}
        />
        <Summary
          label={t.distribution.finePool}
          value={formatPaise(preview.finesCollectedPaise, whole)}
          hint={
            preview.distributeFines ? t.common.sharedWithMembers : t.common.keptInCorpus
          }
        />
        <Summary
          label={t.distribution.distributable}
          value={formatPaise(preview.distributablePaise, whole)}
          hint={`${preview.totalShares} ${t.common.shares}`}
        />
        <Summary
          label={t.distribution.totalPayout}
          value={formatPaise(preview.totalPayoutPaise, whole)}
          hint={
            preview.retainedInCorpusPaise > 0
              ? `${t.distribution.retained} ${formatPaise(preview.retainedInCorpusPaise, whole)}`
              : undefined
          }
        />
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-[var(--line)] bg-white">
        <table className="w-full min-w-[900px] text-sm">
          <caption className="sr-only">{t.distribution.title}</caption>
          <thead>
            <tr className="border-b border-[var(--line)] text-left text-[var(--muted)]">
              <th className="px-4 py-3 font-medium" scope="col">
                {t.common.member}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.common.shares}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.members.contributed}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.distribution.interestShare}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.distribution.fineShare}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.distribution.corpusReturned}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.distribution.deductions}
              </th>
              <th className="px-4 py-3 text-right font-medium" scope="col">
                {t.distribution.payout}
              </th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr className="border-b border-[var(--line)] last:border-0" key={row.memberId}>
                <td className="px-4 py-3 font-medium">
                  {formatMemberName(row, locale)}
                  {row.excluded ? (
                    <span className="ml-2 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                      {t.common.none}
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">{row.shareCount}</td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPaise(row.corpusContributedPaise, whole)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPaise(row.interestSharePaise, whole)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPaise(row.fineSharePaise, whole)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  {formatPaise(row.corpusReturnedPaise, whole)}
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-[var(--warn)]">
                  {row.deductionsPaise > 0
                    ? `-${formatPaise(row.deductionsPaise, whole)}`
                    : "-"}
                </td>
                <td className="px-4 py-3 text-right font-semibold tabular-nums">
                  {formatPaise(row.payoutPaise, whole)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-[var(--line)] bg-[var(--background)]">
              <td className="px-4 py-3 font-semibold" colSpan={7}>
                {t.distribution.totalPayout}
              </td>
              <td className="px-4 py-3 text-right font-bold tabular-nums">
                {formatPaise(preview.totalPayoutPaise, whole)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      {preview.isClosed ? null : (
        <div className="mt-6 rounded-lg border border-red-200 bg-red-50/50 p-5">
          <h2 className="flex items-center gap-2 text-base font-semibold text-red-800">
            <AlertTriangle size={18} />
            {t.distribution.confirm}
          </h2>
          <p className="mt-2 text-sm text-red-800/80">{t.distribution.confirmHint}</p>
          <ActionForm
            action={closeCycleAction}
            className="mt-4 max-w-sm"
            hidden={{ cycleId: preview.cycleId }}
            pendingLabel={t.distribution.confirming}
            submitLabel={t.distribution.confirm}
            variant="danger"
          >
            <Field
              hint='Type CLOSE to confirm'
              label="Confirm"
              name="confirm"
              placeholder="CLOSE"
              required
            />
          </ActionForm>
        </div>
      )}
    </section>
  );
}

function Summary({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="rounded-lg border border-[var(--line)] bg-white p-4">
      <p className="text-sm text-[var(--muted)]">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-[var(--muted)]">{hint}</p> : null}
    </div>
  );
}
