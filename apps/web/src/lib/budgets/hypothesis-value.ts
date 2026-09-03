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
 * doivent évoluer ensemble.
 */

const DECIMAL_PATTERN = /^-?(?:0|[1-9]\d*)(?:\.\d{1,6})?$/;

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

function decimal(raw: string): string | null {
  const normalized = raw.trim().replace(",", ".");
  return DECIMAL_PATTERN.test(normalized) ? normalized : null;
}

/** Saisie directe : le montant est donné, aucune sémantique n'est ajoutée. */
export function buildDirectValue(
  accountCode: string,
  periodId: string,
  rawAmount: string,
): HypothesisValue | null {
  const amount = decimal(rawAmount);
  return amount === null
    ? null
    : { account_code: accountCode, amounts: [{ amount, period_id: periodId }] };
}

/** Inducteur : le montant est dérivé d'un volume et d'un prix unitaire. */
export function buildVolumePriceValue(
  accountCode: string,
  periodId: string,
  rawVolume: string,
  rawUnitPrice: string,
): HypothesisValue | null {
  const volume = decimal(rawVolume);
  const unitPrice = decimal(rawUnitPrice);
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
