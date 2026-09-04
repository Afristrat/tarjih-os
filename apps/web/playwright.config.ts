import { defineConfig, devices } from "@playwright/test";

/**
 * Configuration de la recette navigateur.
 *
 * Aucun bloc `webServer` : la vérification porte sur l'artefact réellement
 * déployé, jamais sur un serveur de développement local (SOP-011). L'adresse se
 * surcharge par `E2E_BASE_URL` pour viser un environnement de preview le jour
 * où il en existera un ; par défaut, c'est la production.
 *
 * `workers: 1` et `fullyParallel: false` ne sont pas une prudence de façade :
 * le parcours écrit dans une base partagée et chaque étape dépend de la
 * précédente. Deux exécutions concurrentes se marcheraient dessus.
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  forbidOnly: Boolean(process.env.CI),
  reporter: [["list"]],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "https://tarjih-os.com",
    locale: "fr-FR",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
