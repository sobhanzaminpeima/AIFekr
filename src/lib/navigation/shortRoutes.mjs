// Short or retired addresses people and old cards still use, sent to the real page
// instead of a 404. Plain JavaScript because next.config.mjs imports it.
// shortRoutes.test.ts fails if a destination stops being a real page.
export const SHORT_ROUTES = [
  ["/image", "/image/generate"],
  ["/image-studio", "/image/generate"],
  ["/music", "/music/generate"],
  ["/sales-agent", "/crm?tab=agent"],
  ["/leads", "/lead-gen"],
  ["/crm/contacts", "/crm?tab=contacts"],
  ["/startup", "/startup/builder"],
  ["/games", "/play"],
];

// Classic pages whose work now lives in a view of a new-design workspace.
export const MOVED_ROUTES = [
  ["/ceo/orchestrator", "/ceo?tab=orchestrator"],
  ["/student/chat", "/student?view=chat"],
  ["/sales", "/crm?tab=agent"],
  ["/choose-plan", "/plans"],
];
