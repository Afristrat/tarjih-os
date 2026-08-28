import Link from "next/link";
import type { ReactElement } from "react";

import { requireActiveTenant } from "@/lib/auth/session";
import { canManageTenant } from "@/lib/authorization/capabilities";

export default async function AppPage(): Promise<ReactElement> {
  const context = await requireActiveTenant();

  return (
    <main className="cockpit">
      <p className="eyebrow">Cockpit financier</p>
      <h1>Le périmètre est vérifié.</h1>
      <p className="lede">
        Les dimensions et les droits sont administrables. Les cycles budgétaires, les hypothèses et
        leur consolidation viendront s’y adosser sans élargir les droits financiers d’un membre.
      </p>
      <div className="empty-state">
        <span>01</span>
        <div>
          <h2>Structure budgétaire à configurer</h2>
          <p>
            {canManageTenant(context)
              ? "Commencez par déclarer vos dimensions et attribuer les droits de lecture."
              : "Un administrateur du tenant doit déclarer les dimensions et vous accorder des droits."}
          </p>
          {canManageTenant(context) ? (
            <p>
              <Link className="text-button" href="/app/settings/dimensions">
                Ouvrir l’administration
              </Link>
            </p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
