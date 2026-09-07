// Itens do float rail (menu flutuante da sidebar recolhida) — dados puros.
// Itens standalone têm { sec, title, badgeId, svg }.
// Grupos têm { group, title, svg, children: [{ sec, title, svg }] }.
export const FLOAT_NAV_ITEMS = [
  {
    sec: 'home', title: 'Home', badgeId: null,
    svg: '<path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>',
  },
  {
    sec: 'import', title: 'Importar', badgeId: null,
    svg: '<path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>',
  },
  {
    group: 'dashboard', title: 'Dashboard',
    svg: '<line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>',
    children: [
      { sec: 'overview', title: 'Visão Geral',      svg: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>' },
      { sec: 'bsc',      title: 'Ranking BSC',      svg: '<path d="M8 6l4-4 4 4"/><path d="M12 2v10"/><path d="M3 18h3v3h12v-3h3"/><path d="M6 15v3"/><path d="M18 15v3"/><path d="M12 12v6"/>' },
      { sec: 'parceiros', title: 'Ranking Parceiros', svg: '<rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/>' },
      { sec: 'perfil',   title: 'Perfil de Cliente', svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="21" x2="23" y2="15"/><line x1="16" y1="15" x2="16" y2="21"/><polyline points="20 18 23 21 26 18"/>' },
    ],
  },
  {
    group: 'gestao-grp', title: 'Gestão',
    svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>',
    children: [
      { sec: 'gestao',  title: 'Gestão',  svg: '<path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>' },
      { sec: 'ranking', title: 'Ranking', svg: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>' },
    ],
  },
  {
    group: 'comercial', title: 'Comercial',
    svg: '<rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v16"/>',
    children: [
      { sec: 'propostas', title: 'Propostas', svg: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/>' },
      { sec: 'goals',     title: 'Metas',     svg: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>' },
    ],
  },
  {
    group: 'marketing', title: 'Marketing',
    svg: '<path d="M3 11l18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 11-5.8-1.6"/>',
    children: [
      { sec: 'trafego', title: 'Tráfego (Ads)', svg: '<line x1="12" y1="20" x2="12" y2="10"/><line x1="18" y1="20" x2="18" y2="4"/><line x1="6" y1="20" x2="6" y2="16"/>' },
      { sec: 'bms',     title: 'BMs',           svg: '<path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72c.13.96.36 1.9.7 2.81a2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.9.34 1.85.57 2.81.7A2 2 0 0122 16.92z"/>' },
    ],
  },
  {
    group: 'tarefas', title: 'Tarefas',
    svg: '<polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/>',
    children: [
      { sec: 'conteudo', title: 'Conteúdo', svg: '<rect x="3" y="3" width="5" height="18" rx="1"/><rect x="10" y="3" width="5" height="12" rx="1"/><rect x="17" y="3" width="4" height="8" rx="1"/>' },
    ],
  },
  {
    group: 'financeiro', title: 'Financeiro',
    svg: '<line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/>',
    children: [
      { sec: 'quitacoes', title: 'Quitações',    svg: '<path d="M9 14l2 2 4-4"/><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
      { sec: 'liberacao', title: 'Lib. Margem',  svg: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>' },
      { sec: 'boletos',   title: 'Quit. Boleto', svg: '<rect x="3" y="5" width="18" height="14" rx="2"/><line x1="7" y1="9" x2="7" y2="15"/><line x1="10" y1="9" x2="10" y2="15"/><line x1="13" y1="9" x2="13" y2="15"/><line x1="17" y1="9" x2="17" y2="15"/>' },
      { sec: 'residuos',  title: 'Resíduos',     svg: '<path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="13" y2="17"/>' },
    ],
  },
  {
    sec: 'universidade', title: 'Universidade', badgeId: null,
    svg: '<polygon points="12 2 22 8.5 12 15 2 8.5 12 2"/><path d="M12 15v7"/><path d="M6 11.8v5.5c3.3 2.8 8.7 2.8 12 0v-5.5"/>',
  },
  {
    sec: 'admin', title: 'Administração', badgeId: null,
    svg: '<circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 10-16 0"/><circle cx="19" cy="19" r="3"/><line x1="19" y1="16" x2="19" y2="19"/><line x1="19" y1="19" x2="22" y2="19"/>',
  },
];
