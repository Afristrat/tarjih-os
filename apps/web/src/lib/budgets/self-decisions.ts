/**
 * Séparation des devoirs : rendue visible, pas imposée.
 *
 * `decide_hypothesis` n'exige que la permission `approve` sur la dimension ;
 * rien n'empêche l'auteur d'une ligne de l'approuver lui-même. L'interdire
 * bloquerait un tenant à un seul membre — le cas réel au 2026-09-16 — et
 * décider à sa place ce qu'un DAF a le droit de faire n'est pas le rôle de
 * l'outil. Ce que l'outil doit, c'est le DIRE : partout où une décision se
 * lit, une ligne décidée par son propre auteur le porte en clair.
 */

export type ProposedRow = {
  id: string;
  proposed_by: string;
};

export type DecidedRow = {
  decided_by: string;
  hypothesis_id: string;
};

/**
 * Les identifiants des hypothèses dont AU MOINS UNE décision a été prise par
 * leur auteur. Une décision qui ne vise aucune hypothèse connue est ignorée.
 */
export function selfDecidedHypotheses(
  hypotheses: readonly ProposedRow[],
  decisions: readonly DecidedRow[],
): Set<string> {
  const authors = new Map(hypotheses.map((row) => [row.id, row.proposed_by]));
  const marked = new Set<string>();

  for (const decision of decisions) {
    if (authors.get(decision.hypothesis_id) === decision.decided_by) {
      marked.add(decision.hypothesis_id);
    }
  }

  return marked;
}

/** Le libellé du badge, unique pour que la recette et l'écran disent la même chose. */
export const SELF_DECIDED_LABEL = "Décidée par son auteur";
