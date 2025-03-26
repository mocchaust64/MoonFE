import path from "path";

const config = {
  "**/*.{ts,mts,cts,tsx}": () => "tsc --noEmit",
  "*.{js,mjs,cjs,jsx,ts,mts,cts,tsx}": (
    /** @type {string[]} */ stagedFiles,
  ) => [
    `next lint --fix --max-warnings=0 --file ${stagedFiles.map((f) => path.relative(process.cwd(), f)).join(" --file ")}`,
    `prettier --write --ignore-unknown --log-level=warn ${stagedFiles.join(" ")}`,
  ],
  "!(*.js|*.mjs|*.cjs|*.jsx|*.ts|*.mts|*.cts|*.tsx)":
    "prettier --write --ignore-unknown --log-level=warn",
};
export default config;
