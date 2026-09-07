// Quality gates do projeto (instalados via vibe-coding-toolkit, prompt 08).
// Camada rápida, sem type-checking. As três regras custom vivem em
// ./eslint-rules/ e foram copiadas byte a byte do template — não editar lá.
//
// Forma real do projeto (levantada antes de configurar):
//   - Frontend: src/**/*.{js,jsx} — ESM browser + Preact JSX (runtime automático)
//   - Camada de apresentação: src/pages/ e src/components/
//   - Módulo de dados: src/services/supabase.js exporta `sb` (client Supabase)
//   - Adaptador de log: src/utils/ui.js (handleError/toast)
//   - api/bunny-create.js: serverless Vercel em CommonJS + Node
//   - supabase/functions/: Deno + TypeScript — fora do ESLint (usar `deno lint`)
//   - CDN globals: XLSX, Chart, supabase (index.html) + playerjs/tus (injetados)
import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import globals from "globals";

import quality from "./eslint-rules/index.cjs";

export default defineConfig([
  globalIgnores([
    ".claude/**",
    "node_modules/**",
    "dist/**",
    "supabase/**", // Deno + TS: espree nem faz parse; lint disso é `deno lint`
    "public/**",
    "package-lock.json",
  ]),
  js.configs.recommended,

  // ── Frontend ─────────────────────────────────────────────────────────────
  {
    files: ["src/**/*.{js,jsx}"],
    plugins: { quality },
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: "module",
      parserOptions: { ecmaFeatures: { jsx: true } },
      globals: {
        ...globals.browser,
        XLSX: "readonly", // CDN — index.html:12 (parseBSC.js, import-page.js)
        Chart: "readonly", // CDN — index.html:13 (overview.js)
        supabase: "readonly", // CDN — index.html:14 (services/supabase.js)
        playerjs: "readonly", // injetado em runtime — universidade.js
        tus: "readonly", // injetado em runtime — uni-admin.js
      },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-var": "error",
      "prefer-const": "warn", // baseline: 11 — "error" quando zerar
      // baseline: 23 (imports mortos + variáveis atribuídas e nunca lidas) —
      // volta para "error" quando o burndown zerar a contagem
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
      // Orçamento de tamanho/complexidade: "warn" de propósito — é conversa
      // sobre fatoração, não gate. Promover a "error" quando zerar.
      // Baselines medidos em 07/09/2026 (instalação do gate):
      complexity: ["warn", 12], // baseline: 79
      "max-depth": ["warn", 4], // baseline: 5
      "max-statements": ["warn", 20], // baseline: 62
      "max-params": ["warn", 4], // baseline: 4
      "max-lines-per-function": [
        "warn",
        { max: 150, skipBlankLines: true, skipComments: true },
      ], // baseline: 6
      "max-nested-callbacks": ["error", 3], // baseline: 0 — já nasce como gate
      // baseline: 1 (parceiros-page.js:150) — vira "error" quando zerar
      "no-irregular-whitespace": "warn",
      // 18 arquivos acima do teto em 07/09/2026 — esta lista É a fila de
      // trabalho do refactor (prompt 09): cada arquivo refatorado sai daqui.
      // Arquivo novo NÃO entra na lista: o teto já vale como "error" para ele.
      "quality/max-lines": [
        "error",
        {
          max: 350,
          ignore: [
            "src/pages/boletos-page.js", // 1359
            "src/pages/universidade.js", // 1134
            "src/pages/liberacao-page.js", // 1133
            "src/pages/uni-admin.js", // 1041
            "src/pages/quitacoes-page.js", // 1005
            "src/pages/admin-page.js", // 957
            "src/pages/bm-page.js", // 956
            "src/pages/conteudo-page.js", // 899
            "src/pages/uni-gamificacao.js", // 644
            "src/pages/bsc-page.js", // 585
            "src/navigation.js", // 523
            "src/pages/procv.js", // 444
            "src/pages/parceiros-page.js", // 405
            "src/pages/perfil.js", // 402
            "src/services/auth.js", // 396
            "src/pages/residuos-page.js", // 384
            "src/pages/propostas.js", // 352
          ],
        },
      ],
      // Política acordada em 07/09/2026: console.log proibido; warn/error/info
      // permitidos — são o logging de erro do projeto e a instrumentação da
      // Fase 3 ([Fase3/sombra], [Fase3/B1]), conferida em produção pelo console.
      "quality/no-direct-console": [
        "error",
        {
          allow: ["warn", "error", "info"],
          logger: "handleError()/toast() de src/utils/ui.js",
        },
      ],
      // baseline: 10 páginas importam `sb` direto (universidade 24 chamadas,
      // uni-admin 24, uni-gamificacao 14, admin 9, boletos 3, liberacao 2,
      // bsc/clientes/parceiros 1, quitacoes 0 = import morto). Vira "error"
      // quando os serviços correspondentes existirem e a contagem zerar.
      "quality/no-direct-data-access": [
        "warn",
        {
          modules: ["../services/supabase.js"],
          bindings: ["sb"],
          layers: ["/src/pages/", "/src/components/"],
        },
      ],
    },
  },

  // ── O adaptador de log em si (DEPOIS do bloco que liga a regra) ──────────
  {
    files: ["src/utils/ui.js"],
    rules: { "quality/no-direct-console": "off" },
  },

  // ── Componentes Preact de demo (.jsx) ────────────────────────────────────
  // O no-unused-vars do core não conta uso via JSX (<Badge/>) sem plugin de
  // framework; componentes são PascalCase — o padrão abaixo os isenta.
  {
    files: ["src/**/*.jsx"],
    rules: {
      "no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_|^[A-Z]",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ── Serverless Vercel (CommonJS + Node) ──────────────────────────────────
  {
    files: ["api/**/*.js"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { ...globals.node },
    },
    rules: {
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // ── Tooling Node (ESM) ───────────────────────────────────────────────────
  {
    files: ["vite.config.js", "eslint.config.mjs", "verify.mjs", "scripts/**/*.mjs"],
    languageOptions: {
      sourceType: "module",
      globals: { ...globals.node },
    },
  },

  // ── As próprias regras (CommonJS) ────────────────────────────────────────
  {
    files: ["eslint-rules/**/*.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: { module: "readonly", require: "readonly" },
    },
  },
]);
