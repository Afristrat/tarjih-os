/**
 * Génération du classeur d'export, déterministe.
 *
 * Deux exigences pèsent sur ce fichier, et elles ne sont pas cosmétiques :
 *
 * 1. « ne contient aucune donnée interdite, même masquée » (`prd.md:70`). Un
 *    classeur n'est pas qu'un tableau : c'est une archive qui porte aussi un
 *    cache de chaînes (`xl/sharedStrings.xml`) et, chez la plupart des
 *    bibliothèques, des propriétés de document. Une donnée retirée d'une feuille
 *    peut survivre dans l'un de ces recoins. D'où des contrôles qui ouvrent
 *    l'archive entière, entrée par entrée, plutôt que de relire la grille.
 *
 * 2. « l'export d'un même snapshot est reproductible » (`prd.md:122`). Mesuré :
 *    la bibliothèque produit un fichier DIFFÉRENT à chaque appel — seize octets
 *    d'écart, les horodatages que le format ZIP écrit dans chaque en-tête. Sans
 *    correction, `exports.file_hash` ne permettrait de vérifier aucun fichier
 *    reçu, puisqu'une nouvelle génération du même contenu rendrait une autre
 *    empreinte. La normalisation ci-dessous fige ces dates.
 */

import { unzipSync, zipSync } from "fflate";
import writeXlsxFile from "write-excel-file/node";

/** Une ligne de consolidation, telle qu'elle part dans le fichier. */
export type ExportRow = {
  account: string;
  amount: string;
  currency: string;
  dimension: string;
  /** Sert au tri, jamais écrit : l'ordre ne doit pas dépendre d'une locale. */
  dimensionId: string;
  period: string;
};

const EN_TETES = ["Dimension", "Compte", "Période", "Montant", "Devise"] as const;

/**
 * Date figée des entrées de l'archive.
 *
 * Le format ZIP ne code que 1980-2099 : `0` est refusé. Cette borne basse est
 * la convention habituelle pour une archive reproductible, et elle ne dit rien
 * de la date réelle de l'export — celle-ci vit dans `exports.created_at`, à sa
 * place, où elle est datée par la base et non par le fichier.
 */
const DATE_FIGEE = new Date(Date.UTC(1980, 0, 1, 0, 0, 0));

/**
 * Refait l'archive avec des horodatages constants.
 *
 * Les entrées sont réécrites dans un ordre trié : ni l'ordre de production ni
 * les dates ne sont des propriétés du contenu exporté, et les laisser varier
 * ferait varier l'empreinte d'un fichier pourtant identique.
 */
export function figerLArchive(fichier: Uint8Array): Buffer {
  const entrees = unzipSync(fichier);
  const figees: Record<string, [Uint8Array, { mtime: Date }]> = {};

  for (const nom of Object.keys(entrees).sort()) {
    figees[nom] = [entrees[nom], { mtime: DATE_FIGEE }];
  }

  return Buffer.from(zipSync(figees, { level: 6 }));
}

/**
 * Construit le classeur à partir de lignes DÉJÀ filtrées.
 *
 * Ce module ne connaît ni tenant, ni rôle, ni permission : lui confier le
 * filtrage reviendrait à faire dépendre une règle de sécurité de la couche qui
 * met en forme. Le périmètre est décidé dans `scope.ts` et appliqué à la
 * requête ; ici, tout ce qui arrive part dans le fichier.
 *
 * Chaque cellule est écrite en `String`, y compris les montants. Ce n'est pas
 * une facilité : un montant publié est un `numeric(24, 6)`, et le convertir en
 * nombre le ferait transiter par un flottant binaire, où 10,005 cesse d'être
 * 10,005. Un effet de bord heureux : une valeur commençant par « = » reste du
 * texte, là où une cellule de formule serait ÉVALUÉE à l'ouverture du fichier.
 */
export async function buildWorkbook(rows: readonly ExportRow[]): Promise<Buffer> {
  const triees = [...rows].sort((a, b) =>
    `${a.dimensionId}${a.account}${a.period}`.localeCompare(
      `${b.dimensionId}${b.account}${b.period}`,
      "en",
    ),
  );

  const donnees = [
    EN_TETES.map((intitule) => ({ type: String, value: intitule })),
    ...triees.map((row) => [
      { type: String, value: row.dimension },
      { type: String, value: row.account },
      { type: String, value: row.period },
      { type: String, value: row.amount },
      { type: String, value: row.currency },
    ]),
  ];

  const brut = await (await writeXlsxFile(donnees, { sheet: "Consolidation" })).toBuffer();

  return figerLArchive(new Uint8Array(brut));
}
