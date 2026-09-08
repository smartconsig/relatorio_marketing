// Núcleo do Criador de Cursos: estado compartilhado (store U), factories de
// registros vazios e helpers de UI. Todos os módulos uadm-* importam daqui.

export function emptyCurso() {
  return {
    id: null, titulo: '', descricao: '', trilha_id: '',
    nivel: 'basico', instrutor: '', ativo: false,
    destaque: false, capa_url: '', hero_img: '',
  };
}
export function emptyProva() {
  return {
    id: null, curso_id: null, ativa: false,
    nota_minima: 70, max_tentativas: 3, dias_para_retry: 7,
    tem_certificado: true,
  };
}
export function emptyModulo(ordem) {
  return { _key: `m${Date.now()}${Math.random()}`, id: null, titulo: '', ordem, aulas: [] };
}
export function emptyAula(ordem) {
  return {
    _key: `a${Date.now()}${Math.random()}`, id: null, titulo: '',
    tipo: 'video', bunny_video_id: '', duracao_segundos: '',
    ordem, _up: null,
  };
}
export function emptyQuestao(ordem) {
  return {
    _key: `q${Date.now()}${Math.random()}`, id: null,
    enunciado: '', alternativas: ['', '', '', ''], correta: 0, ordem,
  };
}

// Objeto único mutável: os módulos leem/escrevem U.campo (bindings ESM são
// somente-leitura no importador; reatribuir variável importada quebraria).
export const U = {
  trilhas: [],
  cursos: [],
  // Estado do editor
  curso: emptyCurso(),
  modulos: [],
  prova: emptyProva(),
  questoes: [],
  deletes: { modulos: [], aulas: [], questoes: [] },
  saving: false,
};

// ── Utils ──────────────────────────────────────────────────────────────────
export function nivelBadge(nivel) {
  const map = { basico: ['#22c55e','Básico'], intermediario: ['#fbbf24','Intermediário'], avancado: ['#f87171','Avançado'] };
  const [cor, label] = map[nivel] || ['#555','—'];
  return `<span style="font-size:10px;font-family:var(--font-h);font-weight:700;color:${cor}">${label}</span>`;
}

export function spinner() {
  return `<div style="display:flex;align-items:center;justify-content:center;height:60vh">
    <div style="width:24px;height:24px;border:2px solid #1e1e1e;border-top-color:var(--red);border-radius:50%;animation:uni-spin .7s linear infinite"></div>
  </div>`;
}

// ⚠ Escapa só `"` e `<` de propósito — trocar por um escape "melhor" causaria
// duplo-escape de conteúdo já salvo no banco (ver relatório da varredura).
export function esc(s) { return (s || '').replace(/"/g, '&quot;').replace(/</g, '&lt;'); }
