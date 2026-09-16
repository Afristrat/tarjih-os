/**
 * Identité légale de l'éditeur — reprise en lecture seule de l'identité commune au
 * portefeuille (source : `sop-platform/lib/legal.ts`, Nahj). Un changement de siège ou de
 * gérant ne se répercute qu'à un seul endroit du dépôt.
 */
export const LEGAL = {
  societe: "AIMPower SARL A.U.",
  forme: "Société à responsabilité limitée à associé unique",
  capital: "10 000 MAD",
  rc: "618105",
  ice: "003438689000014",
  identifiantFiscal: "60276299",
  adresse:
    "32 Rue Al Banafsaj, résidence Ezzaitouna, 2ᵉ étage, Apt 21, Casablanca 20390, " +
    "Royaume du Maroc",
  directeurPublication: "Med Amine MANSOURI IDRISSI",
  contact: "dpo@ai-mpower.com",
} as const;
