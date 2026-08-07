import type { ReactElement, ReactNode } from "react";

import { logout } from "@/app/login/actions";
import { requireActiveTenant } from "@/lib/auth/session";

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
          <span>{context.userEmail}</span>
          <span className="role-badge">{context.role}</span>
          <form action={logout}>
            <button className="text-button" type="submit">Se déconnecter</button>
          </form>
        </div>
      </header>
      {children}
    </div>
  );
}
