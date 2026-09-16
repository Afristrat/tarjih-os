import type { Locator, Page } from "@playwright/test";

/**
 * Le formulaire qui porte un bouton donné.
 *
 * Les écrans de Tarjih empilent plusieurs formulaires natifs sur une même
 * page (créer un compte, créer une période, proposer, décider…) ; le bouton
 * est ce qui les distingue pour un lecteur, donc pour la recette. Six fichiers
 * de recette portaient chacun leur copie de cette fonction : la sixième a
 * déclenché l'extraction que le marqueur `ponytail` de la quatrième fixait au
 * cinquième fichier.
 */
export function formulaire(page: Page, bouton: string): Locator {
  return page.locator("form").filter({ has: page.getByRole("button", { name: bouton }) });
}
