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
  id: string;
  period_id: string;
};

/** La part d'une hypothèse dans un montant publié, telle qu'on la montre. */
type SourceRow = {
  amount: string;
  label: string;
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

/**
 * D'où vient ce chiffre.
 *
 * `details` natif plutôt qu'un dépliant en JavaScript : l'origine d'un montant
 * doit rester lisible sans script, et l'élément gère seul son état, son clavier
 * et son accessibilité.
 *
 * Les parts sont affichées telles que le moteur les a calculées — non arrondies,
 * par `formatShare`. Leur somme arrondie égale le montant publié ; les afficher
 * arrondies chacune ferait une addition fausse sous les yeux d'un DAF, ce qu'une
 * recette navigateur a d'ailleurs constaté avant que ce soit corrigé.
 */
function ValueOrigin({
  currency,
  sources,
}: {
  currency: string;
  sources: SourceRow[];
}): ReactElement {
  if (sources.length === 0) {
    // Impossible depuis la migration `trace_value_sources` : la publication
    // refuse un montant sans origine. Reste vrai des montants publiés avant.
    return <span className="origin-missing">Origine non enregistrée</span>;
  }

  return (
    <details className="origin-details">
      <summary>
        {sources.length === 1 ? "1 hypothèse" : `${sources.length} hypothèses`}
      </summary>
      <ul className="origin-list">
        {sources.map((source) => (
          <li key={source.label}>
            <span>{source.label}</span>
            <span className="origin-share">{formatShare(source.amount, currency)}</span>
          </li>
        ))}
      </ul>
    </details>
  );
}

/**
 * Met en forme une part SANS rien arrondir ni faire passer par un flottant.
 *
 * `formatAmount` ne convient pas ici : il fixe deux décimales et passe par
 * `Number`. Sur des parts exactes, cela produit une addition fausse à l'écran —
 * 10,005 et 20,005 s'affichaient « 10,01 » et « 20,01 » sous un total de
 * « 30,01 ». Le lecteur additionne 30,02 et cesse, à raison, de croire le
 * chiffre. Une part garde donc toutes ses décimales, et au moins deux pour
 * s'aligner sur les montants.
 *
 * Aucune conversion numérique : la valeur vient d'un `numeric` PostgreSQL et
 * repart en chaîne, comme partout ailleurs dans ce produit.
 */
function formatShare(amount: string, currency: string): string {
  const decompose = amount.trim().match(/^(-?)(\d+)(?:\.(\d+))?$/);
  if (!decompose) {
    return amount;
  }

  // Espace insécable étroite entre les milliers, insécable devant la devise :
  // les mêmes que produit `Intl` en fr-FR, écrites en échappement pour rester
  // visibles à la relecture — un caractère invisible se perd à la première
  // correction de la ligne.
  const entier = decompose[2].replace(/\B(?=(\d{3})+(?!\d))/g, "\u202F");
  const decimales = (decompose[3] ?? "").padEnd(2, "0");

  return `${decompose[1]}${entier},${decimales}\u00A0${currency}`;
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
      .select("id, dimension_id, account_id, period_id, amount, currency")
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
      typeof row.id === "string" &&
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
        id: row.id,
        period_id: row.period_id,
      });
    }
  }

  // L'origine de chaque montant. La requête vient après celle des montants :
  // `budget_value_sources` ne porte pas la version, elle porte le montant — et
  // c'est voulu, le triplet appartient au montant et ne doit pas être dupliqué.
  const sourcesByValue = new Map<string, SourceRow[]>();
  if (publishedValues.length > 0) {
    const [sources, hypotheses] = await Promise.all([
      supabase
        .from("budget_value_sources")
        .select("budget_value_id, hypothesis_id, amount")
        .eq("tenant_id", context.tenantId)
        .in(
          "budget_value_id",
          publishedValues.map((value) => value.id),
        ),
      supabase
        .from("hypotheses")
        .select("id, parameter_key, unit")
        .eq("tenant_id", context.tenantId)
        .eq("version_id", versionId),
    ]);

    const hypothesisLabels = new Map<string, string>();
    for (const row of hypotheses.data ?? []) {
      if (isRecord(row) && typeof row.id === "string" && typeof row.parameter_key === "string") {
        hypothesisLabels.set(row.id, row.parameter_key);
      }
    }

    for (const row of sources.data ?? []) {
      if (
        !isRecord(row) ||
        typeof row.budget_value_id !== "string" ||
        typeof row.hypothesis_id !== "string"
      ) {
        continue;
      }

      const parts = sourcesByValue.get(row.budget_value_id) ?? [];
      parts.push({
        amount: String(row.amount),
        // Une hypothèse dont le libellé manque n'est pas masquée : son
        // identifiant vaut mieux qu'une ligne disparue.
        label: hypothesisLabels.get(row.hypothesis_id) ?? row.hypothesis_id,
      });
      sourcesByValue.set(row.budget_value_id, parts);
    }

    for (const parts of sourcesByValue.values()) {
      parts.sort((left, right) => left.label.localeCompare(right.label, "fr"));
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
                    <th scope="col">Origine</th>
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
                      <td>
                        <ValueOrigin
                          currency={value.currency}
                          sources={sourcesByValue.get(value.id) ?? []}
                        />
                      </td>
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
                    <td />
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
