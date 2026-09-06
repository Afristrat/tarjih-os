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

/**
 * La part d'une hypothèse dans un montant calculé.
 *
 * Le montant est EXACT, non arrondi : c'est son arrondi, une fois les parts
 * d'un même triplet sommées, qui donne la valeur publiée. Il reste en chaîne
 * pour la même raison que les montants — un `number` passerait par un flottant.
 */
export type CalculatedSource = {
  accountId: string;
  amount: string;
  dimensionId: string;
  hypothesisId: string;
  periodId: string;
};

export type CalculationOutcome =
  | {
      engineVersion: string;
      inputHash: string;
      outputHash: string;
      sources: CalculatedSource[];
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

function normalizeSources(raw: unknown): CalculatedSource[] | null {
  if (!Array.isArray(raw)) {
    return null;
  }

  const sources: CalculatedSource[] = [];
  for (const item of raw) {
    if (
      !isRecord(item) ||
      typeof item.dimension_id !== "string" ||
      typeof item.account_id !== "string" ||
      typeof item.period_id !== "string" ||
      typeof item.hypothesis_id !== "string" ||
      typeof item.amount !== "string"
    ) {
      return null;
    }

    sources.push({
      accountId: item.account_id,
      amount: item.amount,
      dimensionId: item.dimension_id,
      hypothesisId: item.hypothesis_id,
      periodId: item.period_id,
    });
  }

  return sources;
}

/**
 * Décide ce que vaut une réponse du moteur, sans réseau.
 *
 * Séparée de l'appel pour être vérifiable telle quelle : c'est ici que se joue
 * le refus d'un résultat incomplet, et un refus qui ne serait prouvé que par un
 * appel réseau ne serait pas prouvé du tout.
 */
export function readCalculationBody(
  status: number,
  ok: boolean,
  body: unknown,
): CalculationOutcome {
  if (status === 422 && isRecord(body) && typeof body.code === "string") {
    return {
      code: body.code,
      message: typeof body.message === "string" ? body.message : "",
      status: "refused",
    };
  }

  if (!ok || !isRecord(body)) {
    return { detail: `reponse-inattendue-${status}`, status: "unavailable" };
  }

  const values = normalizeValues(body.values);
  const sources = normalizeSources(body.sources);
  if (
    values === null ||
    // Un résultat sans origine ne se publie pas : la base le refuserait de
    // toute façon, mais l'arrêter ici évite d'écrire un run pour rien.
    sources === null ||
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
    sources,
    status: "calculated",
    values,
  };
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

  return readCalculationBody(response.status, response.ok, body);
}
