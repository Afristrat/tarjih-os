import Link from "next/link";
import type { ReactElement } from "react";

import { login } from "@/app/login/actions";

const MESSAGES: Record<string, string> = {
  "authentication-required": "Connectez-vous pour accéder à votre espace budgétaire.",
  "invalid-credentials": "L’adresse e-mail ou le mot de passe est incorrect.",
  "invalid-session": "La session n’a pas pu être validée. Reconnectez-vous.",
  "membership-check-failed": "Les autorisations n’ont pas pu être vérifiées.",
  "missing-credentials": "Renseignez votre adresse e-mail et votre mot de passe.",
  "no-membership": "Aucun tenant actif n’est associé à ce compte.",
  suspended: "Votre accès à cette organisation est suspendu.",
};

type LoginPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function getMessage(searchParams: Record<string, string | string[] | undefined>): string | null {
  const code = searchParams.error ?? searchParams.reason;
  return typeof code === "string" ? (MESSAGES[code] ?? null) : null;
}

export default async function LoginPage({ searchParams }: LoginPageProps): Promise<ReactElement> {
  const message = getMessage(await searchParams);

  return (
    <main className="auth-shell">
      <section className="auth-intro">
        <Link className="wordmark" href="/" aria-label="Retour à l’accueil Tarjih">
          ترجيح <span>Tarjih</span>
        </Link>
        <div>
          <p className="eyebrow">Espace sécurisé</p>
          <h1>Décider sur un périmètre maîtrisé.</h1>
          <p className="lede">
            Chaque accès est recalculé depuis les appartenances et autorisations validées du tenant.
          </p>
        </div>
      </section>

      <section className="auth-panel" aria-labelledby="login-title">
        <div>
          <p className="eyebrow">Connexion</p>
          <h2 id="login-title">Accéder à Tarjih</h2>
        </div>
        {message ? <p className="form-message" role="status">{message}</p> : null}
        <form action={login} className="auth-form">
          <label htmlFor="email">Adresse e-mail</label>
          <input id="email" name="email" type="email" autoComplete="email" required />
          <label htmlFor="password">Mot de passe</label>
          <input id="password" name="password" type="password" autoComplete="current-password" required />
          <button type="submit">Se connecter</button>
        </form>
      </section>
    </main>
  );
}
