import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    rules: {
      // Une `const` lue dans une fermeture AVANT sa déclaration passe le
      // typecheck et casse à l'exécution (zone morte temporelle) : l'écran de
      // consolidation l'a fait le 2026-09-15, sur la production, dans un `sort`.
      // Les fonctions déclarées sont hissées, elles restent libres.
      "@typescript-eslint/no-use-before-define": [
        "error",
        { classes: true, functions: false, variables: true },
      ],
    },
  },
]);

export default eslintConfig;
