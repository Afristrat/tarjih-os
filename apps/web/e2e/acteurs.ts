import { expect, type Page } from "@playwright/test";

/**
 * Les acteurs de la recette et la façon de les faire entrer.
 *
 * Les mots de passe viennent du coffre, injectés dans l'environnement par le
 * broker au moment de lancer la recette. Ils ne sont ni écrits ici, ni dans le
 * dépôt, ni dans une ligne de commande. Un mot de passe absent fait échouer la
 * recette tout de suite, avec le nom de la clé manquante — jamais un parcours
 * qui échoue plus loin sans qu'on sache pourquoi.
 */

export type Acteur = {
  cle: string;
  courriel: string;
  role: string;
};

export const CONTRIBUTEUR: Acteur = {
  cle: "TARJIH_E2E_PW_CONTRIB",
  courriel: "e2e-contributeur@tarjih-os.com",
  role: "contributeur",
};

export const DAF: Acteur = {
  cle: "TARJIH_E2E_PW_DAF",
  courriel: "e2e-daf@tarjih-os.com",
  role: "DAF",
};

export const DG: Acteur = {
  cle: "TARJIH_E2E_PW_DG",
  courriel: "e2e-dg@tarjih-os.com",
  role: "DG",
};

/** Membre légitime d'un AUTRE tenant : il sert le contrôle d'isolation. */
export const INTRUS: Acteur = {
  cle: "TARJIH_E2E_PW_INTRUS",
  courriel: "e2e-intrus@tarjih-os.com",
  role: "DAF d'un autre tenant",
};

function motDePasse(acteur: Acteur): string {
  const valeur = process.env[acteur.cle];
  if (!valeur) {
    throw new Error(
      `Mot de passe absent pour ${acteur.role} : la clé « ${acteur.cle} » n'est pas dans` +
        " l'environnement. Lancez la recette par le broker de secrets.",
    );
  }
  return valeur;
}

/**
 * Ouvre une session réelle sur le domaine déployé.
 *
 * Le marqueur de réussite est l'adresse : `/app` en cas de succès,
 * `/login?error=…` sinon. Les deux états rendent un code 200, donc le code HTTP
 * ne prouverait rien ici (SOP-011, étape 6ter).
 */
export async function connecter(page: Page, acteur: Acteur): Promise<void> {
  // `domcontentloaded` et non `load` : attendre toutes les sous-ressources fait
  // dépendre la recette de la moindre police ou image lente, et une navigation
  // qui traîne finit avortée. Les localisateurs attendent déjà leur élément.
  await page.goto("/login", { waitUntil: "domcontentloaded" });
  await page.getByLabel("Adresse e-mail").fill(acteur.courriel);
  await page.getByLabel("Mot de passe").fill(motDePasse(acteur));
  await page.getByRole("button", { name: "Se connecter" }).click();

  await expect(
    page,
    `${acteur.role} n'a pas pu ouvrir de session sur le domaine déployé`,
  ).toHaveURL(/\/app(\?|$)/);
}

/**
 * Collecte les erreurs de console d'une page.
 *
 * Rendue sous forme de fonction de relevé plutôt que d'assertion : le parcours
 * décide quand il regarde, et le message d'échec cite les erreurs réelles.
 */
export function surveillerLaConsole(page: Page): () => string[] {
  const erreurs: string[] = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      erreurs.push(message.text());
    }
  });
  page.on("pageerror", (error) => {
    erreurs.push(error.message);
  });

  return () => [...erreurs];
}
