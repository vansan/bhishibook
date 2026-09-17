import next from "eslint-config-next";

const eslintConfig = [
  {
    ignores: ["node_modules/**", ".next/**", ".tmp/**", ".codex_doc_render/**"]
  },
  ...next
];

export default eslintConfig;
