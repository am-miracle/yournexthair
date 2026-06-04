const nextCoreWebVitals = require("eslint-config-next/core-web-vitals")

module.exports = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "coverage/**",
      "public/**",
      "integration-tests/**",
      // "**/*.d.ts",
      // "next-env.d.ts",
      ".env",
      ".env.local",
      ".env.*.local",
      ".eslintcache",
      "pnpm-lock.yaml",
      "package-lock.json",
    ],
  },
  {
    files: ["e2e/**"],
    rules: {
      "react-hooks/rules-of-hooks": "off",
    },
  },
  {
    rules: {
      "no-console": [
        "warn",
        {
          allow: ["warn", "error", "info"],
        },
      ],
      "no-debugger": "error",
      "no-duplicate-imports": "error",
      "no-var": "error",
      "prefer-const": "error",
      "prefer-arrow-callback": "warn",
      "object-shorthand": "warn",
      eqeqeq: ["error", "always"],
      "@next/next/no-img-element": "warn",
    },
  },
]
