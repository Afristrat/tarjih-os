import { expect, test, type Page } from "@playwright/test";

import { CONTRIBUTEUR, DAF, DG, connecter, surveillerLaConsole } from "./acteurs.ts";
import { enCentimes, lire, somme } from "./montants.ts";

/**
 * « D'où vient ce chiffre » — vérifié dans un navigateur, sur le domaine déployé.
 *
 * Le parcours vertical prouve qu'une hypothèse non approuvée n'entre pas dans un
 * chiffre. Il ne prouve rien sur l'ORIGINE d'un chiffre, parce qu'il ne publie
 * qu'une seule hypothèse : une part unique égale forcément son total, et un
 * écran qui se tromperait de part passerait sans qu'on le voie.
 *
 * Ce fichier publie donc DEUX hypothèses approuvées sur le MÊME compte et la
 * MÊME période. Le moteur Python doit alors faire trois choses distinctes, et
 * chacune est contrôlée ici :
 *
 *   1. les agréger en UN seul montant — pas deux lignes ;
 *   2. arrondir UNE fois, à la somme, et jamais chaque part ;
 *   3. rendre la part de chacune, exacte, pour que l'écran puisse la montrer.
 *
 * Le contrôle qui compte est le dernier : **la somme des parts affichées doit
 * égaler le montant affiché**. Un DAF qui déplie l'origine d'un chiffre fait
 * cette addition de tête ; si elle ne tombe pas juste, il cesse de croire
 * l'outil — et il a raison, puisque l'écran lui aurait menti.
 *
 * Les montants portent trois décimales exprès : c'est là que l'affichage à deux
 * décimales trahit, et c'est un cas ordinaire en comptabilité analytique.
 */

const MARQUE = Date.now();

const CODE_COMPTE = `TRC${MARQUE}`;
const NOM_COMPTE = `Charge de traçabilité ${MARQUE}`;
const NOM_CYCLE = `Traçabilité ${MARQUE}`;

/** Décalée à chaque exécution : `unique (tenant, starts_on, ends_on)`. */
const JOUR = new Date(Date.UTC(2029, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Deux charges sur le même compte et la même période : elles s'additionnent. */
const CHARGES = [
  { montant: "10,005", parametre: "trace_premiere" },
  { montant: "20,005", parametre: "trace_seconde" },
] as const;

/** 10,005 + 20,005 = 30,010 — arrondi une seule fois, à la somme. */
const TOTAL_ATTENDU_EN_CENTIMES = 3001;

let adresseVersion = "";

function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

test.describe.configure({ mode: "serial" });

test.describe("Un montant publié dit de quelles hypothèses il vient", () => {
  test("le DAF pose un compte et une période pour ce parcours", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/settings/reference", { waitUntil: "domcontentloaded" });

    const compte = formulaire(page, "Créer le compte");
    await compte.locator('input[name="name"]').fill(NOM_COMPTE);
    await compte.locator('input[name="code"]').fill(CODE_COMPTE);
    await compte.locator('select[name="statement"]').selectOption("income_statement");
    await compte.locator('select[name="normal_balance"]').selectOption("debit");
    await compte.getByRole("button", { name: "Créer le compte" }).click();
    await expect(page.getByRole("cell", { name: NOM_COMPTE })).toBeVisible();

    const periode = formulaire(page, "Créer la période");
    await periode.locator('input[name="starts_on"]').fill(JOUR);
    await periode.locator('input[name="ends_on"]').fill(JOUR);
    await periode.getByRole("button", { name: "Créer la période" }).click();
    await expect(page.getByRole("cell", { name: JOUR, exact: true }).first()).toBeVisible();

    expect(erreurs(), "erreurs de console sur l'écran du référentiel").toEqual([]);
  });

  test("le DAF ouvre un cycle et une version", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });
    const cycle = formulaire(page, "Créer le cycle");
    await cycle.locator('input[name="name"]').fill(NOM_CYCLE);
    await cycle.getByRole("button", { name: "Créer le cycle" }).click();
    await expect(page.getByRole("heading", { name: NOM_CYCLE })).toBeVisible();

    const bloc = page.locator(".cycle-block").filter({ hasText: NOM_CYCLE });
    await expect(bloc, "le bloc du cycle créé n'est pas identifiable seul").toHaveCount(1);
    await bloc.getByRole("button", { name: "Ouvrir une version" }).click();

    await expect(page).toHaveURL(/\/app\/budgets\/[0-9a-f-]{36}/);
    adresseVersion = new URL(page.url()).pathname;

    expect(erreurs(), "erreurs de console sur l'écran des cycles").toEqual([]);
  });

  test("le contributeur propose deux charges sur le même compte et la même période", async ({
    page,
  }) => {
    expect(adresseVersion, "l'étape précédente n'a pas livré de version").not.toEqual("");

    const erreurs = surveillerLaConsole(page);
    await connecter(page, CONTRIBUTEUR);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });

    for (const charge of CHARGES) {
      const proposition = formulaire(page, "Proposer");
      await proposition.locator('input[name="parameter_key"]').fill(charge.parametre);
      await proposition.locator('select[name="account_code"]').selectOption(CODE_COMPTE);
      await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
      await proposition.locator('input[name="value"]').fill(charge.montant);
      await proposition.getByRole("button", { name: "Proposer" }).click();

      await expect(page.getByRole("cell", { name: charge.parametre })).toBeVisible();
    }

    await expect(page.getByText("Non calculable — à ressaisir")).toHaveCount(0);
    expect(erreurs(), "erreurs de console sur l'écran de la version").toEqual([]);
  });

  test("le DAF approuve les deux", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    for (const charge of CHARGES) {
      await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
      await page
        .getByRole("row", { name: new RegExp(charge.parametre) })
        .getByRole("link", { name: "Détail" })
        .click();

      const decision = formulaire(page, "Enregistrer la décision");
      await decision.locator('select[name="decision"]').selectOption("approved");
      await decision
        .locator('textarea[name="reason"]')
        .fill("Recette de traçabilité : les deux charges entrent dans le même montant.");
      await decision.getByRole("button", { name: "Enregistrer la décision" }).click();

      await expect(
        page.getByText("Décision enregistrée", { exact: false }),
        `la décision sur ${charge.parametre} n'a pas été inscrite`,
      ).toBeVisible();
    }

    expect(erreurs(), "erreurs de console sur l'écran de décision").toEqual([]);
  });

  test("le DG publie, et le chiffre publié dit d'où il vient sans mentir sur l'addition", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);

    const versionId = adresseVersion.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();
    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();

    // 1. Le moteur a AGRÉGÉ : deux hypothèses sur un triplet font une ligne.
    const lignes = page.locator("table.data-table tbody tr");
    await expect(
      lignes,
      "deux hypothèses visant le même compte et la même période ont produit deux lignes au lieu d'une",
    ).toHaveCount(1);

    // 2. Le moteur a arrondi UNE fois, à la somme : 10,005 + 20,005 = 30,01.
    const montantAffiche = await lignes.first().locator("td.amount-cell").textContent();
    expect(
      enCentimes(lire(montantAffiche)),
      "le montant publié n'est pas la somme des deux charges arrondie une seule fois",
    ).toBe(TOTAL_ATTENDU_EN_CENTIMES);

    // 3. L'origine nomme les DEUX hypothèses.
    const depliant = lignes.first().locator("details.origin-details > summary");
    await expect(depliant, "le nombre d'hypothèses d'origine n'est pas annoncé").toHaveText(
      "2 hypothèses",
    );
    await depliant.click();

    const parts = lignes.first().locator(".origin-list li");
    await expect(parts, "l'origine ne nomme pas les deux hypothèses").toHaveCount(2);
    for (const charge of CHARGES) {
      await expect(
        lignes.first().locator(".origin-list"),
        `l'origine ne cite pas ${charge.parametre}`,
      ).toContainText(charge.parametre);
    }

    // 4. LE CONTRÔLE QUI COMPTE : l'addition que le lecteur fait de tête tombe
    //    juste. Des parts qui ne somment pas à leur total sont pires qu'une
    //    absence d'origine — elles font douter du chiffre lui-même.
    const partsAffichees = await parts.locator(".origin-share").allTextContents();
    expect(
      enCentimes(somme(partsAffichees)),
      `les parts affichées (${partsAffichees.join(" + ")}) ne s'additionnent pas au montant` +
        ` affiché (${montantAffiche?.trim()})`,
    ).toBe(TOTAL_ATTENDU_EN_CENTIMES);

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });
});
