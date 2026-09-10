// Modal "Novo Usuario" da aba Usuarios: cria o acesso com senha direta
// (padrao) ou envia convite por e-mail. Extraido de users-tab.js.
import { invokeInviteUser } from '../../services/admin-svc.js';
import { ensureGrupos } from './admin-store.js';
import { loadUsers } from './users-tab.js';

// ── Modal: convidar usuário ──────────────────────────────────────────────────
export async function openInviteModal() {
  // Garante que os grupos estão carregados
  const grupos = await ensureGrupos();

  const modal   = document.getElementById('admin-modal');
  const content = document.getElementById('admin-modal-content');

  content.innerHTML = `
    <h2 class="modal-title">Novo Usuário</h2>
    <p class="modal-desc" id="invite-mode-desc">Defina a senha inicial agora e informe ao usuário — ele já entra direto, sem depender de e-mail.</p>
    <div class="form-group">
      <label>Como criar o acesso?</label>
      <div style="display:flex;gap:16px;padding:4px 0">
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;cursor:pointer">
          <input type="radio" name="invite-mode" value="password" checked> Definir senha agora
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-weight:400;text-transform:none;cursor:pointer">
          <input type="radio" name="invite-mode" value="email"> Enviar convite por e-mail
        </label>
      </div>
    </div>
    <div class="form-group">
      <label>E-mail *</label>
      <input type="email" id="invite-email" placeholder="email@exemplo.com" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Nome completo *</label>
      <input type="text" id="invite-nome" placeholder="Ex: João Silva" autocomplete="off">
    </div>
    <div class="form-group">
      <label>Grupo de Acesso *</label>
      <select id="invite-grupo">
        <option value="">— Selecione um grupo —</option>
        ${grupos.map(g => `<option value="${g.id}">${g.nome}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Nome do Operador <span style="font-weight:400;text-transform:none">(opcional — para vincular ao ranking)</span></label>
      <input type="text" id="invite-operador" placeholder="Nome exato como aparece no ranking" autocomplete="off">
    </div>
    <div id="invite-pass-fields">
      <div class="form-group">
        <label>Senha inicial *</label>
        <input type="password" id="invite-pass-1" placeholder="Mínimo 8 caracteres" autocomplete="new-password">
      </div>
      <div class="form-group">
        <label>Confirmar senha *</label>
        <input type="password" id="invite-pass-2" placeholder="Repita a senha" autocomplete="new-password">
      </div>
    </div>
    <div id="invite-feedback" style="display:none;padding:10px 12px;border-radius:7px;font-size:13px;margin-bottom:4px"></div>
    <div class="modal-footer">
      <button class="btn-secondary" onclick="document.getElementById('admin-modal').style.display='none'">Cancelar</button>
      <button class="btn-primary" id="btn-send-invite">Criar Usuário</button>
    </div>
  `;

  modal.style.display = 'flex';
  document.getElementById('invite-email').focus();

  // Alterna campos de senha e textos conforme o modo escolhido
  content.querySelectorAll('input[name="invite-mode"]').forEach(radio => {
    radio.addEventListener('change', () => {
      const isPass = _getInviteMode() === 'password';
      document.getElementById('invite-pass-fields').style.display = isPass ? '' : 'none';
      document.getElementById('btn-send-invite').textContent = isPass ? 'Criar Usuário' : 'Enviar Convite';
      document.getElementById('invite-mode-desc').textContent = isPass
        ? 'Defina a senha inicial agora e informe ao usuário — ele já entra direto, sem depender de e-mail.'
        : 'O usuário receberá um e-mail com link para criar a senha e acessar o sistema.';
    });
  });

  document.getElementById('btn-send-invite').addEventListener('click', async () => {
    const feedback = document.getElementById('invite-feedback');
    const btn      = document.getElementById('btn-send-invite');
    const campos   = _lerFormConvite();

    const val = _validarConvite(campos, feedback);
    if (!val.ok) return;

    const { data, error } = await _criarUsuario(campos, val.password, btn, feedback);
    await _concluirConvite({ campos, data, error, feedback, btn, modal });
  });
}

const _getInviteMode = () => document.querySelector('input[name="invite-mode"]:checked')?.value || 'password';

function _lerFormConvite() {
  return {
    mode:          _getInviteMode(),
    email:         document.getElementById('invite-email').value.trim().toLowerCase(),
    nome:          document.getElementById('invite-nome').value.trim(),
    grupo_id:      document.getElementById('invite-grupo').value || null,
    operador_nome: document.getElementById('invite-operador').value.trim() || null,
  };
}

function _validarSenhaConvite(feedback) {
  const p1 = document.getElementById('invite-pass-1').value;
  const p2 = document.getElementById('invite-pass-2').value;
  if (!p1 || p1.length < 8) {
    _showFeedback(feedback, 'A senha deve ter pelo menos 8 caracteres.', 'err'); return { ok: false };
  }
  if (p1 !== p2) {
    _showFeedback(feedback, 'As senhas não conferem.', 'err'); return { ok: false };
  }
  return { ok: true, password: p1 };
}

// Valida os campos; devolve { ok, password } (password preenchido só no modo senha direta)
function _validarConvite({ mode, email, nome, grupo_id }, feedback) {
  if (!email || !email.includes('@')) {
    _showFeedback(feedback, 'Informe um e-mail válido.', 'err'); return { ok: false };
  }
  if (!nome) {
    _showFeedback(feedback, 'Informe o nome do usuário.', 'err'); return { ok: false };
  }
  if (!grupo_id) {
    _showFeedback(feedback, 'Selecione um grupo de acesso.', 'err'); return { ok: false };
  }
  if (mode === 'password') return _validarSenhaConvite(feedback);
  return { ok: true, password: null };
}

// Desabilita o botão, invoca a Edge Function e restaura o botão
async function _criarUsuario({ mode, email, nome, grupo_id, operador_nome }, password, btn, feedback) {
  btn.textContent = mode === 'password' ? 'Criando…' : 'Enviando…';
  btn.disabled = true;
  feedback.style.display = 'none';

  const ret = await invokeInviteUser({ email, nome, grupo_id, operador_nome, ...(password ? { password } : {}) });

  btn.textContent = mode === 'password' ? 'Criar Usuário' : 'Enviar Convite';
  btn.disabled = false;
  return ret;
}

async function _erroDoContexto(error) {
  try {
    const body = await error.context.json();
    return body?.error || body?.message || error?.message || null;
  } catch {
    return error?.message || null;
  }
}

// supabase-js v2: quando a função retorna não-2xx, o body real fica na
// Response em error.context — error.message é só o texto genérico
async function _msgErroConvite(data, error) {
  if (data?.error) return data.error;
  let msg = null;
  if (error?.context && typeof error.context.json === 'function') {
    msg = await _erroDoContexto(error);
  } else {
    msg = error?.message || null;
  }
  return msg || 'Erro ao criar usuário';
}

function _msgSucessoConvite(mode, data, email) {
  if (mode === 'password') {
    return `Usuário ${email} criado. Informe a senha definida para ele acessar o sistema.`;
  }
  return data.resent
    ? `${email} já está cadastrado. Um link de redefinição de senha foi enviado.`
    : `Convite enviado para ${email}. O usuário receberá um e-mail com o link de acesso.`;
}

async function _concluirConvite({ campos, data, error, feedback, btn, modal }) {
  const { mode, email } = campos;

  if (error || data?.error) {
    _showFeedback(feedback, await _msgErroConvite(data, error), 'err');
    return;
  }

  // Blindagem: se a Edge Function em produção ainda for a versão antiga,
  // ela ignora a senha e envia convite por e-mail — avisa em vez de confirmar
  if (mode === 'password' && data?.mode !== 'password') {
    _showFeedback(feedback,
      'A função invite-user no Supabase ainda é a versão antiga e não suporta senha direta — foi enviado um convite por e-mail. Atualize a Edge Function.', 'err');
    return;
  }

  // Sucesso — mostra feedback antes de fechar
  _showFeedback(feedback, _msgSucessoConvite(mode, data, email), 'ok');
  btn.textContent = mode === 'password' ? 'Criado!' : 'Enviado!'; btn.disabled = true;

  setTimeout(async () => {
    modal.style.display = 'none';
    await loadUsers();
  }, 2500);
}

function _showFeedback(el, msg, type) {
  el.textContent = msg;
  el.style.display = 'block';
  el.style.background = type === 'err' ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)';
  el.style.color       = type === 'err' ? '#ef4444' : '#22c55e';
  el.style.border      = `1px solid ${type === 'err' ? 'rgba(239,68,68,0.3)' : 'rgba(34,197,94,0.3)'}`;
}

