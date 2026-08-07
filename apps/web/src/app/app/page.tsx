import type { ReactElement } from "react";

export default function AppPage(): ReactElement {
  return (
    <main className="cockpit">
      <p className="eyebrow">Cockpit financier</p>
      <h1>Le périmètre est vérifié.</h1>
      <p className="lede">
        La prochaine tranche ouvrira les dimensions autorisées, sans élargir les droits financiers du membre.
      </p>
      <div className="empty-state">
        <span>01</span>
        <div>
          <h2>Structure budgétaire à configurer</h2>
          <p>Les cycles, dimensions et responsables seront ajoutés dans l’étape suivante.</p>
        </div>
      </div>
    </main>
  );
}
