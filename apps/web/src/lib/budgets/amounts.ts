/**
 * Arithmétique exacte sur les montants publiés.
 *
 * Un montant est un `numeric(24, 6)` de PostgreSQL, transporté en chaîne
 * jusqu'ici. L'additionner en `Number` le ferait passer par un flottant binaire
 * dont la précision plafonne vers 9·10¹⁵ — bien en deçà de ce que la colonne
 * accepte — et où 0,1 + 0,2 ne fait pas 0,3. La convention du produit est
 * explicite : « montants en `numeric`, jamais en flottants ».
 *
 * Le calcul se fait donc en micro-unités entières (10⁻⁶), sur `bigint`, qui
 * n'a pas de borne de précision. `Number` reste employé pour METTRE EN FORME un
 * montant à l'écran, jamais pour en dériver un autre.
 */

/** L'échelle de `budget_values.amount`. */
const SCALE = 6;
const UNIT = BigInt(1_000_000);
const ZERO = BigInt(0);

// `0n` serait plus lisible, mais `tsconfig` cible ES2017, qui interdit les
// littéraux `bigint` (piège déjà payé sur ce projet).

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,6}))?$/;

/**
 * Un montant décimal en micro-unités, ou `null` s'il n'a pas la forme attendue.
 *
 * Un montant illisible ne vaut pas zéro : le confondre avec zéro ferait mentir
 * un total en silence, ce qui est exactement le défaut que ce module corrige.
 */
export function toMicros(amount: string): bigint | null {
  const parts = AMOUNT_PATTERN.exec(amount.trim());
  if (!parts) {
    return null;
  }

  const [, signe, entier, decimales = ""] = parts;
  const micros = BigInt(entier) * UNIT + BigInt(decimales.padEnd(SCALE, "0"));

  return signe === "-" ? -micros : micros;
}

/** La forme décimale d'une valeur en micro-unités, à l'échelle de la colonne. */
export function fromMicros(micros: bigint): string {
  const negatif = micros < ZERO;
  const absolu = negatif ? -micros : micros;
  const entier = absolu / UNIT;
  const reste = (absolu % UNIT).toString().padStart(SCALE, "0");

  return `${negatif ? "-" : ""}${entier.toString()}.${reste}`;
}

/**
 * La somme exacte d'une liste de montants, ou `null` si l'un d'eux est illisible.
 */
export function sumAmounts(amounts: readonly string[]): string | null {
  let total = ZERO;
  for (const amount of amounts) {
    const micros = toMicros(amount);
    if (micros === null) {
      return null;
    }
    total += micros;
  }

  return fromMicros(total);
}

/** La différence exacte de deux montants, ou `null` si l'un est illisible. */
export function subtractAmounts(left: string, right: string): string | null {
  const a = toMicros(left);
  const b = toMicros(right);

  return a === null || b === null ? null : fromMicros(a - b);
}

/**
 * La variation de `base` à `target`, en pour cent à une décimale, ou `null`
 * si un montant est illisible ou si la base est nulle — un rapport à zéro n'a
 * pas de valeur, et « — » vaut mieux qu'un infini.
 *
 * Même arithmétique entière que le reste du module : le rapport est calculé
 * en millièmes de pour cent sur `bigint`, arrondi à la décimale au demi
 * supérieur en valeur absolue, puis écrit. Le piège mesuré le 2026-09-08 — un
 * total en `Number` qui affichait −8,7 % pour −27,8 % réels — ne passe pas ici.
 */
export function percentChange(base: string, target: string): string | null {
  const a = toMicros(base);
  const b = toMicros(target);
  if (a === null || b === null || a === ZERO) {
    return null;
  }

  // (b − a) / a × 100 en centièmes de pour cent (× 10 000), puis arrondi au
  // dixième sur la valeur absolue, et le signe est rétabli.
  const scaled = ((b - a) * BigInt(10000)) / a;
  const negatif = scaled < ZERO;
  const absolu = negatif ? -scaled : scaled;
  const arrondi = (absolu + BigInt(5)) / BigInt(10);
  const entier = arrondi / BigInt(10);
  const decimale = arrondi % BigInt(10);

  return `${negatif && arrondi !== ZERO ? "-" : ""}${entier.toString()}.${decimale.toString()}`;
}

/**
 * Un montant tel que la base l'a envoyé, en texte, ou une erreur.
 *
 * PostgREST sérialise un `numeric` en nombre JSON, et `JSON.parse` le fait
 * passer par un double : au-delà de 2⁵³, les chiffres significatifs sont
 * perdus AVANT que le code ne les voie, et `String()` après coup ne les rend
 * pas. Chaque lecture d'un montant demande donc `amount::text` ; un nombre ici
 * signale une requête qui a perdu son cast — une erreur de programmation, qui
 * ne doit ni s'afficher comme un montant ni disparaître comme une ligne
 * ignorée (un total amputé ment aussi bien qu'un total faux).
 */
export function amountFromRow(raw: unknown, column: string): string {
  if (typeof raw !== "string") {
    throw new Error(`${column} doit arriver en texte (\`::text\`), reçu ${typeof raw}`);
  }

  return raw;
}

/**
 * Montant lisible par un financier : séparateurs de milliers, deux décimales,
 * devise. L'arrondi d'affichage ne touche pas la valeur publiée, qui reste à
 * six décimales en base.
 *
 * La chaîne est donnée telle quelle à `Intl`, qui la lit en décimal exact
 * (ECMA-402, Node 22) : passer par `Number` arrondirait au-delà de 2⁵³. Un
 * texte qui n'a pas la forme d'un montant est rendu tel quel, jamais « NaN ».
 */
export function formatAmount(amount: string, currency: string): string {
  const texte = amount.trim();
  if (!isDecimalLiteral(texte)) {
    return amount;
  }

  return new Intl.NumberFormat("fr-FR", {
    currency,
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  }).format(texte);
}

/** La forme d'un montant, telle qu'`Intl` la lit sans conversion. */
function isDecimalLiteral(value: string): value is `${number}` {
  return AMOUNT_PATTERN.test(value);
}
