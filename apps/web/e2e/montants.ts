/**
 * Lecture et addition exactes des montants affichés par l'interface.
 *
 * Ces fonctions décident du verdict de la recette : si elles se trompent, le
 * test se trompe avec elles, et dans le sens le plus dangereux — il déclarerait
 * juste une addition fausse. Elles sont donc à part, et sous tests unitaires
 * (`tests/montants-affiches.test.ts`).
 */

/**
 * Espaces que `Intl` insère entre les milliers et devant la devise : espace
 * insécable (U+00A0) et espace insécable étroite (U+202F). Nommées plutôt que
 * collées dans une classe de caractères, où elles seraient invisibles à la
 * relecture — et où une correction les supprimerait sans le savoir.
 */
const ESPACES = /[\s  ]/g;

export type MontantLu = {
  echelle: number;
  valeur: bigint;
};

/**
 * Lit un montant affiché, à la précision qu'il porte.
 *
 * `bigint` et non `Number` : additionner des flottants pour vérifier qu'une
 * addition affichée tombe juste reviendrait à mesurer l'outil avec l'erreur
 * même qu'il doit détecter. Une part n'a pas de précision fixe — c'est tout
 * l'objet de la table des origines — donc l'échelle est LUE, jamais supposée.
 */
export function lire(texte: string | null): MontantLu {
  const nettoye = (texte ?? "").replace(ESPACES, "");
  const trouve = nettoye.match(/(-?)(\d+)(?:[,.](\d+))?/);
  if (!trouve) {
    throw new Error(`montant illisible : « ${texte} »`);
  }

  const decimales = trouve[3] ?? "";
  return {
    echelle: decimales.length,
    valeur: BigInt(`${trouve[1]}${trouve[2]}${decimales}`),
  };
}

/** Somme exacte de plusieurs montants, quelles que soient leurs précisions. */
export function somme(textes: string[]): MontantLu {
  if (textes.length === 0) {
    throw new Error("aucun montant à additionner : le contrôle ne mesurerait rien");
  }

  const lus = textes.map((texte) => lire(texte));
  const echelle = Math.max(...lus.map((lu) => lu.echelle));
  const valeur = lus.reduce(
    (total, lu) => total + lu.valeur * BigInt(10) ** BigInt(echelle - lu.echelle),
    BigInt(0),
  );

  return { echelle, valeur };
}

/**
 * Rend un montant en centimes entiers, arrondi comme un montant publié.
 *
 * Arrondi commercial — 0,5 s'éloigne de zéro — la convention du moteur.
 * Comparer avec une autre reviendrait à mesurer le produit avec une règle qui
 * n'est pas la sienne.
 */
export function enCentimes(montant: MontantLu): number {
  if (montant.echelle <= 2) {
    return Number(montant.valeur * BigInt(10) ** BigInt(2 - montant.echelle));
  }

  const diviseur = BigInt(10) ** BigInt(montant.echelle - 2);
  const signe = montant.valeur < BigInt(0) ? -BigInt(1) : BigInt(1);
  const absolu = montant.valeur * signe;

  return Number(signe * ((absolu * BigInt(2) + diviseur) / (diviseur * BigInt(2))));
}
