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
