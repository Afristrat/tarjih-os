/**
 * Contrôles de l'export soumis au RBAC.
 *
 * Le danger propre à un export n'est pas qu'il montre trop à l'écran : c'est
 * qu'il EMPORTE trop dans un fichier, où plus aucune règle ne s'applique. Ces
 * contrôles portent donc sur les deux choses que l'on ne peut plus rattraper
 * une fois le fichier remis — ce qu'il contient, et le fait qu'il soit le même
 * à chaque fois.
 */

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { strFromU8, strToU8, unzipSync, zipSync } from "fflate";

import type { ActiveTenantContext } from "../src/lib/auth/session.ts";
import type { DimensionGrantRow, DimensionRow } from "../src/lib/budgets/scope.ts";
import { exportableDimensions, scopeHash } from "../src/lib/exports/scope.ts";
import { buildWorkbook, figerLArchive, type ExportRow } from "../src/lib/exports/workbook.ts";

const VERSION = "11111111-1111-4111-8111-111111111111";

const AUTORISEE = "22222222-2222-4222-8222-222222222222";
const LISIBLE_NON_EXPORTABLE = "33333333-3333-4333-8333-333333333333";
const HORS_PERIMETRE = "44444444-4444-4444-8444-444444444444";

function contexte(role: ActiveTenantContext["role"]): ActiveTenantContext {
  return {
    baseCurrency: "MAD",
    isTenantAdmin: false,
    name: "Tenant d'essai",
    role,
    tenantId: "55555555-5555-4555-8555-555555555555",
    userEmail: "essai@tarjih.test",
    userId: "66666666-6666-4666-8666-666666666666",
  };
}

const DIMENSIONS: DimensionRow[] = [
  { code: "OPS", id: AUTORISEE, kind: "department", name: "Opérations" },
  { code: "RD", id: LISIBLE_NON_EXPORTABLE, kind: "department", name: "Recherche" },
  { code: "COM", id: HORS_PERIMETRE, kind: "department", name: "Commercial" },
];

// Le cas qui compte : une dimension que le contributeur a le droit de LIRE mais
// pas d'exporter. La RLS de `budget_values` porte sur `read` — elle laisserait
// donc passer cette ligne. C'est ici, et seulement ici, que la distinction se
// fait.
const GRANTS: DimensionGrantRow[] = [
  {
    can_approve: false,
    can_contribute: true,
    can_export: true,
    can_read: true,
    dimension_id: AUTORISEE,
  },
  {
    can_approve: false,
    can_contribute: true,
    can_export: false,
    can_read: true,
    dimension_id: LISIBLE_NON_EXPORTABLE,
  },
];

function ligne(dimension: string, montant: string): ExportRow {
  return {
    account: "61 · Charges externes",
    amount: montant,
    currency: "MAD",
    dimension,
    dimensionId: dimension === "Opérations" ? AUTORISEE : LISIBLE_NON_EXPORTABLE,
    period: "2026-01-01 → 2026-03-31",
  };
}

/** Tout le texte du classeur, entrée par entrée — feuilles, caches, propriétés. */
function texteDuClasseur(fichier: Buffer): string {
  const entrees = unzipSync(new Uint8Array(fichier));
  return Object.values(entrees)
    .map((contenu) => strFromU8(contenu))
    .join("\n");
}

test("un contributeur n'exporte que les dimensions où il a le droit d'exporter", () => {
  const autorisees = exportableDimensions(contexte("contributor"), GRANTS, DIMENSIONS);

  assert.deepEqual(
    autorisees.map((dimension) => dimension.id),
    [AUTORISEE],
    "une dimension lisible mais non exportable ne doit pas entrer dans le fichier",
  );
});

test("un DAF exporte toutes les dimensions du tenant", () => {
  for (const role of ["daf", "dg"] as const) {
    const autorisees = exportableDimensions(contexte(role), [], DIMENSIONS);
    assert.equal(autorisees.length, DIMENSIONS.length, `${role} exporte tout son tenant`);
  }
});

test("l'empreinte de périmètre distingue deux périmètres différents", () => {
  const large = scopeHash(VERSION, [AUTORISEE, LISIBLE_NON_EXPORTABLE]);
  const etroit = scopeHash(VERSION, [AUTORISEE]);

  assert.notEqual(large, etroit);
  assert.match(large, /^[0-9a-f]{64}$/, "la colonne `scope_hash` impose un sha256 minuscule");
});

test("l'empreinte de périmètre ne dépend pas de l'ordre de lecture", () => {
  assert.equal(
    scopeHash(VERSION, [AUTORISEE, LISIBLE_NON_EXPORTABLE]),
    scopeHash(VERSION, [LISIBLE_NON_EXPORTABLE, AUTORISEE]),
  );
});

function empreinte(octets: Uint8Array): string {
  return createHash("sha256").update(octets).digest("hex");
}

test("deux exports du même périmètre rendent le même fichier, à l'octet près", async () => {
  const lignes = [ligne("Opérations", "1000.500000")];

  const premier = await buildWorkbook(lignes);
  const second = await buildWorkbook(lignes);

  assert.equal(
    empreinte(premier),
    empreinte(second),
    "`prd.md:122` exige que l'export d'un même snapshot soit reproductible ;" +
      " sans cela `exports.file_hash` ne permet de vérifier aucun fichier reçu",
  );
});

// Le contrôle ci-dessus ne suffit PAS, et l'avoir cru serait l'erreur : deux
// générations successives tombent dans la même seconde, or l'horodatage du
// format ZIP a une granularité de deux secondes. Il reste donc vert même sans
// aucune normalisation — vérifié en falsifiant. Celui-ci porte la propriété
// réelle : deux archives de contenu identique mais datées différemment doivent
// devenir le même fichier.
test("la normalisation efface un écart de dates entre deux archives identiques", () => {
  const contenu = strToU8("<x/>");
  const tot = zipSync({ "a.xml": [contenu, { mtime: new Date(Date.UTC(2020, 0, 1)) }] });
  const tard = zipSync({ "a.xml": [contenu, { mtime: new Date(Date.UTC(2026, 5, 2, 3, 4, 5)) }] });

  assert.notEqual(
    empreinte(tot),
    empreinte(tard),
    "témoin : sans normalisation, la date suffit à changer le fichier",
  );
  assert.equal(empreinte(figerLArchive(tot)), empreinte(figerLArchive(tard)));

  // Ne pas dépendre des dates d'ENTRÉE ne suffit toujours pas : une
  // normalisation qui écrirait la date COURANTE passerait les deux contrôles
  // ci-dessus, tout en produisant deux fichiers différents à trois secondes
  // d'écart — exactement ce que l'invariant interdit. Cette valeur de référence
  // est le seul contrôle qui l'attrape sans faire attendre la suite : elle
  // change dès que la date écrite cesse d'être une constante.
  assert.equal(
    empreinte(figerLArchive(tot)),
    "325b38a5e8329575111c52a081460345a2b9c7236716b1cee552f0bddeb57d65",
    "l'archive normalisée doit être la MÊME à tout instant, pas seulement" +
      " indépendante de la date qu'elle portait",
  );
});

test("aucune donnée hors périmètre ne survit dans le fichier, cache compris", async () => {
  const fichier = await buildWorkbook([ligne("Opérations", "1000.500000")]);
  const texte = texteDuClasseur(fichier);

  assert.ok(texte.includes("Opérations"), "le témoin : ce qui est autorisé est bien là");
  for (const interdit of ["Recherche", "Commercial", "999999"]) {
    assert.ok(
      !texte.includes(interdit),
      `« ${interdit} » ne doit apparaître dans AUCUNE entrée du classeur —` +
        " ni feuille, ni cache de chaînes, ni propriété",
    );
  }
});

test("le classeur ne porte aucune métadonnée d'auteur ni de date", async () => {
  const fichier = await buildWorkbook([ligne("Opérations", "1000.500000")]);
  const entrees = Object.keys(unzipSync(new Uint8Array(fichier)));

  assert.deepEqual(
    entrees.filter((nom) => nom.startsWith("docProps")),
    [],
    "`docProps` porterait un auteur et des horodatages, que rien ne justifie ici",
  );
});

test("une valeur qui ressemble à une formule reste du texte", async () => {
  // Un libellé venu de la saisie peut commencer par « = ». Écrit comme formule,
  // il serait ÉVALUÉ à l'ouverture du fichier — c'est le vecteur classique
  // d'exfiltration par tableur, et le critère « aucune formule » de la task.
  const fichier = await buildWorkbook([
    { ...ligne("Opérations", "1000.500000"), dimension: '=HYPERLINK("http://exemple.test")' },
  ]);
  const entrees = unzipSync(new Uint8Array(fichier));
  const feuille = strFromU8(entrees["xl/worksheets/sheet1.xml"]);

  assert.ok(!feuille.includes("<f>"), "aucune cellule ne doit porter de formule");
});

test("un montant garde toutes ses décimales, sans passer par un flottant", async () => {
  const fichier = await buildWorkbook([ligne("Opérations", "10.005000")]);
  const texte = texteDuClasseur(fichier);

  assert.ok(
    texte.includes("10.005000"),
    "un montant publié est un numeric(24,6) : l'export le transporte tel quel",
  );
});
