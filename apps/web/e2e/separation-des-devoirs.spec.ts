import { expect, test, type Page } from "@playwright/test";

import { CONTRIBUTEUR, DAF, connecter, surveillerLaConsole } from "./acteurs.ts";

/**
 * La séparation des devoirs est VISIBLE, pas imposée — vérifié dans un
 * navigateur, sur le domaine déployé.
 *
 * Rien n'empêche l'auteur d'une ligne de l'approuver lui-même : le tenant réel
 * n'a qu'un membre, l'interdire le bloquerait (décision d'Amine, 2026-09-16).
 * Ce que l'outil doit, c'est le dire à celui qui lit : la liste de la version
 * et la décision elle-même portent « Décidée par son auteur », et une ligne
 * décidée par quelqu'un d'autre ne le porte pas.
 */

const MARQUE = Date.now();

const CODE_COMPTE = `SDD${MARQUE}`;
const NOM_COMPTE = `Charge auto-décidée ${MARQUE}`;
const NOM_CYCLE = `Séparation des devoirs ${MARQUE}`;
const PARAMETRE_DU_DAF = "ligne_du_daf";
const PARAMETRE_DU_CONTRIBUTEUR = "ligne_du_contributeur";
const BADGE = "Décidée par son auteur";

/** Décalée à chaque exécution : `unique (tenant, starts_on, ends_on)`. */
const JOUR = new Date(Date.UTC(2033, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

let adresseVersion = "";

function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

async function proposer(page: Page, parametre: string, montant: string): Promise<void> {
  const proposition = formulaire(page, "Proposer");
  await proposition.locator('input[name="parameter_key"]').fill(parametre);
  await proposition.locator('select[name="account_code"]').selectOption(CODE_COMPTE);
  await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
  await proposition.locator('input[name="value"]').fill(montant);
  await proposition.getByRole("button", { name: "Proposer" }).click();
  await expect(page.getByRole("cell", { name: parametre })).toBeVisible();
}

async function approuver(page: Page, parametre: string): Promise<void> {
  await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("row", { name: new RegExp(parametre) })
    .getByRole("link", { name: "Détail" })
    .click();
  const decision = formulaire(page, "Enregistrer la décision");
  await decision.locator('select[name="decision"]').selectOption("approved");
  await decision.locator('textarea[name="reason"]').fill("Recette de séparation des devoirs.");
  await decision.getByRole("button", { name: "Enregistrer la décision" }).click();
  await expect(page.getByText("Décision enregistrée", { exact: false })).toBeVisible();
}

test.describe.configure({ mode: "serial" });

test.describe("Une décision prise par l'auteur de la ligne se voit", () => {
  test("le DAF pose un compte, une période, un cycle et une version", async ({ page }) => {
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

    await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });
    const cycle = formulaire(page, "Créer le cycle");
    await cycle.locator('input[name="name"]').fill(NOM_CYCLE);
    await cycle.getByRole("button", { name: "Créer le cycle" }).click();
    await expect(page.getByRole("heading", { name: NOM_CYCLE })).toBeVisible();

    const bloc = page.locator(".cycle-block").filter({ hasText: NOM_CYCLE });
    await expect(bloc).toHaveCount(1);
    await bloc.getByRole("button", { name: "Ouvrir une version" }).click();
    await expect(page).toHaveURL(/\/app\/budgets\/[0-9a-f-]{36}/);
    adresseVersion = new URL(page.url()).pathname;

    expect(erreurs(), "erreurs de console pendant la préparation").toEqual([]);
  });

  test("le DAF propose une ligne, le contributeur en propose une autre", async ({ page }) => {
    expect(adresseVersion, "l'étape précédente n'a pas livré de version").not.toEqual("");

    await connecter(page, DAF);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
    await proposer(page, PARAMETRE_DU_DAF, "100");

    await connecter(page, CONTRIBUTEUR);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
    await proposer(page, PARAMETRE_DU_CONTRIBUTEUR, "200");

    // Rien n'est encore décidé : aucun badge nulle part.
    await expect(page.getByText(BADGE)).toHaveCount(0);
  });

  test("le DAF approuve les deux, et seule SA ligne est marquée", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await approuver(page, PARAMETRE_DU_DAF);
    // Sur la décision elle-même : le lecteur sait qu'elle n'a pas eu de second regard.
    await expect(
      page.locator(".trail-entry").first().getByText(BADGE),
      "la décision prise par l'auteur ne le dit pas",
    ).toBeVisible();

    await approuver(page, PARAMETRE_DU_CONTRIBUTEUR);
    await expect(
      page.locator(".trail-entry").first().getByText(BADGE),
      "une décision prise par un autre que l'auteur est marquée à tort",
    ).toHaveCount(0);

    // Sur la liste de la version : une ligne marquée, l'autre non.
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
    const ligneDuDaf = page.getByRole("row", { name: new RegExp(PARAMETRE_DU_DAF) });
    const ligneDuContributeur = page.getByRole("row", {
      name: new RegExp(PARAMETRE_DU_CONTRIBUTEUR),
    });
    await expect(ligneDuDaf.getByText("Approuvée")).toBeVisible();
    await expect(ligneDuDaf.getByText(BADGE), "la ligne auto-décidée n'est pas marquée").toBeVisible();
    await expect(ligneDuContributeur.getByText("Approuvée")).toBeVisible();
    await expect(
      ligneDuContributeur.getByText(BADGE),
      "la ligne décidée par un autre est marquée à tort",
    ).toHaveCount(0);

    expect(erreurs(), "erreurs de console sur les écrans de décision").toEqual([]);
  });
});
