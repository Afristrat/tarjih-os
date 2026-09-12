import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Depuis `20260809090100`, chaque migration s'inscrit elle-même au registre
// `supabase_migrations.schema_migrations`, dans sa propre transaction, et son
// retour arrière l'en retire. Le commentaire qui a posé cette convention disait
// qu'elle rendait « impossible » une migration appliquée sans être inscrite,
// « sans dépendre de la discipline de celui qui l'applique ». C'était vrai pour
// celui qui APPLIQUE, faux pour celui qui ÉCRIT : `20260910120000` a été livrée
// sans son inscription, appliquée en production, et la ligne de registre a dû
// être posée à la main. Ce contrôle déplace la discipline du rédacteur vers la
// suite de tests, où elle ne dépend plus de personne.
//
// Les deux premières migrations précèdent la convention : elles ont été posées
// par la CLI Supabase, qui inscrit elle-même ce qu'elle applique.
const PREMIERE_MIGRATION_AUTO_INSCRITE = "20260809090100";

const SUPABASE = join("..", "..", "supabase");

type Migration = { version: string; name: string; file: string };

function migrations(directory: string): Migration[] {
  return readdirSync(directory)
    .filter((entry) => entry.endsWith(".sql"))
    .sort()
    .map((file) => {
      const match = /^(\d{14})_(.+?)(\.down)?\.sql$/.exec(file);
      assert.ok(match, `nom de fichier hors convention <version>_<nom>.sql : ${file}`);
      return { version: match[1], name: match[2], file: join(directory, file) };
    })
    .filter((migration) => migration.version >= PREMIERE_MIGRATION_AUTO_INSCRITE);
}

test("chaque migration s’inscrit elle-même au registre, sous sa propre version et son propre nom", () => {
  const applied = migrations(join(SUPABASE, "migrations"));
  assert.ok(applied.length > 0, "aucune migration lue : le chemin du dossier est faux");

  for (const { version, name, file } of applied) {
    const sql = readFileSync(file, "utf8");
    assert.match(
      sql,
      new RegExp(
        String.raw`insert into supabase_migrations\.schema_migrations \(version, name\)\s*` +
          String.raw`values \('${version}', '${name}'\)\s*on conflict \(version\) do nothing;`,
      ),
      `${file} ne s'inscrit pas au registre sous ('${version}', '${name}') : appliquée, elle` +
        " serait invisible de la seule source qui dise ce qui est posé",
    );
  }
});

test("chaque retour arrière retire sa migration du registre", () => {
  const reverted = migrations(join(SUPABASE, "rollbacks"));
  assert.ok(reverted.length > 0, "aucun retour arrière lu : le chemin du dossier est faux");

  for (const { version, file } of reverted) {
    assert.match(
      readFileSync(file, "utf8"),
      new RegExp(
        String.raw`delete from supabase_migrations\.schema_migrations where version = '${version}';`,
      ),
      `${file} laisse la ligne '${version}' au registre : après lui, le registre mentirait`,
    );
  }
});
