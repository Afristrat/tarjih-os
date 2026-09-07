import { expect, test, type Page } from "@playwright/test";
import { strFromU8, unzipSync } from "fflate";

import { CONTRIBUTEUR, DAF, INTRUS, connecter, surveillerLaConsole } from "./acteurs.ts";

/**
 * Ce qu'un export emporte, vérifié dans un navigateur sur le domaine déployé.
 *
 * Un écran qui montre trop se corrige ; un fichier qui EMPORTE trop est parti.
 * Aucune règle ne s'applique plus une fois qu'il est sur le poste de quelqu'un,
 * et c'est pourquoi la vérification qui compte est celle-ci, pas un test
 * unitaire de plus.
 *
 * Le contrôle central est le refus opposé au CONTRIBUTEUR. Le jeu de recette lui
 * donne `can_read` et NON `can_export` sur l'unique dimension du tenant : il voit
 * donc les montants à l'écran, et ne doit obtenir aucun fichier. C'est
 * exactement l'écart que la RLS de `budget_values` ne couvre pas — elle porte sur
 * `read` — et que le filtre applicatif doit tenir seul. Si ce contrôle passe au
 * vert alors qu'il devrait échouer, la promesse « un contributeur ne reçoit
 * aucune donnée hors périmètre, y compris dans les exports » (`prd.md:60`) est
 * fausse sans que rien ne le dise.
 */

const MARQUE = Date.now();

const CODE_COMPTE = `EXP${MARQUE}`;
const NOM_COMPTE = `Charge exportable ${MARQUE}`;
const NOM_CYCLE = `Export ${MARQUE}`;
const PARAMETRE = "export_charge";
const MONTANT = "1234,56";

/** Décalée à chaque exécution : `unique (tenant, starts_on, ends_on)`. */
const JOUR = new Date(Date.UTC(2031, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

const TYPE_XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

let versionId = "";

function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

test.describe.configure({ mode: "serial" });

test.describe("Un export ne sort jamais du périmètre de celui qui le demande", () => {
  test("le DAF prépare et publie une version exportable", async ({ page }) => {
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
    await bloc.getByRole("button", { name: "Ouvrir une version" }).click();
    await expect(page).toHaveURL(/\/app\/budgets\/[0-9a-f-]{36}/);
    versionId = new URL(page.url()).pathname.split("/").pop() ?? "";

    expect(erreurs(), "erreurs de console pendant la préparation").toEqual([]);
  });

  test("le contributeur propose, le DAF approuve et publie", async ({ page }) => {
    expect(versionId, "l'étape précédente n'a pas livré de version").not.toEqual("");

    await connecter(page, CONTRIBUTEUR);
    await page.goto(`/app/budgets/${versionId}`, { waitUntil: "domcontentloaded" });

    const proposition = formulaire(page, "Proposer");
    await proposition.locator('input[name="parameter_key"]').fill(PARAMETRE);
    await proposition.locator('select[name="account_code"]').selectOption(CODE_COMPTE);
    await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
    await proposition.locator('input[name="value"]').fill(MONTANT);
    await proposition.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByRole("cell", { name: PARAMETRE })).toBeVisible();

    await connecter(page, DAF);
    await page.goto(`/app/budgets/${versionId}`, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("row", { name: new RegExp(PARAMETRE) })
      .getByRole("link", { name: "Détail" })
      .click();

    const decision = formulaire(page, "Enregistrer la décision");
    await decision.locator('select[name="decision"]').selectOption("approved");
    await decision
      .locator('textarea[name="reason"]')
      .fill("Recette d'export : cette charge doit se retrouver dans le classeur.");
    await decision.getByRole("button", { name: "Enregistrer la décision" }).click();
    await expect(page.getByText("Décision enregistrée", { exact: false })).toBeVisible();

    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();
    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();
  });

  test("le DAF obtient un classeur qui porte bien son chiffre", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });

    // Le lien doit exister : un endpoint qu'aucun écran n'atteint n'est livré
    // qu'à moitié, et c'est une leçon déjà payée sur ce produit.
    await expect(
      page.getByRole("link", { name: "Exporter le classeur" }),
      "aucun lien d'export sur la consolidation d'une version publiée",
    ).toBeVisible();

    const reponse = await page.request.get(`/api/exports/${versionId}`);
    expect(reponse.status(), "le DAF doit obtenir son classeur").toBe(200);
    expect(reponse.headers()["content-type"]).toBe(TYPE_XLSX);

    const fichier = new Uint8Array(await reponse.body());
    expect(fichier.length, "le classeur ne doit pas être vide").toBeGreaterThan(0);
    expect(
      [fichier[0], fichier[1]],
      "le corps rendu n'est pas une archive : ce n'est pas un classeur",
    ).toEqual([0x50, 0x4b]);

    const texte = Object.values(unzipSync(fichier))
      .map((entree) => strFromU8(entree))
      .join("\n");
    expect(texte, "le chiffre publié ne figure pas dans le classeur").toContain("1234.56");

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });

  test("le même export redemandé rend exactement le même fichier", async ({ page }) => {
    await connecter(page, DAF);

    const premier = await page.request.get(`/api/exports/${versionId}`);
    const second = await page.request.get(`/api/exports/${versionId}`);

    // `prd.md:122`. Vérifié ici sur le service DÉPLOYÉ, et non en mémoire :
    // c'est ce qui rend `exports.file_hash` vérifiable contre un fichier reçu.
    expect(
      premier.headers()["x-tarjih-file-hash"],
      "deux demandes du même périmètre ont rendu deux fichiers différents",
    ).toBe(second.headers()["x-tarjih-file-hash"]);
    expect(Buffer.from(await premier.body()).equals(Buffer.from(await second.body()))).toBe(true);
  });

  test("LE CONTRÔLE CENTRAL : un contributeur sans droit d'export n'obtient aucun fichier", async ({
    page,
  }) => {
    await connecter(page, CONTRIBUTEUR);

    // Il voit les montants — la RLS le lui permet, sur `read`.
    await page.goto(`/app/budgets/${versionId}`, { waitUntil: "domcontentloaded" });
    await expect(
      page.getByRole("cell", { name: PARAMETRE }),
      "le contributeur devrait voir cette hypothèse : sinon le contrôle qui suit ne prouve rien",
    ).toBeVisible();

    // Aucun lien ne le lui propose…
    await expect(
      page.getByRole("link", { name: "Exporter mon périmètre" }),
      "un contributeur sans `can_export` ne doit se voir proposer aucun export",
    ).toHaveCount(0);

    // …et l'adresse devinée ne lui donne rien non plus. C'est ce second point
    // qui compte : l'absence de lien n'est pas une protection.
    const reponse = await page.request.get(`/api/exports/${versionId}`);
    expect(
      reponse.status(),
      "un contributeur sans droit d'export a obtenu un fichier en devinant l'adresse",
    ).toBe(403);
  });

  test("un membre d'un autre tenant n'obtient rien, et n'apprend rien", async ({ page }) => {
    await connecter(page, INTRUS);

    const reponse = await page.request.get(`/api/exports/${versionId}`);
    expect(
      reponse.status(),
      "l'export d'une version d'un autre tenant doit être introuvable, pas refusé",
    ).toBe(404);
  });
});
