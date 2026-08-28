import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactElement } from "react";

import { decideHypothesis, updateHypothesis } from "@/app/app/budgets/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { noticeFrom } from "@/lib/budgets/notices";
import {
  formatHypothesisValue,
  hasDimensionPermission,
  hypothesisStatusLabel,
  hypothesisStatusTone,
  type DimensionGrantRow,
} from "@/lib/budgets/scope";
import { createClient } from "@/lib/supabase/server";

type PageParams = Promise<{ id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type DecisionRow = {
  created_at: string;
  decided_by: string;
  decision: string;
  id: string;
  reason: string;
};

const DECISION_LABELS: Record<string, string> = {
  approved: "Approuvée",
  rejected: "Rejetée",
};

export default async function HypothesisPage({
  params,
  searchParams,
}: {
  params: PageParams;
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();
  const [{ id }, queryParams] = await Promise.all([params, searchParams]);
  const supabase = await createClient();

  const { data: hypothesis, error: hypothesisError } = await supabase
    .from("hypotheses")
    .select("id, version_id, dimension_id, parameter_key, value, unit, status, row_version, proposed_by, created_at, updated_at")
    .eq("tenant_id", context.tenantId)
    .eq("id", id)
    .maybeSingle();

  // Hors du périmètre de lecture, la RLS ne rend rien : l'écran répond
  // « introuvable » sans jamais laisser deviner que la ligne existe ailleurs.
  if (hypothesisError || !hypothesis) {
    notFound();
  }

  const [versionResult, dimensionResult, decisionsResult, grantsResult] = await Promise.all([
    supabase
      .from("budget_versions")
      .select("id, cycle_id, version_no, status")
      .eq("id", hypothesis.version_id)
      .maybeSingle(),
    supabase
      .from("dimensions")
      .select("id, code, name")
      .eq("id", hypothesis.dimension_id)
      .maybeSingle(),
    supabase
      .from("hypothesis_decisions")
      .select("id, decision, reason, decided_by, created_at")
      .eq("tenant_id", context.tenantId)
      .eq("hypothesis_id", hypothesis.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("dimension_grants")
      .select("dimension_id, can_read, can_contribute, can_approve, can_export")
      .eq("tenant_id", context.tenantId)
      .eq("user_id", context.userId),
  ]);

  if (decisionsResult.error || grantsResult.error) {
    throw new Error("Impossible de charger la trace de décision de cette hypothèse.");
  }

  const decisions: DecisionRow[] = decisionsResult.data ?? [];
  const grants: DimensionGrantRow[] = grantsResult.data ?? [];
  const notice = noticeFrom(queryParams);
  const frozen = versionResult.data?.status === "published";
  const pending = hypothesis.status === "proposed";
  const mine = hypothesis.proposed_by === context.userId;

  const canCorrect =
    pending && mine && !frozen && hasDimensionPermission(context, grants, hypothesis.dimension_id, "contribute");
  const canDecide =
    pending && !frozen && hasDimensionPermission(context, grants, hypothesis.dimension_id, "approve");

  return (
    <main className="console">
      <div className="console-head">
        <Link className="console-back" href={`/app/budgets/${hypothesis.version_id}`}>
          ← Version {versionResult.data?.version_no ?? ""}
        </Link>
        <p className="eyebrow">
          {dimensionResult.data ? `${dimensionResult.data.name} · ${dimensionResult.data.code}` : "Dimension"}
        </p>
        <h1>
          {hypothesis.parameter_key}{" "}
          <span className="state-tag" data-tone={hypothesisStatusTone(hypothesis.status)}>
            {hypothesisStatusLabel(hypothesis.status)}
          </span>
        </h1>
        <p className="lede">
          Une décision s’inscrit définitivement : elle ne se réécrit pas et ne s’efface pas. Revenir
          dessus, c’est en prendre une autre dans une version suivante.
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="console-layout">
        <aside className="console-aside">
          {canCorrect ? (
            <div>
              <p className="console-kicker">Corriger ma proposition</p>
              <form action={updateHypothesis} className="console-form">
                <input type="hidden" name="hypothesis_id" value={hypothesis.id} />
                <input type="hidden" name="row_version" value={hypothesis.row_version} />
                <label>
                  Valeur
                  <input
                    name="value"
                    required
                    maxLength={64}
                    inputMode="decimal"
                    defaultValue={formatHypothesisValue(hypothesis.value)}
                  />
                </label>
                <label>
                  Unité
                  <input name="unit" required maxLength={32} defaultValue={hypothesis.unit} />
                </label>
                <button className="console-button" type="submit">
                  Corriger
                </button>
              </form>
            </div>
          ) : null}

          {canDecide ? (
            <div>
              <p className="console-kicker">Décider</p>
              <form action={decideHypothesis} className="console-form">
                <input type="hidden" name="hypothesis_id" value={hypothesis.id} />
                <input type="hidden" name="row_version" value={hypothesis.row_version} />
                <label data-span="full">
                  Sens de la décision
                  <select name="decision" defaultValue="approved" required>
                    <option value="approved">Approuver</option>
                    <option value="rejected">Rejeter</option>
                  </select>
                </label>
                <label data-span="full">
                  Valeur retenue (laisser vide pour garder celle proposée)
                  <input
                    name="replacement_value"
                    maxLength={64}
                    inputMode="decimal"
                    placeholder={formatHypothesisValue(hypothesis.value)}
                  />
                </label>
                <label data-span="full">
                  Motif
                  <textarea name="reason" required maxLength={500} />
                </label>
                <button className="console-button" type="submit">
                  Enregistrer la décision
                </button>
              </form>
            </div>
          ) : null}

          {!canCorrect && !canDecide ? (
            <div>
              <p className="console-kicker">Ce que vous pouvez faire ici</p>
              <p className="console-empty">
                {frozen
                  ? "La version est publiée : cette hypothèse est figée."
                  : pending
                    ? "Vous lisez cette hypothèse sans pouvoir la corriger ni la décider."
                    : "Cette hypothèse a été décidée. Sa trace ci-contre est définitive."}
              </p>
            </div>
          ) : null}
        </aside>

        <section className="console-panel">
          <div className="panel-head">
            <div>
              <p className="console-kicker">Faits</p>
              <h2>Ce que la base retient</h2>
            </div>
          </div>

          <dl className="fact-list">
            <dt>Valeur</dt>
            <dd>
              {formatHypothesisValue(hypothesis.value)} {hypothesis.unit}
            </dd>
            <dt>Révision</dt>
            <dd>
              {hypothesis.row_version} — chaque écriture succède à la précédente, jamais ne la
              recouvre
            </dd>
            <dt>Proposée</dt>
            <dd>
              {mine ? "Par vous" : "Par un contributeur de la dimension"} le{" "}
              {new Date(hypothesis.created_at).toLocaleDateString("fr-FR")}
            </dd>
            <dt>Dernière écriture</dt>
            <dd>{new Date(hypothesis.updated_at).toLocaleDateString("fr-FR")}</dd>
          </dl>

          <div className="panel-head">
            <div>
              <p className="console-kicker">Décisions</p>
              <h2>
                {decisions.length === 0
                  ? "Aucune décision"
                  : `${decisions.length} décision${decisions.length > 1 ? "s" : ""}`}
              </h2>
            </div>
          </div>

          {decisions.length === 0 ? (
            <p className="console-empty">
              Cette hypothèse attend la décision d’un approbateur de sa dimension.
            </p>
          ) : (
            <ul className="trail">
              {decisions.map((decision) => (
                <li className="trail-entry" key={decision.id}>
                  <div className="trail-meta">
                    <span
                      className="state-tag"
                      data-tone={decision.decision === "approved" ? "acquis" : "refus"}
                    >
                      {DECISION_LABELS[decision.decision] ?? decision.decision}
                    </span>
                    <span>{new Date(decision.created_at).toLocaleString("fr-FR")}</span>
                    <span>{decision.decided_by === context.userId ? "Par vous" : "Par un approbateur"}</span>
                  </div>
                  <p>{decision.reason}</p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
