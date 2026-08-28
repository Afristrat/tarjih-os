import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

// Une page peut passer typecheck, lint et build tout en s'affichant sans style :
// il suffit que ses classes n'existent nulle part. C'est arrivé — onze classes
// sur douze — et aucun contrôle automatique ne l'a vu ; seul le navigateur l'a
// vu. Ce contrôle-ci le voit.
//
// Le projet écrit ses classes à la main dans `globals.css`. Les rares
// utilitaires Tailwind réellement employés sont énumérés ici : en ajouter un
// devient un geste conscient plutôt qu'une dérive silencieuse vers deux
// vocabulaires concurrents.
const TAILWIND_UTILITIES = new Set(["flex", "items-center", "justify-between", "py-7"]);

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(path);
    }
    return entry.name.endsWith(".tsx") ? [path] : [];
  });
}

function declaredClasses(css: string): Set<string> {
  return new Set(Array.from(css.matchAll(/\.([A-Za-z][\w-]*)/g), (match) => match[1]));
}

function usedClasses(source: string): string[] {
  return Array.from(source.matchAll(/className="([^"]*)"/g))
    .flatMap((match) => match[1].split(/\s+/))
    .filter((name) => name.length > 0);
}

test("aucune page n’utilise une classe qui n’existe nulle part", () => {
  const declared = declaredClasses(readFileSync(join("src", "app", "globals.css"), "utf8"));
  const orphans: string[] = [];

  for (const file of sourceFiles("src")) {
    for (const name of usedClasses(readFileSync(file, "utf8"))) {
      if (!declared.has(name) && !TAILWIND_UTILITIES.has(name)) {
        orphans.push(`${file} → .${name}`);
      }
    }
  }

  assert.deepEqual(orphans, [], `classes sans définition :\n${orphans.join("\n")}`);
});

test("la feuille de style ne garde pas de classe que plus personne n’emploie", () => {
  const css = readFileSync(join("src", "app", "globals.css"), "utf8");
  const used = new Set(sourceFiles("src").flatMap((file) => usedClasses(readFileSync(file, "utf8"))));

  // Seules les classes du vocabulaire applicatif sont contrôlées : celles de la
  // page publique et de l'authentification sont dans le même fichier et suivent
  // les mêmes règles, donc rien n'est exclu ici — une classe morte est morte.
  const unused = Array.from(declaredClasses(css)).filter((name) => !used.has(name));

  assert.deepEqual(unused, [], `classes définies mais employées nulle part :\n${unused.join("\n")}`);
});
