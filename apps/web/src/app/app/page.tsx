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
        Les dimensions, les droits, les cycles budgétaires et les hypothèses sont en place. La
        consolidation viendra s’y adosser sans élargir les droits financiers d’un membre.
      </p>
      <div className="empty-state">
        <span>01</span>
        <div>
          <h2>Cycle budgétaire</h2>
          <p>
            Ouvrez un cycle, une version candidate, et laissez les contributions se déposer
            dimension par dimension avant d’être décidées.
          </p>
          <p>
            <Link className="text-button" href="/app/budgets">
              Ouvrir les cycles
            </Link>
          </p>
        </div>
      </div>
      {canManageTenant(context) ? (
        <div className="empty-state">
          <span>02</span>
          <div>
            <h2>Structure et droits</h2>
            <p>
              Déclarez vos dimensions et attribuez les droits fins. Un droit retiré cesse de
              s’appliquer dès la requête suivante.
            </p>
            <p>
              <Link className="text-button" href="/app/settings/dimensions">
                Ouvrir l’administration
              </Link>
            </p>
          </div>
        </div>
      ) : null}
    </main>
  );
}
