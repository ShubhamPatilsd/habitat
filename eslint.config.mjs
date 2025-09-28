import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    rules: {
      // Disable unused variable warnings
      "@typescript-eslint/no-unused-vars": "off",

      // Disable explicit any type errors
      "@typescript-eslint/no-explicit-any": "off",

      // Disable React hooks dependency warnings
      "react-hooks/exhaustive-deps": "off",

      // Disable unused import warnings
      "react-hooks/rules-of-hooks": "off",
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
];

export default eslintConfig;
