import type { Metadata } from "next";
import Link from "next/link";
import type { ReactElement } from "react";

import { LEGAL } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Mentions légales — Tarjih",
  description: "Éditeur, hébergement et propriété intellectuelle du service Tarjih.",
};

export default function MentionsLegalesPage(): ReactElement {
  return (
    <main className="shell legal">
      <p className="eyebrow">Informations légales</p>
      <h1>Mentions légales</h1>

      <section aria-labelledby="editeur-title">
        <h2 id="editeur-title">Éditeur du site</h2>
        <p>{LEGAL.societe}</p>
        <p>{LEGAL.forme}, capital social {LEGAL.capital}</p>
        <p>Siège social : {LEGAL.adresse}</p>
        <p>Registre du commerce : Casablanca, n° {LEGAL.rc}</p>
        <p>ICE : {LEGAL.ice}</p>
        <p>Identifiant fiscal : {LEGAL.identifiantFiscal}</p>
        <p>Directeur de la publication : {LEGAL.directeurPublication}, gérant et associé unique</p>
        <p>Contact : {LEGAL.contact}</p>
      </section>

      <section aria-labelledby="hebergement-title">
        <h2 id="hebergement-title">Hébergement</h2>
        <p>
          Le service est hébergé sur une infrastructure administrée par l’éditeur. La
          protection réseau et la diffusion sont assurées par un prestataire tiers dont les
          points de présence sont situés hors du Maroc.
        </p>
      </section>

      <section aria-labelledby="propriete-title">
        <h2 id="propriete-title">Propriété intellectuelle</h2>
        <p>
          Les contenus, signes distinctifs, logiciels et bases de données du service sont
          protégés par les droits applicables. Toute réutilisation commerciale non autorisée
          est interdite.
        </p>
      </section>

      <section aria-labelledby="donnees-title">
        <h2 id="donnees-title">Données personnelles</h2>
        <p>
          La déclaration préalable auprès de la CNDP et la politique de confidentialité du
          service sont en cours de préparation : aucun numéro de récépissé ni politique publiée
          à ce jour.
        </p>
      </section>

      <p className="legal-updated">Dernière mise à jour : 16 septembre 2026</p>

      <Link className="wordmark" href="/" aria-label="Retour à l’accueil Tarjih">
        ترجيح <span>Tarjih</span>
      </Link>
    </main>
  );
}
