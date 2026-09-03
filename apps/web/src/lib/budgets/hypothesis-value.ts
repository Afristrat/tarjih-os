/**
 * Forme de la valeur d'une hypothèse.
 *
 * Une hypothèse ne devient un montant officiel que si elle dit **sur quel
 * compte** et **sur quelle période** elle porte. Le `value` jsonb transporte
 * cette forme, qui dépend du modèle de calcul de la version : un inducteur
 * porte un volume et un prix, là où une saisie directe porte un montant. Des
 * colonnes dédiées ne pourraient pas couvrir les deux sans multiplier les
 * champs nuls.
 *
 * Le format produit ici est celui que le moteur Python valide déjà
 * (`services/calculation/src/tarjih_calculation/resolvers.py`). Les deux
 * doivent évoluer ensemble — et depuis `schemas/hypothesis-value.cases.json`,
 * un corpus partagé les fait rougir tous les deux dès que l'un dérive.
 */

/**
 * Un nombre exact, écrit en chaîne. Le moteur refuse les flottants à sa
 * frontière : un montant ne transite jamais en nombre JSON.
 */
const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d+)?$/;

/**
 * Échelle de `numeric(24, 6)`, la colonne où un montant publiable atterrit.
 * Elle ne s'applique **qu'aux montants** : un inducteur (volume, prix, taux)
 * porte légitimement plus de décimales, seul le produit est arrondi, une fois,
 * à l'agrégation (`contracts.require_factor`).
 */
const AMOUNT_SCALE = 6;

/**
 * Bornes de `numeric(24, 6)` : au-delà de 18 chiffres avant la virgule, le
 * moteur refuse (`amount_overflow`). Le barrer à la saisie évite d'enregistrer
 * une hypothèse qui ne fera échouer la publication que bien plus tard.
 * Le moteur reste l'autorité : ce contrôle est là pour ne pas laisser passer
 * l'évidence, pas pour dupliquer sa validation.
 */
const MAX_INTEGER_DIGITS = 18;

export type HypothesisValue = Record<string, unknown>;

export type HypothesisFacts = {
  accountCode: string | null;
  amount: string | null;
  periodId: string | null;
  /** `null` pour une saisie directe ; sinon l'inducteur employé. */
  driver: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/** Normalise et vérifie la forme ; ne dit rien de l'échelle ni des bornes. */
function exact(raw: string): string | null {
  const normalized = raw.trim().replace(",", ".");
  if (!DECIMAL_PATTERN.test(normalized)) {
    return null;
  }

  const [integerPart = ""] = normalized.replace("-", "").split(".");
  return integerPart.length > MAX_INTEGER_DIGITS ? null : normalized;
}

/** Un montant publiable : exact, et tenant dans l'échelle de la colonne. */
function amount(raw: string): string | null {
  const value = exact(raw);
  if (value === null) {
    return null;
  }

  const [, fractionPart = ""] = value.split(".");
  return fractionPart.length > AMOUNT_SCALE ? null : value;
}

/**
 * Un inducteur : volume, prix unitaire, taux.
 *
 * Contrairement à un montant, il n'est pas soumis à l'échelle de la colonne —
 * un prix au litre ou un taux horaire porte plus de six décimales sans être
 * fautif. Le durcir ici refuserait une saisie que le moteur accepte.
 */
function factor(raw: string): string | null {
  return exact(raw);
}

/** Saisie directe : le montant est donné, aucune sémantique n'est ajoutée. */
export function buildDirectValue(
  accountCode: string,
  periodId: string,
  rawAmount: string,
): HypothesisValue | null {
  const value = amount(rawAmount);
  return value === null
    ? null
    : { account_code: accountCode, amounts: [{ amount: value, period_id: periodId }] };
}

/** Inducteur : le montant est dérivé d'un volume et d'un prix unitaire. */
export function buildVolumePriceValue(
  accountCode: string,
  periodId: string,
  rawVolume: string,
  rawUnitPrice: string,
): HypothesisValue | null {
  const volume = factor(rawVolume);
  const unitPrice = factor(rawUnitPrice);
  return volume === null || unitPrice === null
    ? null
    : {
        account_code: accountCode,
        driver: "volume_price",
        periods: [{ period_id: periodId, unit_price: unitPrice, volume }],
      };
}

/**
 * Relit une valeur, quelle que soit sa forme.
 *
 * La forme historique `{ type: "decimal", value: "…" }` est encore en base :
 * elle est lue pour rester affichable, mais n'est plus produite — elle ne dit
 * ni le compte ni la période, donc le moteur ne peut rien en faire.
 *
 * ponytail: seule la première entrée d'une hypothèse multi-périodes est
 * affichée (`amounts`, `periods`, `period_ids`). Plafond : aucun chemin ne
 * produit aujourd'hui plus d'une période — ni les formulaires, ni un import,
 * qui n'existe pas. Déclencheur de réexamen : la première voie d'entrée
 * multi-périodes (import comptable, API, formulaire multi-lignes).
 */
export function readHypothesisFacts(value: unknown): HypothesisFacts {
  const empty: HypothesisFacts = {
    accountCode: null,
    amount: null,
    driver: null,
    periodId: null,
  };

  if (!isRecord(value)) {
    return empty;
  }

  if (value.type === "decimal" && typeof value.value === "string") {
    return { ...empty, amount: value.value };
  }

  const accountCode = typeof value.account_code === "string" ? value.account_code : null;
  const driver = typeof value.driver === "string" ? value.driver : null;

  if (driver === "volume_price" && Array.isArray(value.periods)) {
    const first = value.periods[0];
    if (isRecord(first)) {
      const volume = typeof first.volume === "string" ? first.volume : null;
      const unitPrice = typeof first.unit_price === "string" ? first.unit_price : null;
      return {
        accountCode,
        // Le produit n'est pas recalculé ici : le montant officiel est celui du
        // moteur. On montre l'inducteur tel qu'il a été saisi.
        amount: volume !== null && unitPrice !== null ? `${volume} × ${unitPrice}` : null,
        driver,
        periodId: typeof first.period_id === "string" ? first.period_id : null,
      };
    }
  }

  // Le moteur accepte ce troisième inducteur (`resolvers.DRIVERS`) alors
  // qu'aucun formulaire ne le produit encore. Le lire quand même : sans cela
  // l'écran annoncerait « non calculable » une hypothèse que le moteur publie.
  if (driver === "percent_of" && Array.isArray(value.period_ids)) {
    const rate = typeof value.rate === "string" ? value.rate : null;
    const baseAccountCode =
      typeof value.base_account_code === "string" ? value.base_account_code : null;
    const first = value.period_ids[0];
    return {
      accountCode,
      // Un taux n'a pas de montant tant que sa base n'est pas résolue : on
      // montre l'inducteur, pas un chiffre qui n'engagerait personne.
      amount: rate !== null && baseAccountCode !== null ? `${rate} × ${baseAccountCode}` : null,
      driver,
      periodId: typeof first === "string" ? first : null,
    };
  }

  if (Array.isArray(value.amounts)) {
    const first = value.amounts[0];
    if (isRecord(first)) {
      return {
        accountCode,
        amount: typeof first.amount === "string" ? first.amount : null,
        driver,
        periodId: typeof first.period_id === "string" ? first.period_id : null,
      };
    }
  }

  return { ...empty, accountCode, driver };
}

/**
 * Dit si une hypothèse est calculable en l'état.
 *
 * Utile pour signaler à l'écran qu'une hypothèse ancienne devra être ressaisie :
 * l'annoncer vaut mieux que laisser le calcul échouer plus tard sans expliquer
 * laquelle est en cause.
 */
export function isCalculable(value: unknown): boolean {
  const facts = readHypothesisFacts(value);
  return facts.accountCode !== null && facts.periodId !== null;
}
