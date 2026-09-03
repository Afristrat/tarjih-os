import Link from "next/link";
import type { ReactElement, ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { canManageFinance, canManageTenant, roleLabel } from "@/lib/authorization/capabilities";

export default async function ProtectedLayout({ children }: { children: ReactNode }): Promise<ReactElement> {
  const context = await requireActiveTenant();

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <div className="wordmark">ترجيح <span>Tarjih</span></div>
          <p>{context.name} · {context.baseCurrency}</p>
        </div>
        <div className="user-block">
          {/* Un écran sans lien n'existe pas. La navigation porte donc tout ce
              qui est atteignable : le budget pour tout membre, l'administration
              pour ceux qui l'ont. */}
          <nav className="header-nav">
            <Link href="/app">Cockpit</Link>
            <Link href="/app/budgets">Budget</Link>
            {/* Le référentiel relève du DAF et du DG, comme sa RLS le dit : un
                administrateur technique gère les accès, pas le plan comptable. */}
            {canManageFinance(context) ? (
              <Link href="/app/settings/reference">Référentiel</Link>
            ) : null}
            {canManageTenant(context) ? (
              <Link href="/app/settings/dimensions">Administration</Link>
            ) : null}
          </nav>
          <span>{context.userEmail}</span>
          <span className="role-badge">{roleLabel(context)}</span>
          <form action={logout}>
            <button className="text-button" type="submit">Se déconnecter</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
