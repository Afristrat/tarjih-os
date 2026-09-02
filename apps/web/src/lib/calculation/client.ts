/**
 * Client du service de calcul.
 *
 * Le moteur officiel est en Python et n'est jamais réimplémenté ici : cette
 * couche transporte un snapshot et rapporte un résultat.
 *
 * Le jeton de service ne peut pas fuiter vers le navigateur : `CALCULATION_*`
 * ne porte pas le préfixe `NEXT_PUBLIC_`, et Next n'inclut dans le bundle client
 * que les variables qui le portent. Ce module est donc à n'importer que depuis
 * du code serveur — Server Components et Server Actions.
 */

export type CalculatedValue = {
  accountId: string;
  /** Montant en chaîne : un `number` JavaScript passerait par un flottant. */
  amount: string;
  dimensionId: string;
  periodId: string;
};

export type CalculationOutcome =
  | {
      engineVersion: string;
      inputHash: string;
      outputHash: string;
      status: "calculated";
      values: CalculatedValue[];
    }
  | { code: string; message: string; status: "refused" }
  | { detail: string; status: "unavailable" };

type ServiceConfig = {
  token: string;
  url: string;
};

function getServiceConfig(): ServiceConfig {
  const url = process.env.CALCULATION_SERVICE_URL;
  const token = process.env.CALCULATION_SERVICE_TOKEN;

  if (!url || !token) {
    throw new Error("La configuration du service de calcul est incomplète.");
  }

  return { token, url: url.replace(/\/+$/, "") };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeValues(raw: unknown): CalculatedValue[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const values: CalculatedValue[] = [];
  for (const item of raw) {
    if (
      !isRecord(item) ||
      typeof item.dimension_id !== "string" ||
      typeof item.account_id !== "string" ||
      typeof item.period_id !== "string" ||
      typeof item.amount !== "string"
    ) {
      return null;
    }

    values.push({
      accountId: item.account_id,
      amount: item.amount,
      dimensionId: item.dimension_id,
      periodId: item.period_id,
    });
  }

  return values;
}

/**
 * Appelle le moteur. Ne lève pas sur un refus métier : un snapshot refusé est
 * une réponse, pas une panne, et l'appelant doit pouvoir la journaliser telle
 * quelle sans distinguer les deux par un `try`.
 */
export async function requestCalculation(snapshot: unknown): Promise<CalculationOutcome> {
  let config: ServiceConfig;
  try {
    config = getServiceConfig();
  } catch {
    return { detail: "service-non-configure", status: "unavailable" };
  }

  let response: Response;
  try {
    response = await fetch(`${config.url}/calculate`, {
      body: JSON.stringify(snapshot),
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
        "X-Service-Key": config.token,
      },
      method: "POST",
      // Un calcul qui n'a pas répondu en 30 s est un incident, pas une attente :
      // sans borne, la Server Action retiendrait la requête de l'utilisateur.
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    return { detail: "service-injoignable", status: "unavailable" };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { detail: "reponse-illisible", status: "unavailable" };
  }

  if (response.status === 422 && isRecord(body) && typeof body.code === "string") {
    return {
      code: body.code,
      message: typeof body.message === "string" ? body.message : "",
      status: "refused",
    };
  }

  if (!response.ok || !isRecord(body)) {
    return { detail: `reponse-inattendue-${response.status}`, status: "unavailable" };
  }

  const values = normalizeValues(body.values);
  if (
    values === null ||
    typeof body.engine_version !== "string" ||
    typeof body.input_hash !== "string" ||
    typeof body.output_hash !== "string"
  ) {
    return { detail: "reponse-non-conforme", status: "unavailable" };
  }

  return {
    engineVersion: body.engine_version,
    inputHash: body.input_hash,
    outputHash: body.output_hash,
    status: "calculated",
    values,
  };
}
