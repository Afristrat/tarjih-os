import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { proposeHypothesis } from "@/app/app/budgets/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { noticeFrom } from "@/lib/budgets/notices";
import {
  dimensionsFor,
  formatHypothesisValue,
  hypothesisStatusLabel,
  hypothesisStatusTone,
  versionStatusLabel,
  versionStatusTone,
  type DimensionGrantRow,
  type DimensionRow,
} from "@/lib/budgets/scope";
import { createClient } from "@/lib/supabase/server";

type PageParams = Promise<{ versionId: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type HypothesisRow = {
  dimension_id: string;
  id: string;
  parameter_key: string;
  proposed_by: string;
  status: string;
  unit: string;
  value: unknown;
};

export default async function BudgetVersionPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();
  const [{ versionId }, queryParams] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: version, error: versionError } = await supabase
    .from("budget_versions")
    .select("id, cycle_id, version_no, status, published_at")
    .eq("tenant_id", context.tenantId)
    .eq("id", versionId)
    .maybeSingle();

  // Une version hors du tenant ou hors du périmètre est filtrée par la RLS et
  // arrive donc ici comme inexistante. C'est voulu : l'écran ne distingue pas
  // « absente » de « pas à vous », il ne révèle pas qu'elle existe ailleurs.
  if (versionError || !version) {
    notFound();
  }

  const [cycleResult, hypothesesResult, dimensionsResult, grantsResult] = await Promise.all([
    supabase.from("budget_cycles").select("id, name").eq("id", version.cycle_id).maybeSingle(),
    supabase
      .from("hypotheses")
      .select("id, dimension_id, parameter_key, value, unit, status, proposed_by")
      .eq("tenant_id", context.tenantId)
      .eq("version_id", versionId)
      .order("parameter_key"),
    supabase
      .from("dimensions")
      .select("id, kind, code, name")
      .eq("tenant_id", context.tenantId)
      .order("name"),
    supabase
      .from("dimension_grants")
      .select("dimension_id, can_read, can_contribute, can_approve, can_export")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", context.userId),
  ]);

  if (hypothesesResult.error || dimensionsResult.error || grantsResult.error) {
    throw new Error("Impossible de charger les contributions de cette version.");
  }

  const hypotheses: HypothesisRow[] = hypothesesResult.data ?? [];
  const dimensions: DimensionRow[] = dimensionsResult.data ?? [];
  const grants: DimensionGrantRow[] = grantsResult.data ?? [];
  const notice = noticeFrom(queryParams);
  const cycleName = cycleResult.data?.name ?? "Cycle";
  const frozen = version.status === "published";
  const contributable = dimensionsFor(context, grants, dimensions, "contribute");
  const dimensionName = (id: string): string =>
    dimensions.find((dimension) => dimension.id === id)?.name ?? "Dimension hors périmètre";

  return (
    <main className="console">
      <div className="console-head">
        <Link className="console-back" href="/app/budgets">
          ← Cycles et versions
        </Link>
        <p className="eyebrow">{cycleName}</p>
        <h1>
          Version {version.version_no}{" "}
          <span className="state-tag" data-tone={versionStatusTone(version.status)}>
            {versionStatusLabel(version.status)}
          </span>
        </h1>
        <p className="lede">
          {frozen
            ? "Cette version est publiée : son contenu est figé. Ni une correction ni une hypothèse de plus n’y sont possibles — la suite se joue dans une version suivante."
            : "Chaque hypothèse est proposée dans une dimension attribuée, puis décidée par un approbateur de cette même dimension."}
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="console-layout">
        <aside className="console-aside">
          <div>
            <p className="console-kicker">Proposer une hypothèse</p>
            {frozen || contributable.length === 0 ? (
              <p className="console-empty">
                {frozen
                  ? "La version est publiée : elle n’accepte plus aucune proposition."
                  : "Aucune dimension ne vous est ouverte en contribution. Un administrateur du tenant peut vous en attribuer une."}
              </p>
            ) : (
              <form action={proposeHypothesis} className="console-form">
                <input type="hidden" name="version_id" value={version.id} />
                <label data-span="full">
                  Dimension
                  <select name="dimension_id" required>
                    {contributable.map((dimension) => (
                      <option key={dimension.id} value={dimension.id}>
                        {dimension.name} · {dimension.code}
                      </option>
                    ))}
                  </select>
                </label>
                <label data-span="full">
                  Paramètre
                  <input
                    name="parameter_key"
                    required
                    maxLength={160}
                    placeholder="croissance_ventes"
                  />
                </label>
                <label>
                  Valeur
                  <input
                    name="value"
                    required
                    maxLength={64}
                    inputMode="decimal"
                    placeholder="0.08"
                  />
                </label>
                <label>
                  Unité
                  <input name="unit" required maxLength={32} placeholder="ratio" />
                </label>
                <button className="console-button" type="submit">
                  Proposer
                </button>
              </form>
            )}
          </div>
        </aside>

        <section className="console-panel">
          <div className="panel-head">
            <div>
              <p className="console-kicker">Contributions</p>
              <h2>
                {hypotheses.length} hypothèse{hypotheses.length > 1 ? "s" : ""} dans votre périmètre
              </h2>
            </div>
            <p>Vous ne voyez que les dimensions qui vous sont ouvertes en lecture.</p>
          </div>

          {hypotheses.length === 0 ? (
            <p className="console-empty">
              Aucune hypothèse lisible dans cette version. Elle est vide, ou son contenu porte sur
              des dimensions qui ne vous sont pas attribuées.
            </p>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Paramètre</th>
                    <th scope="col">Valeur</th>
                    <th scope="col">État</th>
                    <th scope="col">
                      <span className="visually-hidden">Ouvrir</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {hypotheses.map((hypothesis) => (
                    <tr key={hypothesis.id}>
                      <td className="dimension-cell">
                        <strong>{hypothesis.parameter_key}</strong>
                        <span>{dimensionName(hypothesis.dimension_id)}</span>
                      </td>
                      <td>
                        {formatHypothesisValue(hypothesis.value)} {hypothesis.unit}
                      </td>
                      <td>
                        <span
                          className="state-tag"
                          data-tone={hypothesisStatusTone(hypothesis.status)}
                        >
                          {hypothesisStatusLabel(hypothesis.status)}
                        </span>
                      </td>
                      <td>
                        <Link
                          className="console-button"
                          data-variant="discret"
                          href={`/app/hypotheses/${hypothesis.id}`}
                        >
                          Détail
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
