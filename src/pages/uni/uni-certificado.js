// Certificado de conclusão: overlay em tela cheia com o documento (nome,
// curso, trilha, código e QR de verificação) + imprimir/baixar em PDF.
import { fetchCertificadoDoc } from '../../services/uni-svc.js';
import { UV, spinnerHTML, showToast } from './uni-core.js';

export async function uniVerCertificado(certId) {
  // Remove modal anterior se existir
  document.getElementById('uni-cert-modal')?.remove();

  // Cria overlay com spinner enquanto carrega
  const overlay = document.createElement('div');
  overlay.id = 'uni-cert-modal';
  overlay.className = 'uni-cert-overlay';
  overlay.innerHTML = `<div class="uni-cert-modal">${spinnerHTML()}</div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });

  try {
    const [{ data: cert }, { data: profile }] = await fetchCertificadoDoc(certId, UV.userId);

    if (!cert) { overlay.remove(); showToast('Certificado não encontrado'); return; }

    const nome       = profile?.nome || 'Colaborador';
    const curso      = cert.uni_cursos?.titulo || 'Curso';
    const trilha     = cert.uni_cursos?.uni_trilhas?.nome || '';
    const trilhaCor  = cert.uni_cursos?.uni_trilhas?.cor || '#E02020';
    const codigo     = cert.codigo;
    const emitidoEm  = new Date(cert.emitido_em).toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
    const qrData     = encodeURIComponent(`Smart Consig - Universidade Smart\nCertificado: ${codigo}\nCurso: ${curso}\nNome: ${nome}`);
    const qrUrl      = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${qrData}&bgcolor=ffffff&color=111111&margin=8`;

    overlay.querySelector('.uni-cert-modal').innerHTML = `
      <button class="uni-cert-close" onclick="document.getElementById('uni-cert-modal').remove()">✕</button>

      <div class="uni-cert-doc" id="uni-cert-print-area">
        <div class="uni-cert-top-stripe" style="background:${trilhaCor}"></div>

        <div class="uni-cert-header">
          <div class="uni-cert-logo-wrap">
            <div class="uni-cert-logo-us">U<em>S</em></div>
            <div class="uni-cert-logo-text">Universidade <strong>Smart</strong></div>
          </div>
          <div class="uni-cert-tipo-label">Certificado de Conclusão</div>
        </div>

        <div class="uni-cert-body">
          <div class="uni-cert-certifica-texto">Certificamos que</div>
          <div class="uni-cert-nome">${nome}</div>
          <div class="uni-cert-concluiu-texto">concluiu com êxito o curso</div>
          <div class="uni-cert-curso">${curso}</div>
          ${trilha ? `<div class="uni-cert-trilha" style="color:${trilhaCor}">${trilha.toUpperCase()}</div>` : ''}
          <div class="uni-cert-data">Emitido em ${emitidoEm}</div>
        </div>

        <div class="uni-cert-footer">
          <div class="uni-cert-assinatura">
            <div class="uni-cert-assinatura-linha"></div>
            <div class="uni-cert-assinatura-nome">Smart Consig</div>
            <div class="uni-cert-assinatura-cargo">Universidade Smart</div>
          </div>
          <div class="uni-cert-qr-wrap">
            <img class="uni-cert-qr-img" src="${qrUrl}" alt="QR Code de verificação" width="140" height="140">
            <div class="uni-cert-codigo-label">Código de verificação</div>
            <div class="uni-cert-codigo">${codigo}</div>
          </div>
        </div>

        <div class="uni-cert-bottom-stripe" style="background:${trilhaCor}"></div>
      </div>

      <div class="uni-cert-actions">
        <button class="uni-cert-btn-ghost" onclick="document.getElementById('uni-cert-modal').remove()">Fechar</button>
        <button class="uni-cert-btn-download" onclick="window.print()">
          ⬇ Baixar / Imprimir PDF
        </button>
      </div>
    `;
  } catch (_e) {
    overlay.remove();
    showToast('Erro ao carregar certificado. Tente novamente.');
  }
}
