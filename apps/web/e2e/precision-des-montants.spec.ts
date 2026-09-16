import { expect, test, type Page } from "@playwright/test";

import { CONTRIBUTEUR, DAF, DG, connecter, surveillerLaConsole } from "./acteurs.ts";

/**
 * Un montant publié garde tous ses chiffres jusqu'à l'écran — vérifié dans un
 * navigateur, sur le domaine déployé.
 *
 * `budget_values.amount` est un `numeric(24, 6)`. PostgREST sérialise un
 * `numeric` en nombre JSON, et le client le lit en double : au-delà de 2⁵³,
 * les derniers chiffres sont perdus AVANT que le code ne les voie. Le web
 * demande donc chaque montant en texte (`amount::text`) et le met en forme
 * sans passer par `Number`.
 *
 * Le montant choisi rend la perte visible aux centimes, là où un DAF regarde :
 * 98 765 432 109 876,543210 s'affiche « …876,54 » lu en exact, « …876,55 » lu
 * en double. Un montant plus petit passerait la recette dans les deux cas, et
 * la recette ne prouverait rien.
 */

const MARQUE = Date.now();

const CODE_COMPTE = `PRC${MARQUE}`;
const NOM_COMPTE = `Charge de précision ${MARQUE}`;
const NOM_CYCLE = `Précision ${MARQUE}`;
const PARAMETRE = "precision_double";

/** Décalée à chaque exécution : `unique (tenant, starts_on, ends_on)`. */
const JOUR = new Date(Date.UTC(2031, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Saisi tel quel ; vingt chiffres significatifs, hors de portée d'un double. */
const MONTANT_SAISI = "98765432109876,543210";
const MONTANT_AFFICHE = "98 765 432 109 876,54 MAD";
const MONTANT_AFFICHE_EN_DOUBLE = "98 765 432 109 876,55 MAD";
const PART_AFFICHEE = "98 765 432 109 876,543210 MAD";

let adresseVersion = "";

function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

/** Les espaces qu'`Intl` produit (insécable, insécable étroite) ramenées à une espace. */
function normaliser(texte: string | null): string {
  return (texte ?? "").replace(/[  ]/g, " ").trim();
}

test.describe.configure({ mode: "serial" });

test.describe("Un montant publié garde tous ses chiffres jusqu'à l'écran", () => {
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

  test("le contributeur propose une charge à vingt chiffres significatifs", async ({ page }) => {
    expect(adresseVersion, "l'étape précédente n'a pas livré de version").not.toEqual("");

    const erreurs = surveillerLaConsole(page);
    await connecter(page, CONTRIBUTEUR);
    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });

    const proposition = formulaire(page, "Proposer");
    await proposition.locator('input[name="parameter_key"]').fill(PARAMETRE);
    await proposition.locator('select[name="account_code"]').selectOption(CODE_COMPTE);
    await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
    await proposition.locator('input[name="value"]').fill(MONTANT_SAISI);
    await proposition.getByRole("button", { name: "Proposer" }).click();

    await expect(page.getByRole("cell", { name: PARAMETRE })).toBeVisible();
    await expect(page.getByText("Non calculable — à ressaisir")).toHaveCount(0);
    expect(erreurs(), "erreurs de console sur l'écran de la version").toEqual([]);
  });

  test("le DAF approuve", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto(adresseVersion, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("row", { name: new RegExp(PARAMETRE) })
      .getByRole("link", { name: "Détail" })
      .click();

    const decision = formulaire(page, "Enregistrer la décision");
    await decision.locator('select[name="decision"]').selectOption("approved");
    await decision
      .locator('textarea[name="reason"]')
      .fill("Recette de précision : le montant doit arriver entier à l'écran.");
    await decision.getByRole("button", { name: "Enregistrer la décision" }).click();

    await expect(page.getByText("Décision enregistrée", { exact: false })).toBeVisible();
    expect(erreurs(), "erreurs de console sur l'écran de décision").toEqual([]);
  });

  test("le DG publie, et l'écran montre les centimes exacts, pas ceux d'un double", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);

    const versionId = adresseVersion.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();
    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();

    const lignes = page.locator("table.data-table tbody tr");
    await expect(lignes).toHaveCount(1);

    // Le montant, tel que publié : « …876,54 ». Lu en double, il ferait « …876,55 ».
    const montant = normaliser(await lignes.first().locator("td.amount-cell").textContent());
    expect(montant, "les centimes affichés sont ceux d'un double, pas du montant publié").not.toBe(
      MONTANT_AFFICHE_EN_DOUBLE,
    );
    expect(montant).toBe(MONTANT_AFFICHE);

    // Le total des charges est calculé à partir du texte reçu, pas d'un nombre.
    const totalCharges = page.locator("table.data-table tfoot tr").filter({
      hasText: "Total des charges",
    });
    await expect(totalCharges).toHaveCount(1);
    expect(normaliser(await totalCharges.locator(".amount-cell").textContent())).toBe(
      MONTANT_AFFICHE,
    );

    // La part d'origine, jamais arrondie, porte les six décimales saisies.
    await lignes.first().locator("details.origin-details > summary").click();
    const part = lignes.first().locator(".origin-list .origin-share").first();
    expect(normaliser(await part.textContent())).toBe(PART_AFFICHEE);

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });
});
