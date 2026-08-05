import { FlatCompat } from "@eslint/eslintrc";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const ignores = [
  ".next/**",
  "**/.next/**",
  ".next/types/**",
  "**/.next/types/**",
  "node_modules/**",
  "dist/**",
  "out/**",
  "coverage/**",
];

const eslintConfig = [
  {
    ignores,
  },
  ...compat
    .config({
      extends: ["next/core-web-vitals", "next/typescript"],
    })
    .map((config) => ({
      ...config,
      ignores: [...ignores, ...(config.ignores ?? [])],
    })),
];

export default eslintConfig;
