import Link from "next/link";
import type { ReactElement } from "react";

import { createBudgetCycle, createBudgetVersion } from "@/app/app/budgets/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { noticeFrom } from "@/lib/budgets/notices";
import {
  CALCULATION_MODELS,
  calculationModelLabel,
  versionOriginValue,
  versionStatusLabel,
  versionStatusTone,
} from "@/lib/budgets/scope";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type CycleRow = {
  id: string;
  name: string;
  status: string;
};

type VersionRow = {
  calculation_model: string;
  created_at: string;
  cycle_id: string;
  id: string;
  parent_version_id: string | null;
  status: string;
  version_no: number;
};

const CYCLE_STATUSES: Record<string, string> = {
  closed: "Clos",
  draft: "Brouillon",
  open: "Ouvert",
  review: "En revue",
};

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();
  const supabase = await createClient();

  const [cyclesResult, versionsResult, params] = await Promise.all([
    supabase
      .from("budget_cycles")
      .select("id, name, status")
      .eq("tenant_id", context.tenantId)
      .order("name"),
    supabase
      .from("budget_versions")
      .select("id, cycle_id, version_no, status, created_at, calculation_model, parent_version_id")
      .eq("tenant_id", context.tenantId)
      .order("version_no", { ascending: false }),
    searchParams,
  ]);

  if (cyclesResult.error || versionsResult.error) {
    throw new Error("Impossible de charger les cycles budgétaires.");
  }

  const cycles: CycleRow[] = cyclesResult.data ?? [];
  const versions: VersionRow[] = versionsResult.data ?? [];
  const notice = noticeFrom(params);
  const manages = canManageFinance(context);

  return (
    <main className="console">
      <div className="console-head">
        <p className="eyebrow">Budget</p>
        <h1>Cycles et versions</h1>
        <p className="lede">
          Un cycle porte des versions successives. Les contributions se déposent dans une version
          candidate ; une fois publiée, une version ne bouge plus et toute correction ouvre la
          suivante.
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="console-layout">
        <aside className="console-aside">
          {manages ? (
            <div>
              <p className="console-kicker">Nouveau cycle</p>
              <form action={createBudgetCycle} className="console-form">
                <label>
                  Nom
                  <input name="name" required maxLength={160} placeholder="Budget 2027" />
                </label>
                <button className="console-button" type="submit">
                  Créer le cycle
                </button>
              </form>
            </div>
          ) : null}

          <div>
            <p className="console-kicker">Votre place ici</p>
            <p className="console-empty">
              {manages
                ? "Vous ouvrez les cycles et les versions candidates. Les contributeurs y déposent leurs hypothèses, que vous décidez ensuite."
                : "Vous déposez vos hypothèses dans les versions candidates ouvertes, sur les dimensions qui vous sont attribuées."}
            </p>
          </div>
        </aside>

        <section className="console-panel">
          <div className="panel-head">
            <div>
              <p className="console-kicker">Cycles ouverts</p>
              <h2>
                {cycles.length} cycle{cycles.length > 1 ? "s" : ""} · {versions.length} version
                {versions.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>

          {cycles.length === 0 ? (
            <p className="console-empty">
              {manages
                ? "Aucun cycle budgétaire. Créez le premier pour ouvrir une version candidate."
                : "Aucun cycle budgétaire n’a encore été ouvert par la direction financière."}
            </p>
          ) : (
            cycles.map((cycle) => {
              const cycleVersions = versions.filter((version) => version.cycle_id === cycle.id);
              // Triées du numéro le plus haut au plus bas : la première est la
              // dernière ouverte, et c'est d'elle qu'on repart par défaut.
              const latest = cycleVersions[0];
              const numberOf = (id: string | null): number | null =>
                cycleVersions.find((version) => version.id === id)?.version_no ?? null;

              return (
                <div className="cycle-block" key={cycle.id}>
                  <div className="cycle-head">
                    <div>
                      <h2>{cycle.name}</h2>
                      <span className="state-tag" data-tone="attente">
                        {CYCLE_STATUSES[cycle.status] ?? cycle.status}
                      </span>
                    </div>
                    {manages ? (
                      <form action={createBudgetVersion} className="version-opener">
                        <input type="hidden" name="cycle_id" value={cycle.id} />
                        {/* UN choix : repartir d'une version du cycle — ses
                            hypothèses sont reprises, son modèle hérité — ou
                            ouvrir une version vide sur un modèle. Le modèle
                            décide de ce que le moteur saura faire et ne se
                            change plus une fois des hypothèses déposées ; un
                            second sélecteur aurait permis de le contredire. */}
                        <label className="visually-hidden" htmlFor={`origin-${cycle.id}`}>
                          Origine de la version
                        </label>
                        <select
                          id={`origin-${cycle.id}`}
                          name="origin"
                          defaultValue={
                            latest
                              ? versionOriginValue({ kind: "resume", sourceVersionId: latest.id })
                              : versionOriginValue({ kind: "empty", model: "direct" })
                          }
                        >
                          {cycleVersions.map((version) => (
                            <option
                              key={version.id}
                              value={versionOriginValue({ kind: "resume", sourceVersionId: version.id })}
                            >
                              Reprendre la version {version.version_no} —{" "}
                              {calculationModelLabel(version.calculation_model)} ·{" "}
                              {versionStatusLabel(version.status)}
                            </option>
                          ))}
                          {CALCULATION_MODELS.map((model) => (
                            <option key={model} value={versionOriginValue({ kind: "empty", model })}>
                              Version vide — {calculationModelLabel(model)}
                            </option>
                          ))}
                        </select>
                        <button className="console-button" data-variant="discret" type="submit">
                          Ouvrir une version
                        </button>
                      </form>
                    ) : null}
                  </div>

                  {cycleVersions.length === 0 ? (
                    <p className="console-empty">
                      Aucune version candidate dans ce cycle pour l’instant.
                    </p>
                  ) : (
                    <div className="table-scroll">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th scope="col">Version</th>
                            <th scope="col">État</th>
                            <th scope="col">Ouverte le</th>
                            <th scope="col">
                              <span className="visually-hidden">Ouvrir</span>
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {cycleVersions.map((version) => (
                            <tr key={version.id}>
                              <td className="dimension-cell">
                                <strong>Version {version.version_no}</strong>
                                <span>
                                  {calculationModelLabel(version.calculation_model)}
                                  {version.parent_version_id
                                    ? ` · reprise de la version ${numberOf(version.parent_version_id) ?? "?"}`
                                    : ""}
                                </span>
                              </td>
                              <td>
                                <span
                                  className="state-tag"
                                  data-tone={versionStatusTone(version.status)}
                                >
                                  {versionStatusLabel(version.status)}
                                </span>
                              </td>
                              <td>{new Date(version.created_at).toLocaleDateString("fr-FR")}</td>
                              <td className="row-actions">
                                <Link
                                  className="console-button"
                                  data-variant="discret"
                                  href={`/app/budgets/${version.id}`}
                                >
                                  Ouvrir
                                </Link>
                                {/* La consolidation est réservée au DAF et au DG :
                                    proposer le lien à un contributeur le mènerait
                                    à une redirection, pas à un écran. */}
                                {canManageFinance(context) ? (
                                  <Link
                                    className="console-button"
                                    data-variant="discret"
                                    href={`/app/consolidation/${version.id}`}
                                  >
                                    Consolidation
                                  </Link>
                                ) : null}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </div>
    </main>
  );
}
