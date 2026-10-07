# Roteiro de teste — redesenho (Fases 1B a 4)

Tudo isto está **gravado no computador, mas ainda não publicado**. A produção continua com a versão que já tem a Entrega 1A (login, menu, topo e avisos novos).

> ⚠️ Testar em `localhost` grava **na produção**. Use clientes reais do dia. Nas importações, **pare na tela de conferência** até ter certeza.

## 0. Antes de começar (5 min)

1. Supabase → **SQL Editor** → cole e rode o arquivo `supabase/migrations/014_boletos_respaldo.sql` (respaldo da Quitação de Boleto).
2. Ainda no SQL Editor, cole e rode o arquivo `supabase/migrations/015_liberacao_residuo.sql` (resíduo dentro da Liberação).
3. Rode esta consulta, que **só lê**, para conferir:
   ```sql
   select residuo_status, count(*) from liberacao_margem_master group by 1 order by 1;
   ```
   Devem aparecer `pendente` e `solicitado` (os resíduos que estavam abertos) e `pago` (os antigos já pagos).
4. Abra o sistema em `http://localhost:5173` (atalho "TESTAR Smart RYC") e entre com o seu usuário.

## 1. Telas antigas com a paleta nova (Entrega 1B)

- [ ] Passe por Visão Geral, Ranking, Propostas, Esteira, BMs e Universidade nos temas **Claro** e **Escuro** (botão no topo).
- [ ] Algum texto ficou ilegível ou alguma cor "fora do lugar"? Anote a tela e o tema.

## 2. Quitação de Boleto (Fase 2)

- [ ] Cartões de resumo, filtros de status com contagem, período (menu), busca e filtro de empresa.
- [ ] Clicar numa linha abre o detalhe: etapas, valores, **Respaldo**, **Documentos** (Ver e Baixar), observação.
- [ ] Coluna **Ação**: "Marcar como solicitado/enviado" (Smart) e "Marcar como quitado" (pede confirmação).
- [ ] **Lote:** marque 2 clientes no mesmo status e veja o botão na barra de baixo.
- [ ] **Exportar → Lote ZIP:** confira os números na conferência, baixe e abra o ZIP. Deve ter uma pasta por cliente com `boletos/` e `faturas/`, e o `resumo.xlsx`.
- [ ] **Importar → Respaldo:** use o próximo "Relatório de Faturas Smart". Confira a conferência (prontos, sem proposta aberta, não encontrados, repetidos) e grave. Abra um cliente e veja o bloco Respaldo.
- [ ] **Importar → Lote ZIP** (boletos e faturas): teste com um **lote real**. Esse fluxo não foi mudado, mas nunca foi testado com lote real depois da reorganização do código.
- [ ] Com um usuário **parceiro**, se houver: só os clientes dele, "Aguardando Smart" nas etapas da Smart, e o Exportar Lote só com os documentos dele.

## 3. Liberação de margem (Fase 3)

- [ ] Na linha ficam cliente, convênio, empresa, quitado, **acerto (editável)**, status e ação. Os valores ficam no detalhe.
- [ ] **Resíduo:** em um cliente Pendente, clique em "Resíduo". O modal exige **valor** e **enquadrada**. Confirme e veja o status "Resíduo pendente".
- [ ] Avance: **solicitado** (parceiro), depois **enviado** (só a Smart), depois **pago** (valor opcional). A observação deve ganhar "RESÍDUO PAGO em …".
- [ ] **Alerta:** clientes pagos há mais de 7 dias úteis sem OK ficam vermelhos e aparecem no filtro **Em alerta**. ⚠️ Os resíduos antigos já pagos e ainda sem OK vão aparecer em alerta logo de cara. Decidir se está certo.
- [ ] **Marcar como OK** (linha e lote). "Remover OK" fica no detalhe e é só da Smart.
- [ ] **Importar → Pendências:** use a planilha "LIBERAÇÃO MARGEM GERAL … TRATADA". Confira a conferência (CPF sem zero é corrigido, quem já está OK fica de fora) e grave. A observação ganha "Credcesta: … · Mfacil: …".
- [ ] **Exportar → Excel:** traz tudo, inclusive os valores e as colunas do resíduo.
- [ ] Importar planilha de clientes, Importar acerto e Adicionar/Editar cliente continuam funcionando.

## 4. Tela Resíduos (Fase 4)

- [ ] Ela sumiu do menu (Financeiro).
- [ ] Admin → Grupos: a permissão "Resíduo (na Liberação) → Agir como Smart (marcar Enviado)" existe.

## Se algo der errado

- **Problema visual da 1B:** dá para tirar só a paleta (uma linha no `main.js`).
- **SQL:** cada migration tem o bloco "ROLLBACK" no fim.
- Nada disso vai para o ar sem o seu ok. Aprovado, eu publico.
