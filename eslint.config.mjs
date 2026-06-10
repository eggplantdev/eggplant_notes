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
  // Ban raw `process.env.X` in app code (src/**) outside the validated env layer. Every env var must
  // flow through src/lib/env.ts (public) or env.server.ts (server secrets), which validate against
  // env-schema.ts at build — a missing/malformed var fails `next build` instead of throwing deep at
  // runtime. Reading process.env directly bypasses that guarantee (the OPENROUTER_ENC_KEY prod-outage
  // class of bug). Exempt: the env layer itself (env.ts must use static `process.env.NEXT_PUBLIC_*`
  // keys — Next only inlines static references); tests (RUN_INTEGRATION/TZ/seeding); and root configs
  // + e2e/** which fall outside src and read env as test/build infra. NODE_ENV is always exempt
  // (framework-managed, not a schema secret). Rationale: context/foundation/lessons.md.
  {
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/env.ts", "src/lib/env.server.ts", "src/lib/env-schema.ts", "src/__tests__/**"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[object.object.name='process'][object.property.name='env']:not([property.name='NODE_ENV'])",
          message:
            "Read env vars through src/lib/env.ts or env.server.ts (validated against env-schema.ts), never raw process.env. NODE_ENV is the only exception.",
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
