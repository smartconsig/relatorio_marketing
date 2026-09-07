// Verificador de fiação global: confere que TODA função chamada por handler
// inline (onclick="fn()" em strings HTML) existe como global exposto em
// window.* em algum lugar de src/. É a rede de segurança contra o modo de
// falha mais silencioso deste projeto: mover/renomear uma função e o botão
// morrer sem erro de build.
//
// Uso: node scripts/verifica-handlers.mjs   (sai 1 se houver handler órfão)

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function listar(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) listar(p, out);
    else if (/\.(js|jsx)$/.test(name)) out.push(p);
  }
  return out;
}

const srcFiles = listar(join(ROOT, 'src'));
const htmlFiles = [join(ROOT, 'index.html')];

// ---------------------------------------------------------------------------
// 1. Globais expostos: window.X = ... em qualquer arquivo de src/
// ---------------------------------------------------------------------------
const expostos = new Map(); // nome -> arquivo
for (const file of srcFiles) {
  const code = readFileSync(file, 'utf8');
  for (const m of code.matchAll(/window\.([A-Za-z_$][\w$]*)\s*=/g)) {
    expostos.set(m[1], relative(ROOT, file));
  }
}

// Funções cujo NOME viaja como texto-dado (invisível a regex de atributos).
// NÃO RENOMEAR sem atualizar aqui e nos pontos de origem:
//   boletos-page.js: onSaveFn 'bolSalvarCliente()' / 'bolSalvarEdicao(...)'
//   liberacao-page.js:976: setAttribute('onclick', `libToggleOk(...)`)
const EXIGIDOS_POR_STRING = ['bolSalvarCliente', 'bolSalvarEdicao', 'libToggleOk'];

// ---------------------------------------------------------------------------
// 2. Handlers referenciados: atributos on*="..." em index.html e nos template
//    literals de src/, + setAttribute('onclick', ...), + propriedades onclick:
// ---------------------------------------------------------------------------
const ATTR_RE = /\bon[a-z]+\s*=\s*"([^"]*)"/g;
const SETATTR_RE = /setAttribute\(\s*['"]on[a-z]+['"]\s*,\s*`([^`]*)`/g;
const PROP_RE = /\bonclick:\s*[`'"]([^`'"]+)[`'"]/g;
const CALL_RE = /(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g;

// Identificadores que não são globais do app (nativos, palavras-chave, DOM)
const IGNORAR = new Set([
  'if', 'for', 'while', 'switch', 'catch', 'function', 'return', 'new', 'typeof', 'var', 'let', 'const',
  'alert', 'confirm', 'prompt', 'print',
  'parseInt', 'parseFloat', 'isNaN', 'String', 'Number', 'Boolean', 'Date', 'Array', 'Object', 'JSON',
  'encodeURIComponent', 'decodeURIComponent', 'requestAnimationFrame',
  'setTimeout', 'setInterval', 'clearTimeout', 'clearInterval',
  'getElementById', 'querySelector', 'querySelectorAll', 'remove', 'click', 'focus', 'blur',
  'stopPropagation', 'preventDefault', 'toggle', 'add', 'contains', 'includes', 'replace', 'trim',
]);

const referencias = new Map(); // nome -> [locais]
function coletarChamadas(trechoBruto, local) {
  // Interpolações ${...} rodam em escopo de módulo na hora do render — não são
  // chamadas de runtime do handler; remove antes de extrair identificadores.
  // O segundo replace descarta interpolação truncada pela aspa que encerra o
  // atributo (ex.: '${_esc(nome).replace(/'/g,"...')}' cortada no meio).
  const trecho = trechoBruto
    .replace(/\$\{(?:[^{}]|\{[^{}]*\})*\}/g, '')
    .replace(/\$\{[\s\S]*$/, '');
  for (const call of trecho.matchAll(CALL_RE)) {
    const nome = call[1];
    if (IGNORAR.has(nome)) continue;
    if (!referencias.has(nome)) referencias.set(nome, []);
    const lista = referencias.get(nome);
    if (lista.length < 3) lista.push(local);
  }
}

for (const file of [...srcFiles, ...htmlFiles]) {
  const code = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  for (const m of code.matchAll(ATTR_RE)) coletarChamadas(m[1], rel);
  for (const m of code.matchAll(SETATTR_RE)) coletarChamadas(m[1], rel);
  for (const m of code.matchAll(PROP_RE)) coletarChamadas(m[1], rel);
}

// ---------------------------------------------------------------------------
// 3. Confronto
// ---------------------------------------------------------------------------
const problemas = [];
for (const [nome, locais] of referencias) {
  if (!expostos.has(nome)) {
    problemas.push(`handler órfão: "${nome}" é chamado em [${locais.join(', ')}] mas nenhum arquivo faz window.${nome} =`);
  }
}
for (const nome of EXIGIDOS_POR_STRING) {
  if (!expostos.has(nome)) {
    problemas.push(`global obrigatório sumiu: "${nome}" viaja como string-dado e precisa continuar em window.*`);
  }
}

process.stdout.write(`Globais expostos em window.*: ${expostos.size}\n`);
process.stdout.write(`Funções distintas chamadas por handlers inline: ${referencias.size}\n`);

if (problemas.length) {
  for (const p of problemas) process.stderr.write(`ERRO — ${p}\n`);
  process.stderr.write(`\nFALHA: ${problemas.length} problema(s) de fiação. Um clique vai quebrar em produção.\n`);
  process.exit(1);
}
process.stdout.write('OK — todo handler inline encontra sua função global.\n');
