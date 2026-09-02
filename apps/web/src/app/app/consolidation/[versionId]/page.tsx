import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import { publishCalculation } from "@/app/app/consolidation/[versionId]/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { noticeFrom } from "@/lib/budgets/notices";
import { versionStatusLabel, versionStatusTone } from "@/lib/budgets/scope";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
type RouteParams = Promise<{ versionId: string }>;

type VersionRow = {
  calculation_model: string;
  id: string;
  input_hash: string | null;
  is_superseded: boolean;
  published_at: string | null;
  status: string;
  version_no: number;
};

type ValueRow = {
  account_id: string;
  amount: string;
  currency: string;
  dimension_id: string;
  period_id: string;
};

type RunRow = {
  completed_at: string | null;
  engine_version: string;
  id: string;
  input_hash: string;
  output_hash: string | null;
};

const MODEL_LABELS: Record<string, string> = {
  cost_center: "Centres de coûts",
  direct: "Saisie directe",
  driver: "Inducteurs",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asVersion(value: unknown): VersionRow | null {
  if (
    !isRecord(value) ||
    typeof value.id !== "string" ||
    typeof value.status !== "string" ||
    typeof value.calculation_model !== "string" ||
    typeof value.version_no !== "number" ||
    typeof value.is_superseded !== "boolean"
  ) {
    return null;
  }

  return {
    calculation_model: value.calculation_model,
    id: value.id,
    input_hash: typeof value.input_hash === "string" ? value.input_hash : null,
    is_superseded: value.is_superseded,
    published_at: typeof value.published_at === "string" ? value.published_at : null,
    status: value.status,
    version_no: value.version_no,
  };
}

/**
 * Montant lisible par un financier : séparateurs de milliers, deux décimales.
 *
 * L'arrondi d'affichage ne touche pas la valeur publiée, qui reste à six
 * décimales en base. `Number` est acceptable ici et seulement ici : rien de ce
 * qui est calculé ne repart de cette conversion.
 */
function formatAmount(amount: string, currency: string): string {
  const parsed = Number(amount);
  if (!Number.isFinite(parsed)) {
    return amount;
  }

  return new Intl.NumberFormat("fr-FR", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(parsed);
}

export default async function ConsolidationPage({
  params,
  searchParams,
}: {
  params: RouteParams;
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();

  // La consolidation est réservée au DAF et au DG (`specs/_source/archi.md:112`).
  // Un contributeur n'y accède pas, même en devinant l'adresse.
  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const { versionId } = await params;
  const notice = noticeFrom(await searchParams);
  const supabase = await createClient();

  const { data: rawVersion } = await supabase
    .from("budget_version_states")
    .select("id, version_no, status, calculation_model, input_hash, published_at, is_superseded")
    .eq("id", versionId)
    .eq("tenant_id", context.tenantId)
    .maybeSingle();

  const version = asVersion(rawVersion);
  if (!version) {
    redirect("/app/budgets?error=calculation-forbidden");
  }

  const [values, runs, dimensions, accounts, periods] = await Promise.all([
    supabase
      .from("budget_values")
      .select("dimension_id, account_id, period_id, amount, currency")
      .eq("tenant_id", context.tenantId)
      .eq("version_id", versionId),
    supabase
      .from("calculation_runs")
      .select("id, engine_version, input_hash, output_hash, completed_at")
      .eq("tenant_id", context.tenantId)
      .eq("version_id", versionId)
      .eq("status", "succeeded")
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase.from("dimensions").select("id, name").eq("tenant_id", context.tenantId),
    supabase.from("financial_accounts").select("id, code, name").eq("tenant_id", context.tenantId),
    supabase.from("periods").select("id, starts_on, ends_on").eq("tenant_id", context.tenantId),
  ]);

  const dimensionNames = new Map<string, string>();
  for (const row of dimensions.data ?? []) {
    if (isRecord(row) && typeof row.id === "string" && typeof row.name === "string") {
      dimensionNames.set(row.id, row.name);
    }
  }

  const accountLabels = new Map<string, string>();
  for (const row of accounts.data ?? []) {
    if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.code === "string" &&
      typeof row.name === "string"
    ) {
      accountLabels.set(row.id, `${row.code} · ${row.name}`);
    }
  }

  const periodLabels = new Map<string, string>();
  for (const row of periods.data ?? []) {
    if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.starts_on === "string" &&
      typeof row.ends_on === "string"
    ) {
      periodLabels.set(row.id, `${row.starts_on} → ${row.ends_on}`);
    }
  }

  const publishedValues: ValueRow[] = [];
  for (const row of values.data ?? []) {
    if (
      isRecord(row) &&
      typeof row.dimension_id === "string" &&
      typeof row.account_id === "string" &&
      typeof row.period_id === "string" &&
      typeof row.currency === "string"
    ) {
      publishedValues.push({
        account_id: row.account_id,
        amount: String(row.amount),
        currency: row.currency,
        dimension_id: row.dimension_id,
        period_id: row.period_id,
      });
    }
  }

  const rawRun = (runs.data ?? [])[0];
  const run: RunRow | null =
    isRecord(rawRun) &&
    typeof rawRun.id === "string" &&
    typeof rawRun.engine_version === "string" &&
    typeof rawRun.input_hash === "string"
      ? {
          completed_at: typeof rawRun.completed_at === "string" ? rawRun.completed_at : null,
          engine_version: rawRun.engine_version,
          id: rawRun.id,
          input_hash: rawRun.input_hash,
          output_hash: typeof rawRun.output_hash === "string" ? rawRun.output_hash : null,
        }
      : null;

  const total = publishedValues.reduce((sum, value) => sum + Number(value.amount), 0);
  const currency = publishedValues[0]?.currency ?? context.baseCurrency;

  return (
    <main className="console">
      <div className="console-head">
        <Link className="console-back" href="/app/budgets">
          ← Cycles et versions
        </Link>
        <p className="eyebrow">Consolidation</p>
        <h1>Version {version.version_no}</h1>
        <p className="lede">
          Chaque montant provient d’un calcul empreinté, exécuté par le moteur versionné sur les
          seules hypothèses approuvées. Une version publiée ne se corrige pas : elle se remplace.
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="console-panel">
        <div className="panel-head">
          <div>
            <p className="console-kicker">État</p>
            <h2>
              <span className="state-tag" data-tone={versionStatusTone(version.status)}>
                {versionStatusLabel(version.status)}
              </span>
              {version.is_superseded ? (
                <span className="state-tag" data-tone="refus">
                  Remplacée
                </span>
              ) : null}
            </h2>
          </div>

          {version.status !== "published" ? (
            <form action={publishCalculation}>
              <input type="hidden" name="version_id" value={version.id} />
              <button className="console-button" type="submit">
                Calculer et publier
              </button>
            </form>
          ) : null}
        </div>

        <dl className="fact-list">
          <dt>Modèle de calcul</dt>
          <dd>{MODEL_LABELS[version.calculation_model] ?? version.calculation_model}</dd>
          <dt>Publiée le</dt>
          <dd>{version.published_at ?? "—"}</dd>
          <dt>Moteur</dt>
          <dd>{run?.engine_version ?? "—"}</dd>
          <dt>Empreinte des hypothèses</dt>
          <dd className="hash-value">{run?.input_hash ?? version.input_hash ?? "—"}</dd>
          <dt>Empreinte des résultats</dt>
          <dd className="hash-value">{run?.output_hash ?? "—"}</dd>
        </dl>

        {publishedValues.length > 0 ? (
          <>
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Dimension</th>
                    <th scope="col">Compte</th>
                    <th scope="col">Période</th>
                    <th className="amount-cell" scope="col">
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {publishedValues.map((value) => (
                    <tr key={`${value.dimension_id}-${value.account_id}-${value.period_id}`}>
                      <td className="dimension-cell">
                        <strong>{dimensionNames.get(value.dimension_id) ?? "—"}</strong>
                      </td>
                      <td>{accountLabels.get(value.account_id) ?? "—"}</td>
                      <td>{periodLabels.get(value.period_id) ?? "—"}</td>
                      <td className="amount-cell">{formatAmount(value.amount, value.currency)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <th colSpan={3} scope="row">
                      Total consolidé
                    </th>
                    <td className="amount-cell">
                      {formatAmount(total.toFixed(6), currency)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </>
        ) : (
          <p className="console-empty">
            Aucun montant publié pour cette version. Lancez le calcul lorsque les hypothèses
            nécessaires sont approuvées.
          </p>
        )}
      </div>
    </main>
  );
}
