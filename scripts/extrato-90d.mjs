// Extrato dos últimos N dias (padrão 90) de TODAS as contas dos itens em config/items.json.
// Saída: extratos/<data-de-hoje>/  -> um CSV por conta + extratos.html + resumo.json
// Uso: node scripts/extrato-90d.mjs [dias]
import {writeFile, mkdir} from 'node:fs/promises';
import {loadConfig, createClient, brl, esc, iso} from './lib.mjs';

const days = Number(process.argv[2] ?? 90);
const {credentials, items} = await loadConfig();
const api = await createClient(credentials);

const today = new Date();
const dateFrom = iso(new Date(today.getTime() - days * 864e5));
const outDir = new URL(`../extratos/${iso(today)}/`, import.meta.url);
await mkdir(outDir, {recursive: true});

const csvCell = s => { const v = String(s ?? ''); return /[;"\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
const mask = s => (s ? String(s).replace(/\d(?=\d{4})/g, '*') : '');

const summary = [];
const htmlParts = [];
for (const [bank, itemId] of Object.entries(items)) {
  const item = await api.get('/items/' + itemId);
  const accounts = (await api.get('/accounts?itemId=' + itemId)).results ?? [];
  const bankParts = [];
  for (const a of accounts) {
    const rows = await api.transactions(a.id, {dateFrom});
    const isCard = a.type === 'CREDIT';
    // Conta: valor negativo = débito. Cartão: compra positiva, pagamento/estorno negativo.
    const debit = r => (isCard ? r.amount > 0 : r.amount < 0);
    const totalIn = rows.filter(r => !debit(r)).reduce((s, r) => s + Math.abs(r.amount), 0);
    const totalOut = rows.filter(r => debit(r)).reduce((s, r) => s + Math.abs(r.amount), 0);
    const label = `${a.marketingName ?? a.name ?? a.subtype} ${mask(a.number)}`.trim();
    const fname = `${bank}-${a.subtype.toLowerCase()}-${a.id.slice(0, 8)}.csv`;
    const header = ['data', 'descricao', 'valor', 'moeda', 'categoria', 'tipo', 'status', 'parcelas'];
    const csv = [header.join(';'), ...rows.map(r => [
      r.date?.slice(0, 10), r.description, String(r.amount).replace('.', ','), r.currencyCode, r.category,
      isCard ? (debit(r) ? 'compra' : 'pagamento/credito') : (debit(r) ? 'debito' : 'credito'),
      r.status, r.creditCardMetadata?.totalInstallments ?? '',
    ].map(csvCell).join(';'))].join('\n');
    await writeFile(new URL('./' + fname, outDir), '﻿' + csv, 'utf8');
    summary.push({bank, account: label, type: a.type + '/' + a.subtype, rows: rows.length, totalIn, totalOut, balance: a.balance, file: fname});
    bankParts.push(`<h3>${esc(label)} <small>${esc(a.type)}/${esc(a.subtype)}</small></h3>
<p>Saldo atual informado pelo banco: <b>${esc(brl(a.balance))}</b>${isCard ? ' (fatura/limite usado)' : ''} · Lançamentos: <b>${rows.length}</b> · ${isCard ? 'Compras' : 'Saídas'}: <b>${esc(brl(totalOut))}</b> · ${isCard ? 'Pagamentos/créditos' : 'Entradas'}: <b>${esc(brl(totalIn))}</b> · CSV: <code>${esc(fname)}</code></p>
<table><thead><tr><th>Data</th><th>Descrição</th><th class="num">Valor</th><th>Categoria</th><th>Status</th><th>Parc.</th></tr></thead><tbody>
${rows.map(r => `<tr class="${debit(r) ? 'out' : 'in'}"><td>${esc(r.date?.slice(0, 10))}</td><td>${esc(r.description)}</td><td class="num">${esc(brl(r.amount))}</td><td>${esc(r.category)}</td><td>${esc(r.status)}</td><td>${esc(r.creditCardMetadata?.totalInstallments ?? '')}</td></tr>`).join('\n')}
</tbody></table>`);
  }
  htmlParts.push(`<section><h2>${esc(bank.toUpperCase())} <small>atualizado ${esc(item.lastUpdatedAt?.slice(0, 16).replace('T', ' '))} UTC</small></h2>${bankParts.join('\n')}</section>`);
  console.log(bank, 'contas', accounts.length, 'lançamentos', summary.filter(s => s.bank === bank).reduce((n, s) => n + s.rows, 0));
}

const sumTable = `<table><thead><tr><th>Banco</th><th>Conta</th><th>Tipo</th><th class="num">Lançamentos</th><th class="num">Saídas/Compras</th><th class="num">Entradas/Pagamentos</th><th class="num">Saldo atual</th></tr></thead><tbody>
${summary.map(s => `<tr><td>${esc(s.bank.toUpperCase())}</td><td>${esc(s.account)}</td><td>${esc(s.type)}</td><td class="num">${s.rows}</td><td class="num">${esc(brl(s.totalOut))}</td><td class="num">${esc(brl(s.totalIn))}</td><td class="num">${esc(brl(s.balance))}</td></tr>`).join('\n')}
</tbody></table>`;
const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>Extratos ${esc(dateFrom)} a ${esc(iso(today))}</title>
<style>body{font-family:system-ui,Segoe UI,sans-serif;margin:24px;color:#222}h1{font-size:22px}h2{margin-top:40px;border-bottom:2px solid #444;padding-bottom:4px}h3{margin-top:28px}small{font-weight:normal;color:#666;font-size:13px}
table{border-collapse:collapse;width:100%;font-size:13px}th,td{border:1px solid #ddd;padding:4px 8px;text-align:left}th{background:#f3f3f3;position:sticky;top:0}.num{text-align:right;white-space:nowrap}tr.out td.num{color:#b00020}tr.in td.num{color:#0a7d2c}
@media print{h2{page-break-before:always}}</style></head><body>
<h1>Extratos bancários · ${esc(dateFrom)} a ${esc(iso(today))}</h1>
<p>Fonte: Open Finance via Pluggy (Meu Pluggy), consulta em ${esc(today.toISOString().slice(0, 16).replace('T', ' '))} UTC. Documento pessoal. Em contas, valor negativo = débito. Em cartões, positivo = compra e negativo = pagamento/estorno.</p>
<h2>Resumo</h2>${sumTable}
${htmlParts.join('\n')}
</body></html>`;
await writeFile(new URL('./extratos.html', outDir), html, 'utf8');
await writeFile(new URL('./resumo.json', outDir), JSON.stringify({dateFrom, dateTo: iso(today), summary}, null, 2));
console.log('OK ->', decodeURIComponent(outDir.pathname));
