import { productPillars } from "@/lib/product";
import type { ReactElement } from "react";

export default function Home(): ReactElement {
  return (
    <main>
      <header className="shell flex items-center justify-between py-7">
        <a className="wordmark" href="#top" aria-label="Tarjih — accueil">
          ترجيح <span>Tarjih</span>
        </a>
        <span className="status">Socle en construction</span>
      </header>

      <section id="top" className="shell hero">
        <div>
          <p className="eyebrow">Financial operating model</p>
          <h1>Du budget discuté au budget décidé.</h1>
          <p className="lede">
            Tarjih relie contributions, validations humaines, calculs exacts et
            consolidation dans une seule chaîne de responsabilité.
          </p>
        </div>

        <aside className="decision-card" aria-label="Principe de décision">
          <p className="eyebrow">Principe fondateur</p>
          <p className="decision-copy">
            Une hypothèse proposée n’est jamais un chiffre officiel.
          </p>
          <div className="flow" aria-label="Flux de traitement">
            <span>Proposer</span>
            <b aria-hidden="true">→</b>
            <span>Valider</span>
            <b aria-hidden="true">→</b>
            <span>Calculer</span>
          </div>
        </aside>
      </section>

      <section className="shell pillars" aria-labelledby="pillars-title">
        <div className="section-heading">
          <p className="eyebrow">Première tranche exécutable</p>
          <h2 id="pillars-title">La chaîne d’autorité avant les artifices.</h2>
        </div>

        <div className="pillar-grid">
          {productPillars.map((pillar) => (
            <article key={pillar.label} className="pillar">
              <span>{pillar.label}</span>
              <h3>{pillar.title}</h3>
              <p>{pillar.description}</p>
            </article>
          ))}
        </div>
      </section>

      <footer className="shell footer">
        <p>Tarjih — ترجيح</p>
        <p>La décision financière rendue explicable.</p>
      </footer>
    </main>
  );
}
