# Open Finance pessoal: seus dados bancários, de graça, nos seus próprios apps

Conecte até 5 bancos do seu CPF pelo Open Finance, sem pagar nada, e use saldos, extratos,
cartões e investimentos do jeito que quiser: planilha, app próprio, automação, agente de IA.
A ponte é o **plano pessoal gratuito do Pluggy (Meu Pluggy)**, que expõe tudo numa API
normal. Este repositório tem o passo a passo oficial, scripts prontos para extratos e uma
skill que ensina o Claude Code a usar essa API sem tropeçar nos detalhes do plano pessoal.

Sem servidor, sem dependências: só Node.js 20+ e um Chrome/Edge para gerar PDF.

## O que você passa a ter

Depois de conectar os bancos, a API devolve, para cada um deles e atualizado todo dia:

- **Saldos** de conta corrente, poupança e limite de cheque especial.
- **Extrato completo** de cada conta, com data, descrição, valor e a **categoria já classificada**
  pelo Pluggy (mercado, restaurante, transporte, assinatura, transferência, salário...).
- **Cartões de crédito**: cada compra, com data da compra, número de parcelas, estorno e
  pagamento, mais as **faturas fechadas** com valor total, vencimento e pagamentos.
- **Investimentos**: renda fixa, ações, FII e fundos, com posição atual.
- **Dados do titular** que o banco envia: nome, CPF, agência, conta, nome do produto.
- Até **5 bancos** no mesmo lugar, consultados por um único par de credenciais.

Com isso em mãos, dá para construir o que você quiser, só para você. Alguns exemplos:

- **Planilha que se preenche sozinha** com todos os gastos do mês, por categoria.
- **Orçamento e metas**: comparar o que foi gasto com o planejado e avisar quando passar.
- **Alertas**: compra acima de um valor, fatura chegando, saldo abaixo do mínimo, cobrança
  repetida que você não reconhece, assinatura que subiu de preço.
- **Visão consolidada** de todos os bancos num dashboard, incluindo quanto está investido.
- **Controle de parcelas**: quanto ainda vai cair nos próximos meses em cada cartão.
- **Extratos e relatórios** em CSV, HTML ou PDF, para você ou para o contador.
- **Agente de IA** que responde "quanto gastei com restaurante em setembro" ou "qual o
  gasto médio com mercado" lendo direto dos seus dados.
- **Importar para o app de finanças** que você já usa, sem digitar nada.

O que o plano pessoal não entrega: previdência (PGBL/VGBL), saldo após cada lançamento,
contas de outras pessoas, atualização em tempo real (é diária). Os detalhes estão na skill.

## O que já vem pronto neste repositório

Três scripts, sem dependências, que são os exemplos iniciais de tudo acima:

- `extrato-90d.mjs`: um CSV por conta (corrente, poupança, cartão) + um HTML com todos os
  lançamentos dos últimos N dias, com a categoria dada pelo Pluggy.
- `extrato-cc-pdf.mjs`: um PDF por banco, só conta corrente, período que você escolher, com
  nome, CPF, agência e conta no cabeçalho.
- `listar-contas.mjs`: mostra o que a API enxerga de cada banco (bom para conferir a configuração).
- `skills/usando-meu-pluggy`: skill para Claude Code (ou qualquer agente que leia SKILL.md) com
  tudo que a API do plano pessoal faz de diferente do que a documentação sugere. Com ela, você
  pede em português o que quiser dos seus dados e o agente escreve o código certo.

> Isso é para uso pessoal, com contas do seu próprio CPF. Os termos do Pluggy e o limite do
> plano gratuito não cobrem contas de terceiros nem uso comercial.

## 1. Configurar o Pluggy (passos oficiais)

Os passos abaixo são os que a Pluggy lista em [pluggy.ai/meu-pluggy](https://www.pluggy.ai/meu-pluggy),
na mesma ordem.

1. **Crie sua conta no Meu Pluggy.** Em [meu.pluggy.ai](https://meu.pluggy.ai), cadastre-se com e-mail e senha.
2. **Conecte suas contas bancárias.** Dentro do Meu Pluggy, conecte cada banco e **conclua a
   autorização no site ou app do banco** (Open Finance). A conta só conta como conectada quando
   aparece listada no Meu Pluggy. Se não aparecer, a autorização não terminou: refaça e espere o
   redirecionamento de volta.
3. **Crie sua conta no Dashboard.** Em [dashboard.pluggy.ai](https://dashboard.pluggy.ai), de
   preferência com o mesmo e-mail. Vai aparecer um aviso de trial de 15 dias; ele não afeta o uso pessoal.
4. **Crie uma aplicação.** Uma só serve para todas as contas.
5. **Copie o Client ID e o Client Secret.** Estão na aba "Aplicação". Valem para todas as contas da aplicação.
6. **Ative o conector "MeuPluggy" dentro da aplicação.** Crie uma conexão na aplicação e
   escolha o conector **MeuPluggy** (não o banco, não Sandbox, não Pluggy Bank). Se ele não
   aparecer, habilite nas configurações de conectores. Repita para cada banco novo.

Limites do plano gratuito, segundo a página: até 5 conexões ativas, todas do mesmo titular;
saldos, extratos, cartões e investimentos; atualização automática a cada 24 h; suporte pela
comunidade no Discord. Mais conexões, contas de outras pessoas (inclusive família) ou uso
comercial exigem plano pago.

## 2. Pegar o Item ID de cada banco

Cada banco conectado vira um **item** no Pluggy. A API do plano pessoal **não lista itens**
(`GET /items` responde `LIST_ITEMS_FEATURE_NOT_ENABLED`), então você precisa copiar o ID:

- No Dashboard, abra a aplicação e a lista de conexões/itens: cada linha mostra o Item ID (UUID).
- Se tiver só o ID de uma conta, `GET /accounts/{accountId}` devolve o `itemId`.

Guarde um nome curto para cada banco e o ID correspondente em `config/items.json` (passo 3).

## 3. Instalar e configurar

```bash
git clone <url-deste-repositório>
cd open-finance-pessoal
cp config/credentials.example.json config/credentials.json   # preencha Client ID e Secret
cp config/items.example.json config/items.json               # preencha os Item IDs
node scripts/listar-contas.mjs                               # confere se tudo responde
```

Os dois arquivos em `config/` já estão no `.gitignore`. A pasta `extratos/` também: ela recebe
dados bancários reais.

## 4. Gerar extratos

```bash
# Últimos 90 dias, todas as contas: CSVs + extratos.html em extratos/<hoje>/
node scripts/extrato-90d.mjs

# Últimos 30 dias
node scripts/extrato-90d.mjs 30

# PDF por banco, só conta corrente, julho a setembro, para os bancos "itau" e "nubank"
node scripts/extrato-cc-pdf.mjs 2026-07-01 2026-09-30 itau,nubank
```

Abra `extratos.html` no navegador; o CSV usa `;` e abre direto no Excel. O PDF é impresso
pelo Chrome ou Edge em modo headless; sem eles, abra o `.html` gerado e imprima em PDF.

O PDF traz os dados do titular que o próprio banco devolve (nome, CPF, agência, conta,
limite de cheque especial), mas **é um documento gerado por você, não pelo banco**. Ele diz
isso no rodapé do cabeçalho. Para fins que exijam extrato oficial, baixe no app do banco.

## 5. Usar com Claude Code

Copie a pasta `skills/usando-meu-pluggy` para `~/.claude/skills/` (ou para `.claude/skills/`
do seu projeto). Depois, peça o que quiser ("gera um extrato do cartão de agosto", "soma
quanto gastei em restaurante no trimestre") e o agente vai usar os endpoints e a paginação
corretos sem tropeçar nos erros descritos na skill.

## O que a API do plano pessoal faz de diferente

Resumo do que está na skill, verificado ao vivo em outubro de 2026 com Bradesco, Santander,
C6 e XP:

- Transações só em `GET /v2/transactions?accountId=&dateFrom=&dateTo=`; o v1 responde 410.
  `page`, `pageSize`, `limit`, `from` e `to` são rejeitados com 400.
- A resposta traz `{results, next}` e `next` já é a query string da próxima página; é só
  colar na URL e repetir `dateFrom`/`dateTo`.
- Cartão: compra é positiva, pagamento é negativo. Não existe número da parcela, só
  `totalInstallments` e `purchaseDate`; calcule pelos meses até a fatura.
- `GET /bills` só lista faturas fechadas.
- Previdência (PGBL/VGBL) **não vem** pelo Open Finance. Fundos, ações, FII e renda fixa vêm em `/investments`.
- Todos os itens aparecem com o conector "MeuPluggy" (id 200). Para abrir o widget Pluggy
  Connect por código, use a versão 2.10.0 e `connectorIds:[200]`.

## Segurança

- O Client Secret dá acesso a todos os seus dados bancários. Nunca o coloque em commit, chat ou print.
  Se vazar, gere outro no Dashboard.
- Os extratos gerados contêm nome, CPF e número de conta. Trate como documento pessoal.
- Ao pedir ajuda a uma IA, cole apenas trechos sem dados sensíveis, ou use os scripts (que
  rodam na sua máquina) em vez de colar o extrato.

## Licença

MIT. Pluggy e Meu Pluggy são marcas da Pluggy; este repositório não tem relação com a empresa.
