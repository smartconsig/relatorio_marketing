export const state = {
  raw: { smart: null, ecorban: null, fb03: null, fb06: null, overrides: null },
  overrides: {},
  confirmedDivergences: {},
  vendorMappings: {},          // { ecorbanNormName: smartNormName }
  result: null,
  chart: null,
  filterDates: { start: null, end: null },
  currentUser: null,        // { id, email, nomeDisplay, grupoNome, permissoes:{}, profile:{} }
  gestaoTab: 'procv',
  procvFilter: 'pending',
  procvSearch: '',
  clientesFilter: 'all',
  clientesSearch: '',
  propostasFilter: { status: 'all', produto: 'all', origem: 'all', audiencia: 'all', search: '', page: 1 },
  procvSort:      { col: null, dir: 'asc' },
  clientesSort:   { col: null, dir: 'asc' },
  propostasSort:  { col: 'cliente', dir: 'asc' },
  bsc: null,
  metaAds:   null,      // { invest, leads, daily:[{date,invest,leads}], lastSync }
  trafego:   null,      // [{ dia:'YYYY-MM-DD', investimento, leads, cliques, impressoes, alcance }] — fonte oficial dos KPIs
};
