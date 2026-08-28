import { redirect } from "next/navigation";
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

function message(params: Record<string, string | string[] | undefined>): string | null {
  if (params.success === "dimension-created") return "Dimension créée et auditée.";
  if (params.success === "grant-saved") return "Autorisations appliquées immédiatement.";
  if (params.error) return "L’opération a été refusée. Vérifiez les données et vos droits.";
  return null;
}

export default async function DimensionsPage({ searchParams }: { searchParams: SearchParams }): Promise<ReactElement> {
  const context = await requireActiveTenant();
  if (!canManageTenant(context)) redirect("/app?error=forbidden");

  const supabase = await createClient();
  const [dimensionsResult, membersResult, grantsResult, params] = await Promise.all([
    supabase.from("dimensions").select("id, kind, code, name").eq("tenant_id", context.tenantId).order("kind").order("name"),
    supabase.rpc("list_tenant_members", { target_tenant_id: context.tenantId }),
    supabase.from("dimension_grants").select("user_id, dimension_id, can_read, can_contribute, can_approve, can_export").eq("tenant_id", context.tenantId),
    searchParams,
  ]);

  if (dimensionsResult.error || membersResult.error || grantsResult.error) {
    throw new Error("Impossible de charger la matrice d’autorisations.");
  }

  const dimensions = dimensionsResult.data ?? [];
  const members = (membersResult.data ?? []) as MemberRow[];
  const grants = grantsResult.data ?? [];
  const statusMessage = message(params);

  return (
    <main className="workspace-page">
      <div className="page-heading">
        <div><p className="eyebrow">Administration</p><h1>Dimensions et droits</h1></div>
        <p>Les droits sont évalués par PostgreSQL à chaque requête. Une révocation prend donc effet sans attendre une nouvelle connexion.</p>
      </div>

      {statusMessage ? <p className="inline-message">{statusMessage}</p> : null}

      <section className="workspace-section two-columns">
        <div>
          <p className="section-kicker">Nouvelle dimension</p>
          <h2>Structurer le périmètre</h2>
        </div>
        <form action={createDimension} className="data-form">
          <label>Type<select name="kind" defaultValue="department"><option value="entity">Entité</option><option value="department">Département</option><option value="project">Projet</option><option value="product">Produit</option><option value="channel">Canal</option><option value="geography">Géographie</option></select></label>
          <label>Nom<input name="name" required maxLength={160} /></label>
          <label>Code<input name="code" maxLength={64} placeholder="Généré depuis le nom si vide" /></label>
          <button type="submit">Créer la dimension</button>
        </form>
      </section>

      <section className="workspace-section">
        <div className="section-title-row"><div><p className="section-kicker">Matrice RBAC</p><h2>Attribuer le minimum nécessaire</h2></div><span>{dimensions.length} dimensions · {members.length} membres</span></div>
        <div className="table-scroll">
          <table className="data-table">
            <thead><tr><th>Membre</th><th>Dimension</th><th>Lecture</th><th>Contribution</th><th>Approbation</th><th>Export</th><th /></tr></thead>
            <tbody>
              {members.flatMap((member) => dimensions.map((dimension) => {
                const grant = grants.find((candidate) => candidate.user_id === member.user_id && candidate.dimension_id === dimension.id);
                return (
                  <tr key={`${member.user_id}-${dimension.id}`}>
                    <td><strong>{member.email}</strong><small>{member.role}{member.is_tenant_admin ? " · admin" : ""}</small></td>
                    <td>{dimension.name}<small>{dimension.kind}</small></td>
                    <td colSpan={5}>
                      <form action={saveDimensionGrant} className="permission-form">
                        <input type="hidden" name="user_id" value={member.user_id} />
                        <input type="hidden" name="dimension_id" value={dimension.id} />
                        <label><input type="checkbox" name="can_read" defaultChecked={grant?.can_read ?? false} /><span>Lire</span></label>
                        <label><input type="checkbox" name="can_contribute" defaultChecked={grant?.can_contribute ?? false} /><span>Contribuer</span></label>
                        <label><input type="checkbox" name="can_approve" defaultChecked={grant?.can_approve ?? false} /><span>Approuver</span></label>
                        <label><input type="checkbox" name="can_export" defaultChecked={grant?.can_export ?? false} /><span>Exporter</span></label>
                        <button type="submit">Enregistrer</button>
                      </form>
                    </td>
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
