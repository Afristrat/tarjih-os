import Link from "next/link";
import { redirect } from "next/navigation";
import type { ReactElement } from "react";

import {
  createFinancialAccount,
  createPeriod,
} from "@/app/app/settings/reference/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance } from "@/lib/authorization/capabilities";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type AccountRow = {
  code: string;
  id: string;
  name: string;
  normal_balance: string;
  statement: string;
};

type PeriodRow = {
  ends_on: string;
  id: string;
  starts_on: string;
};

const STATEMENT_LABELS: Record<string, string> = {
  balance_sheet: "Bilan",
  cash_flow: "Trésorerie",
  income_statement: "Compte de résultat",
  kpi: "Indicateur",
};

const BALANCE_LABELS: Record<string, string> = {
  credit: "Crédit",
  debit: "Débit",
  none: "Sans sens",
};

const NOTICES: Record<string, { text: string; tone: "fait" | "refus" }> = {
  "account-created": {
    text: "Compte créé. Il peut désormais recevoir des montants calculés.",
    tone: "fait",
  },
  "account-creation-failed": {
    text: "Le compte n’a pas été créé. Ce code existe peut-être déjà.",
    tone: "refus",
  },
  "invalid-account": {
    text: "Renseignez un nom, un code composé de lettres, chiffres ou tirets, un état et un sens.",
    tone: "refus",
  },
  "invalid-period": {
    text: "Renseignez deux dates réelles, au format jour/mois/année.",
    tone: "refus",
  },
  "period-created": { text: "Période créée. Elle est ouverte aux contributions.", tone: "fait" },
  "period-creation-failed": {
    text: "La période n’a pas été créée. Elle existe peut-être déjà à l’identique.",
    tone: "refus",
  },
  "period-reversed": {
    text: "Une période ne peut pas se terminer avant d’avoir commencé.",
    tone: "refus",
  },
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export default async function ReferencePage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();

  // Comptes et périodes sont la matière du calcul officiel : les tenir relève du
  // DAF et du DG, comme le dit la RLS. Un administrateur technique n'y touche
  // pas — il gère les accès, pas le plan comptable.
  if (!canManageFinance(context)) {
    redirect("/app?error=forbidden");
  }

  const params = await searchParams;
  const notice = NOTICES[single(params.success) ?? single(params.error) ?? ""];
  const supabase = await createClient();

  const [accountsResult, periodsResult] = await Promise.all([
    supabase
      .from("financial_accounts")
      .select("id, code, name, statement, normal_balance")
      .eq("tenant_id", context.tenantId)
      .order("code", { ascending: true }),
    supabase
      .from("periods")
      .select("id, starts_on, ends_on")
      .eq("tenant_id", context.tenantId)
      .order("starts_on", { ascending: true }),
  ]);

  const accounts: AccountRow[] = [];
  for (const row of accountsResult.data ?? []) {
    if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.code === "string" &&
      typeof row.name === "string" &&
      typeof row.statement === "string" &&
      typeof row.normal_balance === "string"
    ) {
      accounts.push({
        code: row.code,
        id: row.id,
        name: row.name,
        normal_balance: row.normal_balance,
        statement: row.statement,
      });
    }
  }

  const periods: PeriodRow[] = [];
  for (const row of periodsResult.data ?? []) {
    if (
      isRecord(row) &&
      typeof row.id === "string" &&
      typeof row.starts_on === "string" &&
      typeof row.ends_on === "string"
    ) {
      periods.push({ ends_on: row.ends_on, id: row.id, starts_on: row.starts_on });
    }
  }

  const ready = accounts.length > 0 && periods.length > 0;

  return (
    <main className="console">
      <div className="console-head">
        <Link className="console-back" href="/app/budgets">
          ← Cycles et versions
        </Link>
        <p className="eyebrow">Référentiel</p>
        <h1>Comptes et périodes</h1>
        <p className="lede">
          Un calcul ne produit un montant que sur un compte et une période existants. Ce référentiel
          est donc le préalable de toute consolidation ; chaque ajout est inscrit au journal d’audit.
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      {!ready ? (
        <p className="console-notice" data-tone="refus" role="status">
          {accounts.length === 0 && periods.length === 0
            ? "Aucun compte ni période : un calcul serait refusé faute de référentiel. Créez au moins un compte et une période."
            : accounts.length === 0
              ? "Aucun compte : un calcul serait refusé faute de référentiel."
              : "Aucune période : un calcul serait refusé faute de référentiel."}
        </p>
      ) : null}

      <div className="console-layout">
        <aside className="console-aside">
          <div>
            <p className="console-kicker">Nouveau compte</p>
            <form action={createFinancialAccount} className="console-form">
              <label data-span="full">
                Nom
                <input name="name" required maxLength={160} />
              </label>
              <label>
                Code
                <input name="code" maxLength={64} placeholder="Repris du nom si vide" />
              </label>
              <label>
                État
                <select name="statement" defaultValue="income_statement">
                  <option value="income_statement">Compte de résultat</option>
                  <option value="balance_sheet">Bilan</option>
                  <option value="cash_flow">Trésorerie</option>
                  <option value="kpi">Indicateur</option>
                </select>
              </label>
              <label>
                Sens
                <select name="normal_balance" defaultValue="debit">
                  <option value="debit">Débit — une charge</option>
                  <option value="credit">Crédit — un produit</option>
                  <option value="none">Sans sens — un indicateur</option>
                </select>
              </label>
              <button className="console-button" type="submit">
                Créer le compte
              </button>
            </form>
          </div>

          <div>
            <p className="console-kicker">Nouvelle période</p>
            {/* `type="date"` plutôt qu'un sélecteur maison : le navigateur fournit
                déjà le calendrier, le format local et la saisie au clavier. */}
            <form action={createPeriod} className="console-form">
              <label>
                Début
                <input name="starts_on" required type="date" />
              </label>
              <label>
                Fin
                <input name="ends_on" required type="date" />
              </label>
              <button className="console-button" type="submit">
                Créer la période
              </button>
            </form>
          </div>
        </aside>

        <section className="console-panel">
          <div className="panel-head">
            <div>
              <p className="console-kicker">Comptes</p>
              <h2>
                {accounts.length} compte{accounts.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>

          {accounts.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Compte</th>
                    <th scope="col">État</th>
                    <th scope="col">Sens</th>
                  </tr>
                </thead>
                <tbody>
                  {accounts.map((account) => (
                    <tr key={account.id}>
                      <td className="dimension-cell">
                        <strong>{account.name}</strong>
                        <span>{account.code}</span>
                      </td>
                      <td>{STATEMENT_LABELS[account.statement] ?? account.statement}</td>
                      <td>{BALANCE_LABELS[account.normal_balance] ?? account.normal_balance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="console-empty">
              Aucun compte pour l’instant. Le premier ouvre la voie au calcul.
            </p>
          )}

          <div className="panel-head">
            <div>
              <p className="console-kicker">Périodes</p>
              <h2>
                {periods.length} période{periods.length > 1 ? "s" : ""}
              </h2>
            </div>
          </div>

          {periods.length > 0 ? (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Début</th>
                    <th scope="col">Fin</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map((period) => (
                    <tr key={period.id}>
                      <td>{period.starts_on}</td>
                      <td>{period.ends_on}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="console-empty">
              Aucune période pour l’instant. Une période borne ce qu’un montant couvre.
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
