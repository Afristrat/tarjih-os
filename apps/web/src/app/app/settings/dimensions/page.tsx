import { redirect } from "next/navigation";
import Link from "next/link";
import type { ReactElement } from "react";

import { createDimension, saveDimensionGrant } from "@/app/app/settings/dimensions/actions";
import { requireActiveTenant } from "@/lib/auth/session";
import { canManageTenant } from "@/lib/authorization/capabilities";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type MemberRow = {
  email: string;
  is_tenant_admin: boolean;
  role: string;
  status: string;
  user_id: string;
};

type GrantRow = {
  can_approve: boolean;
  can_contribute: boolean;
  can_export: boolean;
  can_read: boolean;
  dimension_id: string;
  user_id: string;
};

const PERMISSIONS = [
  { field: "can_read", label: "Lecture" },
  { field: "can_contribute", label: "Contribution" },
  { field: "can_approve", label: "Approbation" },
  { field: "can_export", label: "Export" },
] as const;

const KINDS: Record<string, string> = {
  channel: "Canal",
  department: "Département",
  entity: "Entité",
  geography: "Géographie",
  product: "Produit",
  project: "Projet",
};

const NOTICES: Record<string, { text: string; tone: "fait" | "refus" }> = {
  "creation-failed": { text: "La dimension n’a pas été créée. Ce code existe peut-être déjà.", tone: "refus" },
  "dimension-created": { text: "Dimension créée. La mutation est inscrite au journal d’audit.", tone: "fait" },
  "grant-failed": { text: "Les droits n’ont pas été enregistrés. Vérifiez vos autorisations.", tone: "refus" },
  "grant-saved": { text: "Droits enregistrés. Ils s’appliquent dès la requête suivante.", tone: "fait" },
  "invalid-dimension": { text: "Renseignez un nom, et un code composé de lettres, chiffres ou tirets.", tone: "refus" },
  "invalid-grant": { text: "Le membre ou la dimension n’a pas été reconnu.", tone: "refus" },
};

function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

// Ce qu'un membre voit réellement, dit en clair. Un DAF ou un DG tient ses
// droits de son rôle : aucune ligne de grant n'apparaîtra jamais pour lui, et
// afficher « aucun accès » serait faux.
function scopeOf(
  member: MemberRow,
  grants: readonly GrantRow[],
  totalDimensions: number,
): { label: string; tone: "totale" | "partielle" | "aucune" } {
  if (member.role === "daf" || member.role === "dg") {
    return { label: "Tout le périmètre, par son rôle", tone: "totale" };
  }

  const readable = grants.filter((grant) => grant.user_id === member.user_id && grant.can_read).length;
  if (readable === 0) {
    return { label: "Aucun chiffre", tone: "aucune" };
  }

  return {
    label: `${readable} dimension${readable > 1 ? "s" : ""} sur ${totalDimensions}`,
    tone: "partielle",
  };
}

export default async function DimensionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<ReactElement> {
  const context = await requireActiveTenant();
  if (!canManageTenant(context)) {
    redirect("/app?error=forbidden");
  }

  const supabase = await createClient();
  const [dimensionsResult, membersResult, grantsResult, params] = await Promise.all([
    supabase
      .from("dimensions")
      .select("id, kind, code, name")
      .eq("tenant_id", context.tenantId)
      .order("kind")
      .order("name"),
    supabase.rpc("list_tenant_members", { target_tenant_id: context.tenantId }),
    supabase
      .from("dimension_grants")
      .select("user_id, dimension_id, can_read, can_contribute, can_approve, can_export")
      .eq("tenant_id", context.tenantId),
    searchParams,
  ]);

  if (dimensionsResult.error || membersResult.error || grantsResult.error) {
    throw new Error("Impossible de charger la matrice d’autorisations.");
  }

  const dimensions = dimensionsResult.data ?? [];
  const members = (membersResult.data ?? []) as MemberRow[];
  const grants = (grantsResult.data ?? []) as GrantRow[];

  const requested = single(params.membre);
  const selected = members.find((member) => member.user_id === requested) ?? members[0];
  const notice = NOTICES[single(params.success) ?? single(params.error) ?? ""];

  return (
    <main className="console">
      <div className="console-head">
        <p className="eyebrow">Administration</p>
        <h1>Dimensions et droits</h1>
        <p className="lede">
          PostgreSQL réévalue les droits à chaque requête : une révocation s’applique sans attendre
          une reconnexion, et chaque changement est inscrit au journal d’audit.
        </p>
      </div>

      {notice ? (
        <p className="console-notice" data-tone={notice.tone} role="status">
          {notice.text}
        </p>
      ) : null}

      <div className="console-layout">
        <aside className="console-aside">
          <div>
            <p className="console-kicker">Nouvelle dimension</p>
            <form action={createDimension} className="console-form">
              <label>
                Type
                <select name="kind" defaultValue="department">
                  <option value="entity">Entité</option>
                  <option value="department">Département</option>
                  <option value="project">Projet</option>
                  <option value="product">Produit</option>
                  <option value="channel">Canal</option>
                  <option value="geography">Géographie</option>
                </select>
              </label>
              <label>
                Nom
                <input name="name" required maxLength={160} />
              </label>
              <label>
                Code
                <input name="code" maxLength={64} placeholder="Repris du nom si vide" />
              </label>
              <button className="console-button" type="submit">
                Créer la dimension
              </button>
            </form>
          </div>

          <div>
            <p className="console-kicker">Membres · {members.length}</p>
            <ul className="member-list">
              {members.map((member) => {
                const scope = scopeOf(member, grants, dimensions.length);
                const current = member.user_id === selected?.user_id;
                return (
                  <li key={member.user_id}>
                    <Link
                      aria-current={current}
                      className="member-entry"
                      href={`/app/settings/dimensions?membre=${member.user_id}`}
                    >
                      <strong>{member.email}</strong>
                      <span>
                        {member.role}
                        {member.is_tenant_admin ? " · administration" : ""}
                      </span>
                      <span className="member-scope" data-scope={scope.tone}>
                        {scope.label}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </aside>

        <section className="console-panel">
          <div className="panel-head">
            <div>
              <p className="console-kicker">Droits accordés</p>
              <h2>{selected ? selected.email : "Aucun membre"}</h2>
            </div>
            <p>
              {dimensions.length} dimension{dimensions.length > 1 ? "s" : ""} · accordez le minimum
              nécessaire
            </p>
          </div>

          {selected && dimensions.length > 0 ? (
            <>
              {dimensions.map((dimension) => (
                <form
                  action={saveDimensionGrant}
                  id={`grant-${dimension.id}`}
                  key={`form-${dimension.id}`}
                >
                  <input type="hidden" name="user_id" value={selected.user_id} />
                  <input type="hidden" name="dimension_id" value={dimension.id} />
                </form>
              ))}

              <div className="grant-scroll">
                <table className="grant-table">
                  <thead>
                    <tr>
                      <th scope="col">Dimension</th>
                      {PERMISSIONS.map((permission) => (
                        <th key={permission.field} scope="col">
                          {permission.label}
                        </th>
                      ))}
                      <th scope="col">
                        <span className="visually-hidden">Enregistrer</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {dimensions.map((dimension) => {
                      const grant = grants.find(
                        (candidate) =>
                          candidate.user_id === selected.user_id &&
                          candidate.dimension_id === dimension.id,
                      );
                      return (
                        <tr key={dimension.id}>
                          <td className="dimension-cell">
                            <strong>{dimension.name}</strong>
                            <span>
                              {KINDS[dimension.kind] ?? dimension.kind} · {dimension.code}
                            </span>
                          </td>
                          {PERMISSIONS.map((permission) => (
                            <td className="grant-cell" key={permission.field}>
                              <input
                                aria-label={`${permission.label} sur ${dimension.name}`}
                                defaultChecked={grant?.[permission.field] ?? false}
                                form={`grant-${dimension.id}`}
                                name={permission.field}
                                type="checkbox"
                              />
                            </td>
                          ))}
                          <td>
                            <button
                              className="console-button"
                              data-variant="discret"
                              form={`grant-${dimension.id}`}
                              type="submit"
                            >
                              Enregistrer
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="console-empty">
              {dimensions.length === 0
                ? "Aucune dimension pour l’instant. Créez la première pour ouvrir des droits."
                : "Aucun membre à administrer."}
            </p>
          )}
        </section>
      </div>
    </main>
  );
}
