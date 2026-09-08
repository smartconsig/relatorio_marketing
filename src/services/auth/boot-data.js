// Carga de dados pos-login — Fase 3 / Etapa B1 (fichas como fonte de
// leitura, snapshot como paraquedas). ⚠ onAuthenticated foi movida deste
// arquivo EM BLOCO, sem reorganizacao interna: os 3 caminhos (cache/fichas/
// snapshot), as 2 travas hasLocalEdits() contra carregamento atrasado, os 6
// retornos antecipados e o carimbo import_id|updated_at byte a byte sao
// comportamento validado em producao (07/09/2026) — NAO reordenar.
import { state } from '../../state.js';
import { toast } from '../../utils/ui.js';
import { loadAllGoals } from '../goals-svc.js';
import { syncClassificationsFromSupabase, hasLocalEdits } from '../classifications.js';
import { loadSnapshotFromSupabase, saveSnapshotToSupabase, checkSnapshotTimestamp } from '../snapshot.js';
import { loadImportData, checkImportMeta, loadUserDicts, applyUserDicts } from '../propostas-store.js';
import { loadTrafego } from '../trafego-svc.js';
import { syncPeriodBars } from '../../components/period-bar.js';
import { saveState, loadState, setCacheIndicator, saveSnapshotTimestamp, loadSnapshotTimestamp,
         saveImportStamp, loadImportStamp } from '../../core/storage.js';
import { renderAll, navigate } from '../../navigation.js';
import { renderDiag } from '../../pages/overview.js';
import { populateGoalsForm } from '../../pages/goals-page.js';
import { initBSC } from '../../pages/bsc-page.js';
import { initParceiros } from '../../pages/parceiros-page.js';
import { renderLastSystemEvent, logAction } from '../action-log.js';
import { syncMetaAds } from '../meta-ads.js';
import { syncKolmeya } from '../kolmeya.js';
import { can, perm } from '../permissions.js';
import { A } from './auth-state.js';

/** Reaplica o filtro de período salvo no navegador nas barras de período das telas. */
function restoreSavedFilter() {
  try {
    const savedFilter = localStorage.getItem('sc_filter_v1');
    if (!savedFilter) return;
    state.filterDates = JSON.parse(savedFilter);
    syncPeriodBars();
  } catch {}
}

export async function onAuthenticated() {
  // BSC — carrega em paralelo, não bloqueia o resto
  initBSC();

  // Ranking Parceiros — carrega em paralelo, não bloqueia o resto
  initParceiros();

  // Logs de sistema — carrega em paralelo, não bloqueia
  renderLastSystemEvent('import-last-log', '__import__');
  renderLastSystemEvent('goals-last-log', '__goals__');

  // Metas — carrega todos os períodos
  const allGoals = await loadAllGoals();
  state.allGoals = allGoals;
  const currentPeriodo = new Date().toISOString().slice(0, 7);
  state.goals = allGoals[currentPeriodo] || {};
  populateGoalsForm(state.goals);
  await syncClassificationsFromSupabase();

  // 1. Navega imediatamente pelo hash da URL (antes de qualquer load de dados)
  //    Garante que o F5 mantém a seção correta independente do estado do cache
  const VALID_SECS = new Set(['home','import','overview','ranking','perfil','gestao','propostas','goals','bsc','parceiros','trafego','bms','admin','quitacoes','conteudo','liberacao','boletos','residuos','universidade']);
  const defaultSec = can('home')                                     ? 'home'
    : can('visao_geral')                                             ? 'overview'
    : (can('liberacao_margem') || perm.isAdmin())                    ? 'liberacao'
    : perm.conteudoVisualizar()                                      ? 'conteudo'
    : can('universidade_acessar')                                    ? 'universidade'
    : 'overview';
  // Valida se o usuário tem permissão para acessar a seção
  const canAccessSec = (sec) => {
    if (!sec || !VALID_SECS.has(sec)) return false;
    if (sec === 'home')         return can('home');
    if (sec === 'overview')     return can('visao_geral');
    if (sec === 'universidade') return can('universidade_acessar') || perm.isAdmin();
    if (sec === 'liberacao')    return can('liberacao_margem') || perm.isAdmin();
    if (sec === 'boletos')      return can('quitacao_boleto') || perm.isAdmin();
    if (sec === 'residuos')     return perm.residuosVisualizar();
    if (sec === 'conteudo')     return perm.conteudoVisualizar();
    if (sec === 'trafego')      return perm.trafegoVisualizar();
    if (sec === 'bms')          return perm.bmVisualizar();
    if (sec === 'quitacoes')    return can('quitacoes_visualizar');
    return true;
  };
  const hashSec   = window.location.hash.replace('#', '');
  const storedSec = localStorage.getItem('sc_last_section');
  // Login explícito → sempre cai na Home; F5/restauração → volta para onde estava
  const lastSection = (A.freshLogin && can('home')) ? 'home'
    : (canAccessSec(hashSec) ? hashSec : null)
    || (canAccessSec(storedSec) ? storedSec : null)
    || defaultSec;
  A.freshLogin = false;
  navigate(lastSection);

  // 2. Carrega cache local e preenche os dados
  const hasLocal = (await loadState()) && (state.result?.smartLeads?.length > 0);
  if (hasLocal) {
    setCacheIndicator(true);
    renderAll();
    renderDiag(state.result.diag);
  }

  // Tráfego digitado: fonte oficial dos KPIs — carrega e re-renderiza quando chegar
  loadTrafego().then(ok => { if (ok && state.result) renderAll(); });

  // ── Fase 3 / Etapa B1: as fichas são a fonte de leitura ────────────────────
  // O snapshot continua sendo GRAVADO, mas só é lido se a leitura das fichas
  // falhar (contagem não bate, tabela fora do ar, import pela metade).
  const meta      = await checkImportMeta();
  const metaStamp = meta ? `${meta.import_id}|${meta.updated_at}` : null;

  if (meta && hasLocal && loadImportStamp() === metaStamp) {
    // Cache local veio deste mesmo import — não precisa reler milhares de fichas.
    // As decisões, essas sim, vêm sempre do servidor.
    const dicts = await loadUserDicts();
    if (dicts.confirmedDivergences) state.confirmedDivergences = dicts.confirmedDivergences;
    if (dicts.vendorMappings)       state.vendorMappings       = dicts.vendorMappings;
    applyUserDicts(state.result.entries, dicts);
    // Aqui NÃO se apaga a marca 'manual' do cache: um clique cuja gravação
    // ainda estivesse a caminho do banco sumiria da tela. O sync só acrescenta.
    await syncClassificationsFromSupabase();
    saveState();
    renderAll();
    toast('Dados carregados ⚡');
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
    syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
    return;
  }

  if (meta) {
    const fichas = await loadImportData();
    if (fichas && hasLocalEdits()) {
      // A leitura das fichas leva alguns segundos e a tela já está no ar nesse
      // meio-tempo. Se o usuário classificou algo enquanto ela vinha, aplicar
      // as fichas agora apagaria esses cliques — o próximo login as pega.
      console.warn('[Fase3/B1] classificação feita durante o carregamento — fichas não aplicadas nesta sessão');
      toast('Dados carregados ⚡');
      syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
      syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
      return;
    }
    if (fichas) {
      const { _dicts, ...result } = fichas;
      state.result = result;
      if (_dicts.confirmedDivergences) state.confirmedDivergences = _dicts.confirmedDivergences;
      if (_dicts.vendorMappings)       state.vendorMappings       = _dicts.vendorMappings;
      restoreSavedFilter();
      await syncClassificationsFromSupabase();
      saveState();
      saveImportStamp(metaStamp);
      setCacheIndicator(true);
      renderAll();
      renderDiag(state.result.diag);
      navigate(lastSection);
      toast(hasLocal ? 'Dados sincronizados ☁️' : 'Dados carregados do servidor ☁️');
      syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
      syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
      return;
    }
  }

  // Fichas indisponíveis — abre o paraquedas (snapshot) e registra para a
  // conferência da semana, na mesma consulta de sempre (tipo fase3_sombra).
  console.warn('[Fase3/B1] fichas indisponíveis — leitura caiu no snapshot');
  logAction('__system__', 'Fase3 B1: fichas indisponíveis — leitura caiu no snapshot', 'fase3_sombra');

  // 2. Consulta leve ao Supabase: só o updated_at
  const serverTs = await checkSnapshotTimestamp();
  const localTs  = loadSnapshotTimestamp();

  if (!serverTs) {
    // Supabase não tem dados — usa só o local
    if (!hasLocal) { /* sem dados em lugar nenhum, fica na tela de importar */ }
    else {
      toast('Dados carregados ⚡');
      syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
      syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
    }
    return;
  }

  if (serverTs === localTs && hasLocal) {
    // Cache local está em dia — mas classifications podem ter sido atualizadas em outro computador
    const synced = await syncClassificationsFromSupabase();
    if (synced > 0) { saveState(); renderAll(); }
    toast('Dados carregados ⚡');
    syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
    syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
    return;
  }

  // 3. Servidor tem dados mais novos — baixa o snapshot completo
  if (hasLocal) toast('Sincronizando novos dados…');
  else toast('Carregando dados do servidor…');

  const result = await loadSnapshotFromSupabase();
  if (!result) return;

  if (hasLocalEdits()) {
    // Mesma proteção do caminho das fichas: o download do snapshot demora e a
    // tela já está no ar; aplicá-lo agora apagaria o que foi classificado nesse
    // meio-tempo (causa histórica de classificação que "some sozinha")
    console.warn('[snapshot] classificação feita durante o download — snapshot não aplicado nesta sessão');
    toast('Dados carregados ⚡');
    return;
  }

  const { snapshot, updatedAt } = result;
  // Restaura datas serializadas como string de volta para objetos Date
  if (snapshot.entries) {
    snapshot.entries = snapshot.entries.map(e => ({
      ...e,
      saleDate: e.saleDate ? new Date(e.saleDate) : null,
    }));
  }
  if (snapshot.smartLeads) {
    snapshot.smartLeads = snapshot.smartLeads.map(l => ({
      ...l,
      dataCriacao: l.dataCriacao ? new Date(l.dataCriacao) : null,
    }));
  }
  state.result = snapshot;
  state.confirmedDivergences = snapshot.confirmedDivergences || {};
  state.vendorMappings       = snapshot.vendorMappings       || {};

  restoreSavedFilter();

  const synced = await syncClassificationsFromSupabase();
  if (synced > 0) {
    const newTs = await saveSnapshotToSupabase();
    saveSnapshotTimestamp(newTs || updatedAt);
  } else {
    saveSnapshotTimestamp(updatedAt);
  }

  saveState();
  setCacheIndicator(true);
  renderAll();
  renderDiag(state.result.diag);
  navigate(lastSection);
  toast(hasLocal ? 'Dados sincronizados ☁️' : 'Dados carregados do servidor ☁️');

  // Sincroniza Meta Ads e Kolmeya em background — re-renderiza quando chegar
  syncMetaAds().then(ok => { if (ok && state.result) renderAll(); });
  syncKolmeya().then(ok => { if (ok && state.result) renderAll(); });
}
