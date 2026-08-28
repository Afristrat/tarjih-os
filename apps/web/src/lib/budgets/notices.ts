export type Notice = { text: string; tone: "fait" | "refus" };

// Les trois écrans budgétaires partagent leurs refus parce qu'ils partagent
// leurs actions : une décision refusée pour lecture périmée se dit pareil,
// qu'on vienne de la version ou de l'hypothèse.
const BUDGET_NOTICES: Record<string, Notice> = {
  "cycle-created": { text: "Cycle créé. Il peut désormais recevoir une version candidate.", tone: "fait" },
  "cycle-creation-failed": { text: "Le cycle n’a pas été créé. Ce nom existe peut-être déjà.", tone: "refus" },
  "decision-closed": {
    text: "Cette hypothèse ne se décide plus : elle l’a déjà été, ou sa version est publiée. Une correction passe par une version suivante.",
    tone: "refus",
  },
  "decision-conflict": {
    text: "L’hypothèse a changé depuis votre lecture. Rechargez la page avant de décider : la valeur affichée n’était plus la valeur en base.",
    tone: "refus",
  },
  "decision-failed": { text: "La décision n’a pas été enregistrée.", tone: "refus" },
  "decision-invalid": { text: "Une décision exige un sens — accepter ou rejeter — et un motif écrit.", tone: "refus" },
  "decision-out-of-scope": {
    text: "Cette hypothèse est hors de votre périmètre d’approbation.",
    tone: "refus",
  },
  "decision-recorded": { text: "Décision enregistrée. Elle est inscrite définitivement et ne se réécrit pas.", tone: "fait" },
  "hypothesis-created": { text: "Hypothèse proposée. Elle attend une décision d’un approbateur de la dimension.", tone: "fait" },
  "hypothesis-creation-failed": {
    text: "L’hypothèse n’a pas été enregistrée. Ce paramètre existe peut-être déjà dans cette dimension pour cette version.",
    tone: "refus",
  },
  "hypothesis-updated": { text: "Correction enregistrée. La révision a avancé d’un.", tone: "fait" },
  "invalid-cycle": { text: "Renseignez un nom de cycle.", tone: "refus" },
  "invalid-hypothesis": {
    text: "Renseignez une dimension, un paramètre, une unité et une valeur décimale (jusqu’à six décimales).",
    tone: "refus",
  },
  "version-created": { text: "Version candidate créée. Les contributions peuvent commencer.", tone: "fait" },
  "version-creation-failed": { text: "La version n’a pas été créée.", tone: "refus" },
};

export function single(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export function noticeFrom(params: Record<string, string | string[] | undefined>): Notice | undefined {
  return BUDGET_NOTICES[single(params.success) ?? single(params.error) ?? ""];
}
