---
name: usando-meu-pluggy
description: Use quando for escrever código ou scripts contra a API do Pluggy (api.pluggy.ai) com uma conta pessoal gratuita do Meu Pluggy, em qualquer tarefa que envolva extratos, transações, cartões, faturas, investimentos ou o widget Pluggy Connect, ou quando a API responder 400, 410 ou "FEATURE_NOT_ENABLED".
---

# Usando a API do Pluggy no plano pessoal (Meu Pluggy)

## Visão geral

O plano pessoal do Pluggy funciona com a API normal, mas várias coisas da documentação geral
não valem nele, e vários palpites "óbvios" dão 400. Esta skill lista o que foi verificado ao
vivo em outubro de 2026 contra Bradesco, Santander, C6 e XP. Siga a tabela, não a intuição.

## Referência rápida

| Preciso de | Use | Não use (falha) |
|---|---|---|
| Autenticar | `POST /auth {clientId, clientSecret}` → `apiKey`, header `X-API-KEY` | |
| Descobrir os bancos conectados | Item IDs do Dashboard, salvos em config. `GET /items/{id}` funciona | `GET /items` e `/v2/items` → `LIST_ITEMS_FEATURE_NOT_ENABLED` |
| Recuperar item a partir de uma conta | `GET /accounts/{accountId}` devolve `itemId` | |
| Contas de um banco | `GET /accounts?itemId=` (tipos `BANK/CHECKING_ACCOUNT`, `BANK/SAVINGS_ACCOUNT`, `CREDIT/CREDIT_CARD`) | |
| Transações | `GET /v2/transactions?accountId=&dateFrom=AAAA-MM-DD&dateTo=AAAA-MM-DD` | v1 `GET /transactions` → 410; `from`, `to`, `page`, `pageSize`, `limit` → 400 "property X should not exist" |
| Paginação | Resposta `{results, next}`. `next` é uma **query string pronta** (`?accountId=...&after=...`): faça `GET /v2/transactions${next}&dateFrom=...`. Repita `dateFrom`/`dateTo`. Página tem tamanho fixo (200 com dateFrom, 500 sem) | `cursor=`, `after=` montado na mão |
| Faturas de cartão | `GET /bills?accountId=` lista **só faturas fechadas** (`billClosingDate`, `dueDate`, `totalAmount`, `payments[]`); compras do ciclo aberto não têm `billId`. `/accounts`, `/bills` e `/investments` vêm em página única (`results`, sem `next`) | |
| Número da parcela | Não existe. `creditCardMetadata` tem `totalInstallments`, `purchaseDate`, `billId`, mas **não** `installmentNumber`, e a descrição **não** traz "3/10". Derive: `1 + meses entre purchaseDate e billClosingDate da fatura` (ciclo aberto: use `creditCardMetadata.billPostDate` ou o mês atual e marque como estimada); limite ao `totalInstallments` | regex na descrição |
| Investimentos | `GET /investments?itemId=` (renda fixa, ações, FII, fundos) | |
| Previdência (PGBL/VGBL) | **Não vem pelo Open Finance.** Entrada manual ou extrato da corretora | `/investments` procurando RETIREMENT |
| Adicionar banco por código | `POST /connect_token` (header `X-API-KEY`, body `{clientUserId}`) → `accessToken` válido ~30 min; no HTML `new PluggyConnect({connectToken, includeSandbox:false, connectorIds:[200], onSuccess}).init()` com Pluggy Connect **v2.10.0** | Conector direto do banco → "Contas de teste só podem conectar conectores sandbox"; `v2.9.1` não existe no CDN |

## Sinais e convenções dos dados

- Conta corrente: `amount` negativo = débito. Cartão: positivo = compra, negativo = pagamento/estorno.
- `category` vem preenchida em ~100% das linhas; `status` pode ser `PENDING`.
- `paymentData` existe em todas as linhas de conta; `providerId` não existe no conector MeuPluggy (use `providerCode`).
- Conta tem `owner`, `taxNumber` (CPF), `bankData.transferNumber` = `COMPE/agência/conta` (ex.: `033/0001/12345-6`) e limite de cheque especial. Não há saldo por lançamento, só `balance` atual.
- Dados chegam com atraso de alguns dias e atualizam a cada 24 h. Janela "últimos 7 dias" costuma vir vazia.
- Um item fica `LOGIN_ERROR`/`OUTDATED` quando o consentimento expira; o usuário reconecta no Meu Pluggy, não há como reautorizar por código no plano pessoal.

## Limites do plano pessoal

Até 5 conexões, todas do mesmo CPF (conta de outra pessoa, mesmo da família, exige plano pago).
A conta no Dashboard mostra aviso de trial de 15 dias que não afeta o uso pessoal. O conector
MeuPluggy é um proxy: todos os itens aparecem com `connector.id === 200`, e o banco real só
se reconhece pelas contas (`bankData.transferNumber` começa com o código COMPE).

## Erros comuns

| Sintoma | Causa | Correção |
|---|---|---|
| 400 "property pageSize should not exist" | parâmetro inventado | só `accountId`, `dateFrom`, `dateTo` e o `next` devolvido |
| 410 em `/transactions` | endpoint v1 | `/v2/transactions` |
| Resposta vazia em `/accounts` | item não vinculado à aplicação | ativar conector MeuPluggy na aplicação do Dashboard e reconectar |
| Lista de transações para em 200 | não seguiu `next` | loop `while (next)` colando `next` na URL |
| Widget "não faz nada" | versão inexistente no CDN | `https://cdn.pluggy.ai/pluggy-connect/v2.10.0/pluggy-connect.js` |

## Implementação

Cliente mínimo com paginação correta em `scripts/lib.mjs` deste repositório
(`createClient(credentials).transactions(accountId, {dateFrom, dateTo})`). Exemplos completos:
`scripts/extrato-90d.mjs` (CSV + HTML de todas as contas) e `scripts/extrato-cc-pdf.mjs` (PDF por banco).

## Segurança

Client Secret e Item IDs ficam em arquivos ignorados pelo git. Nunca cole o Secret em chat ou
commit; se vazar, gere outro no Dashboard. Extratos gerados contêm nome, CPF e conta: trate
como documento pessoal.
