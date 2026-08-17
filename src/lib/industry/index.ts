// Side-effect imports — each playbook module self-registers via
// registerSalesPlaybook() at import time. Add a new industry here (and only
// here) to make it available; nothing in src/lib/agents should ever import
// an industry-specific module directly.
import "./realEstate/salesPlaybook";
import "./realEstate/socialContentPack";

export * from "./registry";
