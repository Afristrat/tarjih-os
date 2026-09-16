import type { ReactElement } from "react";

import { approveIdentical } from "@/app/app/consolidation/[versionId]/actions";
import { formatAmount, percentChange, subtractAmounts, sumAmounts } from "@/lib/budgets/amounts";
import {
  countApprovable,
  summarizeOutcomes,
  type ComparedVersion,
  type ComparisonOutcome,
  type HypothesisComparison,
  type ValueComparison,
} from "@/lib/budgets/comparison";
import {
  formatHypothesisValue,
  hypothesisStatusLabel,
  hypothesisStatusTone,
  versionStatusLabel,
} from "@/lib/budgets/scope";

/**
 * « Qu'est-ce qui a changé depuis la version N ? »
 *
 * Deux niveaux, calculés en base par `compare_version_hypotheses` et
 * `compare_version_values` (`security invoker` : le périmètre du lecteur
 * s'applique tout seul). Le premier dit POURQUOI — les termes d'une hypothèse,
 * jamais un produit recalculé ici ; le second dit COMBIEN — les montants
 * publiés, delta et variation, seulement entre deux versions publiées.
 *
 * Le niveau 1 porte aussi le geste « approuver l'identique » : ce que la
 * version de base a approuvé et que cette version reprend à l'identique n'a
 * pas à être ressaisi ni relu ligne à ligne — mais reste une décision par
 * ligne, au nom de celui qui clique.
 */

type Labels = {
  accountBalances: ReadonlyMap<string, string>;
  accountLabels: ReadonlyMap<string, string>;
  dimensionNames: ReadonlyMap<string, string>;
  periodLabels: ReadonlyMap<string, string>;
};

const OUTCOME_LABELS: Record<ComparisonOutcome, string> = {
  added: "Ajoutée",
  changed: "Modifiée",
  identical: "Identique",
  removed: "Retirée ou rejetée",
};

const OUTCOME_TONES: Record<ComparisonOutcome, "acquis" | "attente" | "refus"> = {
  added: "attente",
  changed: "attente",
  identical: "acquis",
  removed: "refus",
};

function formatAmountOrAbsent(amount: string | null, currency: string): string {
  return amount === null ? "—" : formatAmount(amount, currency);
}

/**
 * Une variation à UNE décimale, toujours. La base la calcule ainsi et la
 * requête la demande en texte (`delta_percent::text`) ; la décimale est
 * complétée par sûreté, pas par nécessité.
 */
function formatPercent(percent: string | null): string {
  if (percent === null) {
    return "—";
  }
  const [entier, decimales = ""] = percent.split(".");
  return `${entier},${(decimales + "0").slice(0, 1)} %`;
}

function HypothesisSide({
  status,
  unit,
  value,
}: {
  status: string | null;
  unit: string | null;
  value: unknown;
}): ReactElement {
  if (status === null) {
    return <span className="ecart-absent">—</span>;
  }

  return (
    <>
      <span className="ecart-terms">
        {formatHypothesisValue(value)}
        {unit ? ` ${unit}` : ""}
      </span>{" "}
      <span className="state-tag" data-tone={hypothesisStatusTone(status)}>
        {hypothesisStatusLabel(status)}
      </span>
    </>
  );
}

/**
 * Totaux d'un côté : produits, charges, résultat — le sens vient du compte,
 * jamais du signe du montant. `null` quand un montant est illisible.
 */
function totalsOf(
  rows: readonly ValueComparison[],
  side: "baseAmount" | "targetAmount",
  accountBalances: ReadonlyMap<string, string>,
): { charges: string | null; produits: string | null; resultat: string | null } {
  const produits: string[] = [];
  const charges: string[] = [];
  for (const row of rows) {
    const amount = row[side];
    if (amount === null) {
      continue;
    }
    (accountBalances.get(row.accountId) === "credit" ? produits : charges).push(amount);
  }

  const totalProduits = sumAmounts(produits);
  const totalCharges = sumAmounts(charges);
  return {
    charges: totalCharges,
    produits: totalProduits,
    resultat:
      totalProduits !== null && totalCharges !== null
        ? subtractAmounts(totalProduits, totalCharges)
        : null,
  };
}

function TotalRow({
  base,
  currency,
  label,
  target,
}: {
  base: string | null;
  currency: string;
  label: string;
  target: string | null;
}): ReactElement {
  const delta = base !== null && target !== null ? subtractAmounts(target, base) : null;
  const percent = base !== null && target !== null ? percentChange(base, target) : null;

  return (
    <tr className={label === "Résultat" ? "result-row" : undefined}>
      <th colSpan={3} scope="row">
        {label}
      </th>
      <td className="amount-cell">{formatAmountOrAbsent(base, currency)}</td>
      <td className="amount-cell">{formatAmountOrAbsent(target, currency)}</td>
      <td className="amount-cell">{formatAmountOrAbsent(delta, currency)}</td>
      <td className="amount-cell">{formatPercent(percent)}</td>
    </tr>
  );
}

export function Ecart({
  base,
  currency,
  hypotheses,
  labels,
  siblings,
  target,
  values,
}: {
  /** `null` : cette version ne descend d'aucune autre et rien n'a été demandé. */
  base: ComparedVersion | null;
  currency: string;
  hypotheses: readonly HypothesisComparison[];
  labels: Labels;
  /** Les autres versions du cycle, pour changer de base. */
  siblings: readonly ComparedVersion[];
  target: ComparedVersion;
  values: readonly ValueComparison[] | null;
}): ReactElement {
  // Une requête GET ordinaire : l'adresse dit avec quoi on compare, et se
  // partage telle quelle. Sans script.
  const selector = (
    <form className="version-opener" method="get">
      <label className="visually-hidden" htmlFor="ecart-with">
        Version de comparaison
      </label>
      <select id="ecart-with" name="with" defaultValue={base?.id ?? ""}>
        {base ? null : (
          <option value="" disabled>
            Choisir une version
          </option>
        )}
        {siblings.map((sibling) => (
          <option key={sibling.id} value={sibling.id}>
            Version {sibling.versionNo} — {versionStatusLabel(sibling.status)}
          </option>
        ))}
      </select>
      <button className="console-button" type="submit">
        Comparer
      </button>
    </form>
  );

  if (!base) {
    return (
      <section className="console-panel" aria-labelledby="ecart-title">
        <div className="panel-head">
          <div>
            <p className="console-kicker">Écart</p>
            <h2 id="ecart-title">Comparer avec une autre version</h2>
          </div>
          {selector}
        </div>
        <p className="console-empty">
          Cette version ne descend d’aucune autre : choisissez la version à laquelle la comparer.
        </p>
      </section>
    );
  }

  const sameInputs =
    base.inputHash !== null && target.inputHash !== null && base.inputHash === target.inputHash;
  const approvable = countApprovable(hypotheses);
  const bothPublished = base.status === "published" && target.status === "published";
  const baseTotals = values ? totalsOf(values, "baseAmount", labels.accountBalances) : null;
  const targetTotals = values ? totalsOf(values, "targetAmount", labels.accountBalances) : null;

  return (
    <section className="console-panel" aria-labelledby="ecart-title">
      <div className="panel-head">
        <div>
          <p className="console-kicker">Écart</p>
          <h2 id="ecart-title">
            Par rapport à la version {base.versionNo}{" "}
            <span className="state-tag" data-tone={base.status === "published" ? "acquis" : "attente"}>
              {versionStatusLabel(base.status)}
            </span>
          </h2>
        </div>
        {selector}
      </div>

      {sameInputs ? (
        <p className="console-notice" data-tone="fait" role="status">
          Mêmes entrées : les deux versions ont été calculées sur des hypothèses identiques
          (empreinte <span className="hash-value">{target.inputHash}</span>). Leurs montants
          sont les mêmes.
        </p>
      ) : null}

      <h3 className="ecart-level">Hypothèses</h3>
      {hypotheses.length === 0 ? (
        <p className="console-empty">Aucune hypothèse de part ni d’autre, dans votre périmètre.</p>
      ) : (
        <>
          <p className="ecart-summary">{summarizeOutcomes(hypotheses)}</p>
          <div className="table-scroll">
            <table className="data-table ecart-table">
              <thead>
                <tr>
                  <th scope="col">Dimension</th>
                  <th scope="col">Paramètre</th>
                  <th scope="col">Version {base.versionNo}</th>
                  <th scope="col">Version {target.versionNo}</th>
                  <th scope="col">Écart</th>
                </tr>
              </thead>
              <tbody>
                {hypotheses.map((row) => (
                  <tr key={`${row.dimensionId}-${row.parameterKey}`} data-outcome={row.outcome}>
                    <td className="dimension-cell">
                      <strong>{labels.dimensionNames.get(row.dimensionId) ?? "—"}</strong>
                    </td>
                    <td>{row.parameterKey}</td>
                    <td>
                      <HypothesisSide
                        status={row.baseStatus}
                        unit={row.baseUnit}
                        value={row.baseValue}
                      />
                    </td>
                    <td>
                      <HypothesisSide
                        status={row.targetStatus}
                        unit={row.targetUnit}
                        value={row.targetValue}
                      />
                    </td>
                    <td>
                      <span className="state-tag" data-tone={OUTCOME_TONES[row.outcome]}>
                        {OUTCOME_LABELS[row.outcome]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {target.status !== "published" && approvable > 0 ? (
        <form className="console-form ecart-approve" action={approveIdentical}>
          <input type="hidden" name="version_id" value={target.id} />
          <input type="hidden" name="base_version_id" value={base.id} />
          <label htmlFor="ecart-reason">
            Motif, inscrit sur chaque décision
            <input
              id="ecart-reason"
              name="reason"
              required
              maxLength={500}
              defaultValue={`Identique à la version ${base.versionNo}, approuvée`}
            />
          </label>
          <button className="console-button" type="submit">
            Approuver {approvable === 1 ? "la ligne identique" : `les ${approvable} lignes identiques`}
          </button>
          <p className="console-hint">
            Une décision par ligne, en votre nom, sur les seules dimensions où vous approuvez.
            Les lignes modifiées ou ajoutées se décident une à une.
          </p>
        </form>
      ) : null}

      <h3 className="ecart-level">Montants publiés</h3>
      {!bothPublished ? (
        <p className="console-empty">
          Les montants ne se comparent qu’entre deux versions publiées : un montant non publié
          n’existe pas.
        </p>
      ) : values === null || values.length === 0 ? (
        <p className="console-empty">Aucun montant publié de part ni d’autre, dans votre périmètre.</p>
      ) : (
        <div className="table-scroll">
          <table className="data-table ecart-table">
            <thead>
              <tr>
                <th scope="col">Dimension</th>
                <th scope="col">Compte</th>
                <th scope="col">Période</th>
                <th className="amount-cell" scope="col">
                  Version {base.versionNo}
                </th>
                <th className="amount-cell" scope="col">
                  Version {target.versionNo}
                </th>
                <th className="amount-cell" scope="col">
                  Écart
                </th>
                <th className="amount-cell" scope="col">
                  Variation
                </th>
              </tr>
            </thead>
            <tbody>
              {values.map((row) => (
                <tr key={`${row.dimensionId}-${row.accountId}-${row.periodId}`}>
                  <td className="dimension-cell">
                    <strong>{labels.dimensionNames.get(row.dimensionId) ?? "—"}</strong>
                  </td>
                  <td>{labels.accountLabels.get(row.accountId) ?? "—"}</td>
                  <td>{labels.periodLabels.get(row.periodId) ?? "—"}</td>
                  <td className="amount-cell">{formatAmountOrAbsent(row.baseAmount, row.currency)}</td>
                  <td className="amount-cell">{formatAmountOrAbsent(row.targetAmount, row.currency)}</td>
                  <td className="amount-cell">{formatAmountOrAbsent(row.delta, row.currency)}</td>
                  <td className="amount-cell">{formatPercent(row.deltaPercent)}</td>
                </tr>
              ))}
            </tbody>
            {baseTotals && targetTotals ? (
              <tfoot>
                <TotalRow
                  base={baseTotals.produits}
                  currency={currency}
                  label="Total des produits"
                  target={targetTotals.produits}
                />
                <TotalRow
                  base={baseTotals.charges}
                  currency={currency}
                  label="Total des charges"
                  target={targetTotals.charges}
                />
                <TotalRow
                  base={baseTotals.resultat}
                  currency={currency}
                  label="Résultat"
                  target={targetTotals.resultat}
                />
              </tfoot>
            ) : null}
          </table>
        </div>
      )}
    </section>
  );
}
