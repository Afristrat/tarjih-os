import { expect, test, type Page } from "@playwright/test";

import { CONTRIBUTEUR, DAF, DG, connecter, surveillerLaConsole } from "./acteurs.ts";
import { enCentimes, lire } from "./montants.ts";

/**
 * Les deux modèles de calcul que le produit expose sans les avoir jamais joués,
 * éprouvés dans un navigateur sur le domaine déployé (SOP-011).
 *
 * Le moteur résout trois modèles. `direct` est couvert par le parcours vertical.
 * Les deux autres ont été rendus atteignables le 2026-09-08 (`3ed255c`) et sont
 * restés sans aucune recette : `driver` n'a été joué qu'à la main, une fois, et
 * `cost_center` n'a jamais tourné du tout — alors qu'il est sélectionnable en
 * production. C'est le pire état possible : un chemin qu'un utilisateur peut
 * prendre et que personne n'a emprunté.
 *
 * Ce que ces contrôles prouvent, et que les tests unitaires ne peuvent pas :
 *
 *   · `driver` — le produit publie des montants que PERSONNE n'a saisis. Les
 *     champs remplis sont 320, 4500 et 0.05 ; les montants publiés sont
 *     1 440 000 et 72 000. Le second est résolu en SECONDE passe, sur une base
 *     que le moteur venait lui-même de calculer : aucune saisie ne le porte, et
 *     aucune addition de saisies ne le produit.
 *
 *   · `cost_center` — son refus ARRIVE JUSQU'À L'ÉCRAN. Le moteur sait refuser
 *     (c'est prouvé unitairement, `test_engine.py:187`), mais le refus tombe à
 *     la PUBLICATION, après que les hypothèses ont été saisies et approuvées.
 *     Seul un navigateur peut dire si l'utilisateur voit alors un message
 *     utilisable et une version intacte, ou un écran cassé.
 *
 * Ce qui reste hors de portée du navigateur, et pourquoi : `cost_center` refuse
 * aussi les dimensions qui ne sont pas des départements
 * (`resolvers.py:125`, prouvé par `test_engine.py:194`). Aucun acteur de la
 * recette n'est `is_tenant_admin` — c'est voulu, le jeu joue le parcours
 * financier, pas l'administration — donc aucun d'eux ne peut créer une dimension
 * d'un autre type. Cette branche reste couverte là où elle est atteignable,
 * c'est-à-dire dans le moteur.
 *
 * Le jeu de comptes vit dans `supabase/seed/e2e-recette.sql`, dans un tenant qui
 * ne sera jamais un client.
 */

/** Marque de l'exécution : les codes et les dates doivent rester uniques. */
const MARQUE = Date.now();

const CODE_PRODUIT = `E2EP${MARQUE}`;
const CODE_CHARGE = `E2EC${MARQUE}`;
const NOM_PRODUIT = `Produit de recette ${MARQUE}`;
const NOM_CHARGE = `Charge de recette ${MARQUE}`;
const NOM_CYCLE = `Modèles ${MARQUE}`;

/**
 * Une période d'un jour, décalée à chaque exécution : `unique (tenant,
 * starts_on, ends_on)`. L'année est propre à ce fichier — 2027, 2029 et 2031
 * sont déjà pris par les trois autres recettes, et deux suites qui tomberaient
 * sur le même jour se voleraient leur période.
 */
const JOUR = new Date(Date.UTC(2033, 0, 1) + (MARQUE % 3000) * 86_400_000)
  .toISOString()
  .slice(0, 10);

/** Les inducteurs saisis. Ce sont les SEULS chiffres que la recette tape. */
const VOLUME = "320";
const PRIX_UNITAIRE = "4500";
const TAUX = "0.05";

/** Hors de `RATE_MIN`/`RATE_MAX` (−10 à 10) : refusé à la saisie, pas plus tard. */
const TAUX_HORS_BORNES = "11";

/** Et les montants que le moteur en DÉDUIT, en centimes, jamais saisis. */
const PRODUIT_ATTENDU = 320 * 4500 * 100;
const CHARGE_ATTENDUE = 320 * 4500 * 0.05 * 100;
const RESULTAT_ATTENDU = PRODUIT_ATTENDU - CHARGE_ATTENDUE;

/** Le taux corrigé dans la version reprise, et la charge qu'il produit. */
const TAUX_CORRIGE = "0.06";
const CHARGE_CORRIGEE_ATTENDUE = 320 * 4500 * 0.06 * 100;

/** Montant du contrôle `cost_center`, saisi celui-là : le modèle est direct. */
const MONTANT_CENTRE_DE_COUTS = "2500.00";
const MONTANT_CENTRE_DE_COUTS_ATTENDU = Math.round(Number(MONTANT_CENTRE_DE_COUTS) * 100);

const REFUS_DU_MOTEUR = "Le moteur a refusé le calcul";
const REFUS_DE_SAISIE = "Renseignez une dimension, un paramètre, une unité et une valeur décimale";

/** Renseignés par les étapes qui les créent, consommés par les suivantes. */
let versionInducteurs = "";
let versionCentreRefusee = "";
let versionCentreValide = "";
let versionReprise = "";

// ponytail: quatrième copie de ce helper (parcours-vertical, export-rbac,
// tracabilite l'ont déjà à l'identique) ; à extraire dans un module partagé au
// cinquième fichier de recette, pas avant.
function formulaire(page: Page, bouton: string) {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}

/**
 * Ouvre une version dans le cycle de la recette. `origine` est la valeur du
 * sélecteur unique de l'écran : `empty:<modèle>` pour une version vide,
 * `resume:<id>` pour reprendre une version du cycle (`versionOriginValue`).
 */
async function ouvrirVersion(page: Page, origine: string): Promise<string> {
  await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });

  const bloc = page.locator(".cycle-block").filter({ hasText: NOM_CYCLE });
  await expect(bloc, "le bloc du cycle de la recette n'est pas identifiable seul").toHaveCount(1);

  await bloc.locator('select[name="origin"]').selectOption(origine);
  await bloc.getByRole("button", { name: "Ouvrir une version" }).click();

  await expect(page).toHaveURL(/\/app\/budgets\/[0-9a-f-]{36}/);
  return new URL(page.url()).pathname;
}

/** Approuve une hypothèse par son paramètre, depuis l'écran de la version. */
async function approuver(page: Page, adresse: string, parametre: string): Promise<void> {
  await page.goto(adresse, { waitUntil: "domcontentloaded" });
  await page
    .getByRole("row", { name: new RegExp(parametre) })
    .getByRole("link", { name: "Détail" })
    .click();

  const decision = formulaire(page, "Enregistrer la décision");
  await decision.locator('select[name="decision"]').selectOption("approved");
  await decision.locator('textarea[name="reason"]').fill(`Recette des modèles de calcul.`);
  await decision.getByRole("button", { name: "Enregistrer la décision" }).click();

  await expect(
    page.getByText("Décision enregistrée", { exact: false }),
    `la décision sur « ${parametre} » n'a pas été inscrite`,
  ).toBeVisible();
}

/** Montant publié d'un compte, lu dans la table de consolidation, en centimes. */
async function montantPublie(page: Page, codeCompte: string): Promise<number> {
  // La table des montants publiés seulement : depuis le 2026-09-15, la section
  // « Écart » cite le même compte dans les termes d'une hypothèse et dans sa
  // propre table de montants.
  const ligne = page
    .locator(".data-table:not(.ecart-table)")
    .getByRole("row", { name: new RegExp(codeCompte) });
  await expect(ligne, `aucune ligne publiée pour le compte ${codeCompte}`).toHaveCount(1);
  return enCentimes(lire(await ligne.locator(".amount-cell").innerText()));
}

test.describe.configure({ mode: "serial" });

test.describe("Le modèle « Inducteurs » publie des montants que personne n'a saisis", () => {
  test("le DAF pose un produit, une charge et une période", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/settings/reference", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: "Comptes et périodes" })).toBeVisible();

    // Deux comptes de sens contraire : sans les deux, ni le taux appliqué à une
    // base, ni le refus de `cost_center` sur un produit ne seraient jouables.
    for (const [code, nom, sens] of [
      [CODE_PRODUIT, NOM_PRODUIT, "credit"],
      [CODE_CHARGE, NOM_CHARGE, "debit"],
    ] as const) {
      const compte = formulaire(page, "Créer le compte");
      await compte.locator('input[name="name"]').fill(nom);
      await compte.locator('input[name="code"]').fill(code);
      await compte.locator('select[name="statement"]').selectOption("income_statement");
      await compte.locator('select[name="normal_balance"]').selectOption(sens);
      await compte.getByRole("button", { name: "Créer le compte" }).click();

      await expect(page.getByRole("cell", { name: nom })).toBeVisible();
    }

    const periode = formulaire(page, "Créer la période");
    await periode.locator('input[name="starts_on"]').fill(JOUR);
    await periode.locator('input[name="ends_on"]').fill(JOUR);
    await periode.getByRole("button", { name: "Créer la période" }).click();

    await expect(page.getByRole("cell", { name: JOUR, exact: true }).first()).toBeVisible();
    expect(erreurs(), "erreurs de console sur l'écran du référentiel").toEqual([]);
  });

  test("le DAF ouvre un cycle, puis une version SUR le modèle « Inducteurs »", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });
    const cycle = formulaire(page, "Créer le cycle");
    await cycle.locator('input[name="name"]').fill(NOM_CYCLE);
    await cycle.getByRole("button", { name: "Créer le cycle" }).click();

    await expect(page.getByRole("heading", { name: NOM_CYCLE })).toBeVisible();

    versionInducteurs = await ouvrirVersion(page, "empty:driver");

    // LE marqueur discriminant du modèle : le bloc d'inducteurs n'est rendu que
    // si la version porte `calculation_model = 'driver'`. Jusqu'au 2026-09-08,
    // `createBudgetVersion` n'écrivait jamais cette colonne et ce champ était
    // donc inatteignable — vingt-deux versions en base, toutes en « direct ».
    // Si le formulaire retombait à la saisie directe, ce contrôle tomberait ici
    // plutôt que trois étapes plus loin sur un montant inexplicable.
    await page.goto(versionInducteurs, { waitUntil: "domcontentloaded" });
    await expect(
      page.locator('select[name="driver"]'),
      "la version n'a pas été ouverte sur le modèle « Inducteurs »",
    ).toBeVisible();
    await expect(
      page.locator('input[name="value"]'),
      "le formulaire propose un montant à saisir alors que le modèle le DÉDUIT",
    ).toHaveCount(0);

    expect(erreurs(), "erreurs de console sur l'écran des cycles").toEqual([]);
  });

  test("un taux hors bornes est refusé À LA SAISIE, devant qui peut le corriger", async ({
    page,
  }) => {
    expect(versionInducteurs, "l'étape précédente n'a pas livré de version").not.toEqual("");

    await connecter(page, CONTRIBUTEUR);
    await page.goto(versionInducteurs, { waitUntil: "domcontentloaded" });

    const proposition = formulaire(page, "Proposer");
    await proposition.locator('input[name="parameter_key"]').fill("taux_hors_bornes");
    await proposition.locator('select[name="account_code"]').selectOption(CODE_CHARGE);
    await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
    await proposition.locator('select[name="driver"]').selectOption("percent_of");
    await proposition.locator('input[name="rate"]').fill(TAUX_HORS_BORNES);
    await proposition.locator('select[name="base_account_code"]').selectOption(CODE_PRODUIT);
    await proposition.getByRole("button", { name: "Proposer" }).click();

    // Deux sorties distinctes pour la même page : le refus, ou la ligne créée.
    await expect(
      page.getByText(REFUS_DE_SAISIE, { exact: false }),
      "un taux hors bornes a été accepté à la saisie",
    ).toBeVisible();
    await expect(
      page.getByRole("cell", { name: "taux_hors_bornes" }),
      "l'hypothèse hors bornes a été écrite : elle passera l'approbation et fera" +
        " échouer la publication de TOUTE la version, hypothèses des autres comprises",
    ).toHaveCount(0);
  });

  test("le contributeur dépose un volume × prix, puis un taux sur ce produit", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, CONTRIBUTEUR);
    await page.goto(versionInducteurs, { waitUntil: "domcontentloaded" });

    const volumePrix = formulaire(page, "Proposer");
    await volumePrix.locator('input[name="parameter_key"]').fill("chiffre_affaires");
    await volumePrix.locator('select[name="account_code"]').selectOption(CODE_PRODUIT);
    await volumePrix.locator('select[name="period_id"]').selectOption({ index: 0 });
    await volumePrix.locator('select[name="driver"]').selectOption("volume_price");
    await volumePrix.locator('input[name="volume"]').fill(VOLUME);
    await volumePrix.locator('input[name="unit_price"]').fill(PRIX_UNITAIRE);
    await volumePrix.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByRole("cell", { name: "chiffre_affaires" })).toBeVisible();

    const taux = formulaire(page, "Proposer");
    await taux.locator('input[name="parameter_key"]').fill("commission_apport");
    await taux.locator('select[name="account_code"]').selectOption(CODE_CHARGE);
    await taux.locator('select[name="period_id"]').selectOption({ index: 0 });
    await taux.locator('select[name="driver"]').selectOption("percent_of");
    await taux.locator('input[name="rate"]').fill(TAUX);
    await taux.locator('select[name="base_account_code"]').selectOption(CODE_PRODUIT);
    await taux.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByRole("cell", { name: "commission_apport" })).toBeVisible();

    // Ce que l'écran montre AVANT publication est une FORMULE, pas un montant :
    // un taux n'a pas de valeur tant que sa base n'est pas résolue. C'est la
    // moitié de la preuve — l'autre moitié est le chiffre publié plus bas, qui
    // n'apparaît donc nulle part à la saisie.
    await expect(
      page.getByRole("row", { name: /commission_apport/ }),
      "l'écran affiche un montant pour un taux dont la base n'est pas encore résolue",
    ).toContainText(CODE_PRODUIT);

    await expect(page.getByText("Non calculable — à ressaisir")).toHaveCount(0);
    expect(erreurs(), "erreurs de console sur l'écran de la version").toEqual([]);
  });

  test("le DAF approuve les deux hypothèses", async ({ page }) => {
    await connecter(page, DAF);
    await approuver(page, versionInducteurs, "chiffre_affaires");
    await approuver(page, versionInducteurs, "commission_apport");
  });

  test("le DG publie, et les deux montants sont DÉDUITS, pas saisis", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);

    const versionId = versionInducteurs.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();

    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("definition").filter({ hasText: "Inducteurs" }),
      "la version publiée n'a pas été calculée par le modèle annoncé",
    ).toBeVisible();

    // 320 × 4 500 : le produit n'a été saisi nulle part.
    expect(
      await montantPublie(page, CODE_PRODUIT),
      "le produit publié n'est pas volume × prix unitaire",
    ).toBe(PRODUIT_ATTENDU);

    // 5 % de ce produit : résolu en SECONDE passe, sur une base que le moteur
    // venait lui-même de calculer. C'est le contrôle qui distingue un moteur
    // d'une feuille de saisie — aucune addition de valeurs entrées ne le donne.
    expect(
      await montantPublie(page, CODE_CHARGE),
      "la charge publiée n'est pas le taux appliqué à la base calculée",
    ).toBe(CHARGE_ATTENDUE);

    const resultat = page.getByRole("row", { name: /Résultat/ });
    expect(
      enCentimes(lire(await resultat.locator(".amount-cell").innerText())),
      "le résultat n'est pas produits − charges",
    ).toBe(RESULTAT_ATTENDU);

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });
});

test.describe("Le modèle « Centres de coûts » refuse un produit, et le dit à l'écran", () => {
  test("une version en centres de coûts reçoit une hypothèse sur un compte de PRODUIT", async ({
    page,
  }) => {
    await connecter(page, DAF);
    versionCentreRefusee = await ouvrirVersion(page, "empty:cost_center");

    await connecter(page, CONTRIBUTEUR);
    await page.goto(versionCentreRefusee, { waitUntil: "domcontentloaded" });

    // Rien ici ne prévient : le modèle restreint aux comptes de charge, et
    // l'écran propose quand même tous les comptes du référentiel. C'est
    // exactement le piège que ce contrôle documente.
    const proposition = formulaire(page, "Proposer");
    await proposition.locator('input[name="parameter_key"]').fill("produit_interdit");
    await proposition.locator('select[name="account_code"]').selectOption(CODE_PRODUIT);
    await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
    await proposition.locator('input[name="value"]').fill(MONTANT_CENTRE_DE_COUTS);
    await proposition.getByRole("button", { name: "Proposer" }).click();

    await expect(page.getByRole("cell", { name: "produit_interdit" })).toBeVisible();

    await connecter(page, DAF);
    await approuver(page, versionCentreRefusee, "produit_interdit");
  });

  test("la publication est refusée, la version reste intacte et rien n'est publié", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);

    const versionId = versionCentreRefusee.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();

    await expect(
      page.getByText(REFUS_DU_MOTEUR, { exact: false }),
      "le moteur a accepté un compte de produit sous le modèle « Centres de coûts »",
    ).toBeVisible();

    // Le refus ne suffit pas : il doit aussi n'avoir RIEN laissé. Une version
    // partiellement publiée serait pire qu'un refus franc.
    await expect(
      page.getByText("Calcul publié", { exact: false }),
      "le refus et la publication coexistent à l'écran",
    ).toHaveCount(0);
    await expect(
      page.locator(".state-tag").filter({ hasText: "Brouillon" }),
      "la version refusée n'est plus un brouillon : le refus a laissé un état",
    ).toBeVisible();
    // La table des montants seulement : la section « Écart » peut légitimement
    // citer ce compte dans les termes d'une hypothèse d'une autre version.
    await expect(
      page.getByText("Aucun montant publié pour cette version", { exact: false }),
      "un montant a été publié malgré le refus du moteur",
    ).toBeVisible();
    await expect(
      page.locator(".data-table:not(.ecart-table)").getByRole("row", { name: new RegExp(CODE_PRODUIT) }),
    ).toHaveCount(0);

    // Le refus arrive APRÈS saisie et approbation, et l'écran ne dit pas quelle
    // hypothèse l'a provoqué : « le détail est inscrit au journal ». Le contrôle
    // fige ce comportement pour que son amélioration soit un choix, pas un
    // effet de bord.
    expect(erreurs(), "erreurs de console sur l'écran de refus").toEqual([]);
  });

  test("la même version, alimentée en charges, publie", async ({ page }) => {
    const erreurs = surveillerLaConsole(page);

    await connecter(page, DAF);
    versionCentreValide = await ouvrirVersion(page, "empty:cost_center");

    await connecter(page, CONTRIBUTEUR);
    await page.goto(versionCentreValide, { waitUntil: "domcontentloaded" });

    const proposition = formulaire(page, "Proposer");
    await proposition.locator('input[name="parameter_key"]').fill("charge_de_departement");
    await proposition.locator('select[name="account_code"]').selectOption(CODE_CHARGE);
    await proposition.locator('select[name="period_id"]').selectOption({ index: 0 });
    await proposition.locator('input[name="value"]').fill(MONTANT_CENTRE_DE_COUTS);
    await proposition.getByRole("button", { name: "Proposer" }).click();
    await expect(page.getByRole("cell", { name: "charge_de_departement" })).toBeVisible();

    await connecter(page, DAF);
    await approuver(page, versionCentreValide, "charge_de_departement");

    await connecter(page, DG);
    const versionId = versionCentreValide.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();

    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();
    await expect(
      page.getByRole("definition").filter({ hasText: "Centres de coûts" }),
      "la version publiée n'a pas été calculée par le modèle annoncé",
    ).toBeVisible();

    // Le modèle n'est pas seulement capable de refuser : il calcule. Sans ce
    // contrôle, une restriction trop large passerait pour une protection.
    expect(
      await montantPublie(page, CODE_CHARGE),
      "le montant publié sous « Centres de coûts » n'est pas celui qui a été saisi",
    ).toBe(MONTANT_CENTRE_DE_COUTS_ATTENDU);

    expect(erreurs(), "erreurs de console sur l'écran de consolidation").toEqual([]);
  });
});

test.describe("Une version suivante reprend la précédente au lieu de la ressaisir", () => {
  test("le DAF ouvre la version suivante à partir de la version « Inducteurs » publiée", async ({
    page,
  }) => {
    expect(versionInducteurs, "la version source n'a pas été livrée").not.toEqual("");
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);

    // Le sélecteur propose la reprise en premier et par défaut : c'est l'usage
    // attendu après une publication. Jusqu'au 2026-09-13, ouvrir une version
    // insérait une ligne vide et l'immuabilité se payait en ressaisie intégrale.
    const sourceId = versionInducteurs.split("/").pop() ?? "";
    versionReprise = await ouvrirVersion(page, `resume:${sourceId}`);
    expect(versionReprise, "la reprise a rendu la version source").not.toEqual(versionInducteurs);

    await expect(
      page.getByText("Version candidate ouverte à partir de la précédente", { exact: false }),
    ).toBeVisible();

    // Les deux hypothèses sont là, à l'état PROPOSÉ : reprises, pas approuvées.
    // Une approbation est une décision dans SA version, jamais un héritage.
    for (const parametre of ["chiffre_affaires", "commission_apport"]) {
      const ligne = page.getByRole("row", { name: new RegExp(parametre) });
      await expect(ligne, `« ${parametre} » n'a pas été repris`).toHaveCount(1);
      await expect(
        ligne.locator(".state-tag"),
        `« ${parametre} » a été repris avec une décision qu'il n'a pas reçue ici`,
      ).toHaveText("Proposée");
    }
    await expect(page.getByRole("row", { name: /chiffre_affaires/ })).toContainText(VOLUME);
    await expect(page.getByRole("row", { name: /commission_apport/ })).toContainText(CODE_PRODUIT);

    // Et la filiation est écrite, là où les versions se listent.
    await page.goto("/app/budgets", { waitUntil: "domcontentloaded" });
    await expect(
      page.locator(".cycle-block").filter({ hasText: NOM_CYCLE }).getByText(/reprise de la version 1/),
      "la version reprise ne dit pas de qui elle vient",
    ).toBeVisible();

    expect(erreurs(), "erreurs de console sur la version reprise").toEqual([]);
  });

  test("le contributeur corrige le taux repris — il reste un taux, sur la même base", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, CONTRIBUTEUR);
    await page.goto(versionReprise, { waitUntil: "domcontentloaded" });
    await page
      .getByRole("row", { name: /commission_apport/ })
      .getByRole("link", { name: "Détail" })
      .click();

    // Jusqu'au 2026-09-13, la fiche d'un taux n'offrait qu'un champ « Montant »
    // et la correction réécrivait l'hypothèse en saisie directe — dans une
    // version « Inducteurs », que le moteur aurait refusée à la publication.
    const correction = formulaire(page, "Corriger");
    await expect(
      correction.locator('input[name="rate"]'),
      "la fiche d'un taux ne propose pas de corriger le taux",
    ).toBeVisible();
    await correction.locator('input[name="rate"]').fill(TAUX_CORRIGE);
    await correction.getByRole("button", { name: "Corriger" }).click();

    await expect(page.getByText("Correction enregistrée", { exact: false })).toBeVisible();
    await expect(
      formulaire(page, "Corriger").locator('input[name="rate"]'),
      "après correction, l'hypothèse n'est plus un taux",
    ).toBeVisible();
    await expect(page.locator("main")).toContainText(`${TAUX_CORRIGE} × ${CODE_PRODUIT}`);

    expect(erreurs(), "erreurs de console sur la fiche d'hypothèse").toEqual([]);
  });

  test("le DAF lit l'écart avec la version 1 et approuve d'un geste ce qui n'a pas bougé", async ({
    page,
  }) => {
    const erreurs = surveillerLaConsole(page);
    await connecter(page, DAF);
    const versionId = versionReprise.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });

    // La comparaison s'ouvre d'elle-même sur la version dont celle-ci descend.
    // Jusqu'au 2026-09-15, « qu'est-ce qui a changé ? » n'avait pas d'écran.
    const ecart = page.getByRole("region", { name: /Par rapport à la version 1/ });
    await expect(ecart, "l'écart avec la version d'origine n'est pas affiché").toBeVisible();
    await expect(ecart.locator(".ecart-summary")).toHaveText("1 identique · 1 modifiée");

    const produit = ecart.getByRole("row", { name: /chiffre_affaires/ });
    const commission = ecart.getByRole("row", { name: /commission_apport/ });
    await expect(produit).toContainText("Identique");
    // Une ligne modifiée montre ses TERMES des deux côtés — le taux d'avant et
    // le taux d'après — jamais un produit recalculé par l'écran.
    await expect(commission).toContainText("Modifiée");
    await expect(commission).toContainText(`${TAUX} × ${CODE_PRODUIT}`);
    await expect(commission).toContainText(`${TAUX_CORRIGE} × ${CODE_PRODUIT}`);

    // Pas de montants à comparer : cette version n'est pas publiée.
    await expect(ecart).toContainText("Les montants ne se comparent qu’entre deux versions publiées");

    // Le geste : une seule ligne est identique à une approuvée de la v1.
    await ecart.getByRole("button", { name: "Approuver la ligne identique" }).click();
    await expect(page.getByText("Lignes identiques approuvées", { exact: false })).toBeVisible();

    const apres = page.getByRole("region", { name: /Par rapport à la version 1/ });
    await expect(
      apres.getByRole("row", { name: /chiffre_affaires/ }).locator(".state-tag").nth(1),
      "la ligne identique n'a pas été approuvée dans CETTE version",
    ).toHaveText("Approuvée");
    await expect(
      apres.getByRole("row", { name: /commission_apport/ }).locator(".state-tag").nth(1),
      "la ligne modifiée a été approuvée alors qu'elle attend une décision une à une",
    ).toHaveText("Proposée");
    await expect(
      apres.getByRole("button", { name: /Approuver/ }),
      "le geste reste proposé alors qu'il n'y a plus rien d'identique à approuver",
    ).toHaveCount(0);

    expect(erreurs(), "erreurs de console sur l'écart").toEqual([]);
  });

  test("le DAF approuve, le DG publie : la charge est le NOUVEAU taux sur la base recalculée", async ({
    page,
  }) => {
    await connecter(page, DAF);
    // « chiffre_affaires » a été approuvée par le geste ; il reste la modifiée.
    await approuver(page, versionReprise, "commission_apport");

    const erreurs = surveillerLaConsole(page);
    await connecter(page, DG);
    const versionId = versionReprise.split("/").pop() ?? "";
    await page.goto(`/app/consolidation/${versionId}`, { waitUntil: "domcontentloaded" });
    await page.getByRole("button", { name: "Calculer et publier" }).click();
    await expect(page.getByText("Calcul publié", { exact: false })).toBeVisible();

    expect(
      await montantPublie(page, CODE_PRODUIT),
      "le produit repris n'a pas été recalculé à l'identique",
    ).toBe(PRODUIT_ATTENDU);
    expect(
      await montantPublie(page, CODE_CHARGE),
      "la charge n'est pas le taux corrigé appliqué à la base",
    ).toBe(CHARGE_CORRIGEE_ATTENDUE);

    // Les deux versions sont publiées : les montants se comparent, en exact.
    const ecart = page.getByRole("region", { name: /Par rapport à la version 1/ });
    const montants = ecart.locator(".ecart-table").nth(1);
    const ligneCharge = montants.getByRole("row", { name: new RegExp(CODE_CHARGE) });
    const cellules = ligneCharge.locator(".amount-cell");
    expect(enCentimes(lire(await cellules.nth(0).innerText()))).toBe(CHARGE_ATTENDUE);
    expect(enCentimes(lire(await cellules.nth(1).innerText()))).toBe(CHARGE_CORRIGEE_ATTENDUE);
    expect(enCentimes(lire(await cellules.nth(2).innerText()))).toBe(
      CHARGE_CORRIGEE_ATTENDUE - CHARGE_ATTENDUE,
    );
    await expect(cellules.nth(3), "0,06 sur 0,05 fait 20 %, pas autre chose").toHaveText(/^20,0/);

    const ligneProduit = montants.getByRole("row", { name: new RegExp(CODE_PRODUIT) });
    await expect(ligneProduit.locator(".amount-cell").nth(3)).toHaveText(/^0,0/);

    // Le résultat recule de 14 400 sur 1 368 000 : −1,1 %, calculé sans flottant.
    const resultat = montants.locator(".result-row .amount-cell");
    expect(enCentimes(lire(await resultat.nth(0).innerText()))).toBe(RESULTAT_ATTENDU);
    expect(enCentimes(lire(await resultat.nth(1).innerText()))).toBe(
      PRODUIT_ATTENDU - CHARGE_CORRIGEE_ATTENDUE,
    );
    await expect(resultat.nth(3)).toHaveText(/^-1,1/);

    expect(erreurs(), "erreurs de console sur la consolidation reprise").toEqual([]);
  });
});
