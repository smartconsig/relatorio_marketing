// Home — tela de boas-vindas. Todo usuário cai aqui ao logar; o F5 mantém
// a tela em que a pessoa estava (ver onAuthenticated em auth.js).
import { state } from '../state.js';
import { can, canSeeGestao, perm } from '../services/permissions.js';

const ATALHOS = [
  { sec: 'import',       titulo: 'Importar Dados',    desc: 'Planilhas Smart e Ecorban',        pode: () => can('importacao_ecorban') || can('importacao_processar'),
    svg: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  { sec: 'overview',     titulo: 'Visão Geral',       desc: 'KPIs e resultados de marketing',   pode: () => can('visao_geral'),
    svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
  { sec: 'gestao',       titulo: 'Gestão',            desc: 'Classificações e revisões',        pode: () => canSeeGestao(),
    svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>' },
  { sec: 'ranking',      titulo: 'Ranking',           desc: 'Vendas por vendedor e funil',      pode: () => can('ranking'),
    svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
  { sec: 'trafego',      titulo: 'Tráfego (Ads)',     desc: 'Investimento e leads do dia',      pode: () => perm.trafegoVisualizar(),
    svg: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>' },
  { sec: 'bms',          titulo: 'Central de BMs',    desc: 'Números oficiais e banimentos',    pode: () => perm.bmVisualizar(),
    svg: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>' },
  { sec: 'propostas',    titulo: 'Propostas',         desc: 'Propostas de marketing',           pode: () => can('propostas'),
    svg: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>' },
  { sec: 'goals',        titulo: 'Metas',             desc: 'Metas de KPI do período',          pode: () => can('metas_visualizar'),
    svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
  { sec: 'conteudo',     titulo: 'Conteúdo',          desc: 'Esteira de produção de conteúdo',  pode: () => perm.conteudoVisualizar(),
    svg: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>' },
  { sec: 'bsc',          titulo: 'Ranking BSC',       desc: 'Balanced Scorecard do time',       pode: () => can('bsc'),
    svg: '<path d="M8 6l4-4 4 4"/><path d="M12 2v10"/><path d="M3 18h3v3h12v-3h3"/><path d="M6 15v3"/><path d="M18 15v3"/><path d="M12 12v6"/>' },
  { sec: 'parceiros',    titulo: 'Ranking Parceiros', desc: 'Produção por parceiro',            pode: () => perm.parceiros(),
    svg: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>' },
  { sec: 'quitacoes',    titulo: 'Quitações',         desc: 'Gestão de quitações',              pode: () => can('quitacoes_visualizar'),
    svg: '<path d="M9 14l2 2 4-4"/><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { sec: 'liberacao',    titulo: 'Lib. Margem',       desc: 'Liberação de Margem Master',       pode: () => can('liberacao_margem') || perm.isAdmin(),
    svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
  { sec: 'boletos',      titulo: 'Quit. Boleto',      desc: 'Quitação de boletos',              pode: () => can('quitacao_boleto') || perm.isAdmin(),
    svg: '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/>' },
  { sec: 'universidade', titulo: 'Universidade',      desc: 'Treinamentos e certificados',      pode: () => can('universidade_acessar') || perm.isAdmin(),
    svg: '<polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><path d="M12 15v7"/><path d="M6 11.8v5.5c3.3 2.8 8.7 2.8 12 0v-5.5"/>' },
  { sec: 'admin',        titulo: 'Administração',     desc: 'Usuários e grupos de acesso',      pode: () => perm.isAdmin(),
    svg: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/>' },
];

function _saudacao() {
  const h = new Date().getHours();
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function renderHome() {
  const sec = document.getElementById('sec-home');
  if (!sec) return;

  const nome = (state.currentUser?.nomeDisplay || state.currentUser?.email || '').split(' ')[0];
  const dataExtenso = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  });

  const cards = ATALHOS.filter(a => a.pode()).map(a => `
    <div class="home-card" onclick="navigate('${a.sec}')">
      <div class="home-card-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${a.svg}</svg></div>
      <div class="home-card-txt">
        <div class="home-card-title">${a.titulo}</div>
        <div class="home-card-desc">${a.desc}</div>
      </div>
    </div>`).join('');

  sec.innerHTML = `
    <div class="home-hero">
      <div class="home-greet">${_saudacao()}, ${nome}!</div>
      <div class="home-date">${dataExtenso.charAt(0).toUpperCase() + dataExtenso.slice(1)}</div>
    </div>
    <div class="section-title" style="margin-top:28px"><span class="bar"></span>Acesso rápido</div>
    <div class="home-grid">${cards}</div>`;
}
