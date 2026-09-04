import { expect, test, type Page } from "@playwright/test";

import {
  CONTRIBUTEUR,
  DAF,
  DG,
  INTRUS,
  connecter,
  surveillerLaConsole,
} from "./acteurs.ts";

/**
 * Le parcours vertical de Tarjih, joué dans un navigateur, sur le domaine
 * déployé (SOP-011 : jamais un serveur de développement local).
 *
 * Il ne rejoue pas des écrans isolés : il produit un chiffre. Un DAF ouvre le
 * référentiel puis un cycle, un contributeur propose deux hypothèses, une seule
 * est approuvée, un DG calcule et publie. Le montant publié doit valoir
 * exactement l'hypothèse approuvée — et surtout pas la somme des deux, ce qui
 * prouve du même geste qu'une hypothèse restée « proposée » n'entre jamais dans
 * un chiffre officiel.
 *
 * Marqueurs discriminants (SOP-011, étape 6ter) : chaque contrôle porte sur une
 * valeur qui DIFFÈRE selon que l'étape a réussi ou non. Les écrans rendent 200
 * dans les deux cas ; un code HTTP ne prouverait rien.
 *
 * Le jeu de comptes vit dans `supabase/seed/e2e-recette.sql`, dans deux tenants
 * qui ne seront jamais un client. Chaque exécution crée son propre cycle : rien
 * n'écrase rien, et le résidu — une version publiée est immuable — reste à
 * l'écart des données réelles.
 */

/** Marque de l'exécution : les codes et les dates doivent rester uniques. */
const MARQUE = Date.now();

const CODE_COMPTE = `E2E${MARQUE}`;
const NOM_COMPTE = `Charge de recette ${MARQUE}`;
const NOM_CYCLE = `Recette ${MARQUE}`;

/** Une période d'un jour, décalée à chaque exécution : `unique (tenant, starts_on, ends_on)`. */
const JOUR = new Date(Date.UTC(2027, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

const PARAMETRE_APPROUVE = "charge_approuvee";
const PARAMETRE_EN_ATTENTE = "charge_en_attente";

const MONTANT_APPROUVE = "1200,50";
const MONTANT_EN_ATTENTE = "999,99";

/** « 1 200,50 » avec le séparateur de milliers que produit `Intl` en fr-FR. */
const MONTANT_PUBLIE = /1\s?200,50/;
const MONTANT_JAMAIS_PUBLIE = /999,99/;
const SOMME_DES_DEUX = /2\s?200,49/;

/** Renseigné par l'étape 2, consommé par toutes les suivantes. */
let adresseVersion = "";

function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

test.describe.configure({ mode: "serial" });

test.describe("Le parcours vertical produit un chiffre publié", () => {
  test("le DAF pose le référentiel sans lequel aucun calcul n'est possible", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/settings/reference", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Comptes et périodes" })).toBeVisible();

    const compte = formulaire(page, "Créer le compte");
    await compte.locator('input[name="name"]').fill(NOM_COMPTE);
    await compte.locator('input[name="code"]').fill(CODE_COMPTE);
    await compte.locator('select[name="statement"]').selectOption("income_statement");
    await compte.locator('select[name="normal_balance"]').selectOption("debit");
    await compte.getByRole("button", { name: "Créer le compte" }).click();

    // Le compte apparaît dans la table, ou il n'a pas été créé : deux sorties
    // distinctes pour la même page.
    await expect(page.getByRole("cell", { name: NOM_COMPTE })).toBeVisible();

    const periode = formulaire(page, "Créer la période");
    await periode.locator('input[name="starts_on"]').fill(JOUR);
    await periode.locator('input[name="ends_on"]').fill(JOUR);
    await periode.getByRole("button", { name: "Créer la période" }).click();

    await expect(page.getByRole("cell", { name: JOUR, exact: true }).first()).toBeVisible();
    expect(erreurs(), "erreurs de console sur l'écran du référentiel").toEqual([]);
  });

  test("le DAF ouvre un cycle et une version candidate", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });
    const cycle = formulaire(page, "Créer le cycle");
    await cycle.locator('input[name="name"]').fill(NOM_CYCLE);
    await cycle.getByRole("button", { name: "Créer le cycle" }).click();

    await expect(page.getByRole("heading", { name: NOM_CYCLE })).toBeVisible();

    // `.cycle-block` est le seul conteneur qui borne UN cycle. Un sélecteur plus
    // large (un `div` quelconque portant le nom) engloberait aussi la liste
    // entière, et « Ouvrir une version » ouvrirait alors une version dans le
    // mauvais cycle sans que rien ne le signale.
    const bloc = page.locator(".cycle-block").filter({ hasText: NOM_CYCLE });
    await expect(bloc, "le bloc du cycle créé n'est pas identifiable seul").toHaveCount(1);
    await bloc.getByRole("button", { name: "Ouvrir une version" }).click();

    // La création redirige vers la version : l'adresse EST la preuve.
    await expect(page).toHaveURL(/\/app\/budgets\/[0-9a-f-]{36}/);
    adresseVersion = new URL(page.url()).pathname;

    expect(erreurs(), "erreurs de console sur l'écran des cycles").toEqual([]);
  });

  test("le contributeur propose deux hypothèses", async ({ page }) => {
    expect(adresseVersion, "l'étape précédente n'a pas livré de version").not.toEqual("");

    const erreurs = surveillerLaConsole(page);
    await connecter(page, CONTRIBUTEUR);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });

    for (const [parametre, montant] of [
      [PARAMETRE_APPROUVE, MONTANT_APPROUVE],
      [PARAMETRE_EN_ATTENTE, MONTANT_EN_ATTENTE],
    ] as const) {
      const proposition = formulaire(page, "Proposer");
      await proposition.locator('input[name="parameter_key"]').fill(parametre);
      await proposition.locator('select[name="account_code"]').selectOption(CODE_COMPTE);
      await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
      await proposition.locator('input[name="value"]').fill(montant);
      await proposition.getByRole("button", { name: "Proposer" }).click();

      await expect(page.getByRole("cell", { name: parametre })).toBeVisible();
    }

    // Le pont entre les deux jumeaux se voit ici : une hypothèse que l'écran
    // déclarerait « non calculable » ne serait jamais publiée par le moteur.
    await expect(page.getByText("Non calculable — à ressaisir")).toHaveCount(0);
    expect(erreurs(), "erreurs de console sur l'écran de la version").toEqual([]);
  });

  test("le DAF n'approuve qu'une seule des deux hypothèses", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });

    await page
      .getByRole("row", { name: new RegExp(PARAMETRE_APPROUVE) })
      .getByRole("link", { name: "Détail" })
      .click();

    const decision = formulaire(page, "Enregistrer la décision");
    await decision.locator('select[name="decision"]').selectOption("approved");
    await decision
      .locator('textarea[name="reason"]')
      .fill("Recette automatisée du parcours vertical.");
    await decision.getByRole("button", { name: "Enregistrer la décision" }).click();

    await expect(
      page.getByText("Décision enregistrée", { exact: false }),
      "la décision n'a pas été inscrite",
    ).toBeVisible();

    expect(erreurs(), "erreurs de console sur l'écran de décision").toEqual([]);
  });

  test("le DG calcule, publie, et le montant est celui de la seule hypothèse approuvée", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);

    const versionId = adresseVersion.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();

    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();

    const table = page.getByRole("table");
    await expect(table, "le montant publié n'est pas celui de l'hypothèse approuvée").toContainText(
      MONTANT_PUBLIE,
    );

    // Les deux contrôles qui donnent son sens au précédent : une hypothèse
    // restée « proposée » n'entre ni seule, ni dans la somme.
    await expect(
      table,
      "une hypothèse non approuvée a été publiée",
    ).not.toContainText(MONTANT_JAMAIS_PUBLIE);
    await expect(
      table,
      "les deux hypothèses ont été additionnées : la gouvernance n'a pas filtré",
    ).not.toContainText(SOMME_DES_DEUX);

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });
});

test.describe("L'isolation entre tenants ne fuit pas l'existence", () => {
  test("un membre d'un autre tenant ne distingue pas « absente » de « pas à vous »", async ({
    page,
  }) => {
    expect(adresseVersion, "le parcours n'a pas livré de version à viser").not.toEqual("");

    await connecter(page, INTRUS);

    const reelleAilleurs = await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
    const corpsReel = await page.locator("body").innerText();

    const inexistante = await page.goto("/app/budgets/00000000-0000-4000-8000-0000000000ff", {
      waitUntil: "domcontentloaded",
    });
    const corpsInexistant = await page.locator("body").innerText();

    // Deux réponses identiques : le tenant voisin n'est pas seulement caché,
    // il est indistinguable de ce qui n'existe pas.
    expect(reelleAilleurs?.status(), "une version d'un autre tenant a été servie").toBe(404);
    expect(inexistante?.status()).toBe(404);
    expect(
      corpsReel,
      "la page trahit qu'une version existe ailleurs",
    ).toEqual(corpsInexistant);
  });
});
