// ESLint 9 flat config (Next 16 removed `next lint` and the legacy
// .eslintrc format). Same rules as the previous .eslintrc.json.
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-img-element": "off",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none", ignoreRestSiblings: true }],
      // React Compiler readiness rules that eslint-config-next 16 enables as
      // errors. The app does not run the compiler, and the flagged patterns
      // were valid React before; kept visible as warnings to burn down.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/static-components": "warn",
      "react-hooks/incompatible-library": "warn",
      // Internal <a href> links do a full page load instead of client
      // navigation; being converted to <Link> with the navigation redesign.
      "@next/next/no-html-link-for-pages": "warn",
    },
  },
  { ignores: [".next*/**", "node_modules/**", "analysis/**", "third-party/**", "mobile/**", "tmp/**", "output/**", "graphify-out/**", "tools/**", "next-env.d.ts"] },
];

export default config;
