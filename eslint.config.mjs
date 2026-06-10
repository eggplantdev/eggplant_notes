import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Disable ESLint rules that conflict with Prettier formatting.
  // Must come last so it overrides earlier configs.
  prettier,
  // Enforce the @/ path alias over parent-relative imports (../, ../../).
  // Same-directory imports (./) are allowed. Mirrors the global agent rule.
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../*"],
              message:
                "Use the @/ path alias instead of parent-relative imports (../). See tsconfig.json `paths`.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    // Playwright runs a separate production build into .next-e2e (distDir override) so it
    // never clobbers the dev .next — same generated output, never lint it.
    ".next-e2e/**",
    // The prod-build-server skill builds into .next-prodtest (distDir override) — same
    // generated output as .next, never lint it.
    ".next-prodtest/**",
    // Other distDir-override build outputs (perf audits, webpack-vs-turbopack comparisons) —
    // same generated output as .next, gitignored, never lint them.
    ".next-perf/**",
    ".next-webpack/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Throwaway per-change git worktrees (already gitignored) carry their own source
    // copies + generated .next builds — never lint them.
    ".claude/**",
  ]),
]);

export default eslintConfig;
