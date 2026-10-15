// Extrato em PDF por banco, só contas correntes, período fixo, com dados do titular no cabeçalho.
// Uso: node scripts/extrato-cc-pdf.mjs 2026-07-01 2026-09-30 [banco1,banco2]   (nomes = chaves de config/items.json)
// Requer Microsoft Edge ou Google Chrome instalado (impressão headless). Saída: extratos/cc-<de>_<ate>/<banco>-conta-corrente.pdf
import {writeFile, mkdir, access} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {loadConfig, createClient, brl, br, esc} from './lib.mjs';

const [dateFrom, dateTo, banksArg] = process.argv.slice(2);
if (!dateFrom || !dateTo) { console.error('Uso: node scripts/extrato-cc-pdf.mjs AAAA-MM-DD AAAA-MM-DD [banco1,banco2]'); process.exit(1); }
const {credentials, items} = await loadConfig();
const banks = banksArg ? banksArg.split(',') : Object.keys(items);
const api = await createClient(credentials);

const outDir = new URL(`../extratos/cc-${dateFrom}_${dateTo}/`, import.meta.url);
await mkdir(outDir, {recursive: true});

// Nome completo da instituição pelo código COMPE que vem em bankData.transferNumber ("033/0001/12345-6").
const COMPE = {'001': 'Banco do Brasil S.A.', '033': 'Banco Santander (Brasil) S.A.', '077': 'Banco Inter S.A.', '104': 'Caixa Econômica Federal',
  '208': 'Banco BTG Pactual S.A.', '212': 'Banco Original S.A.', '237': 'Banco Bradesco S.A.', '260': 'Nu Pagamentos S.A.', '290': 'PagSeguro Internet S.A.',
  '336': 'Banco C6 S.A.', '341': 'Itaú Unibanco S.A.', '380': 'PicPay', '422': 'Banco Safra S.A.', '655': 'Banco Votorantim S.A.', '748': 'Sicredi', '756': 'Sicoob'};
const parseTransfer = t => { const m = String(t ?? '').match(/^(\d{3})\/(\d+)\/(.+)$/); return m ? {compe: m[1], agencia: m[2], conta: m[3]} : {compe: '', agencia: '', conta: String(t ?? '')}; };

async function findBrowser() {
  const candidates = [
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
  ];
  for (const p of candidates) { try { await access(p); return p; } catch {} }
  throw new Error('Nenhum Chrome/Edge encontrado para gerar o PDF. Instale um deles ou abra o .html e imprima em PDF.');
}
const browser = await findBrowser();

for (const bank of banks) {
  const itemId = items[bank];
  if (!itemId) { console.error('banco não está em config/items.json:', bank); continue; }
  const item = await api.get('/items/' + itemId);
  const accounts = ((await api.get('/accounts?itemId=' + itemId)).results ?? []).filter(a => a.type === 'BANK' && a.subtype === 'CHECKING_ACCOUNT');
  const sections = [];
  let total = 0;
  let bankName = bank.toUpperCase();
  for (const a of accounts) {
    const rows = await api.transactions(a.id, {dateFrom, dateTo});
    total += rows.length;
    const inSum = rows.filter(r => r.amount > 0).reduce((s, r) => s + r.amount, 0);
    const outSum = rows.filter(r => r.amount < 0).reduce((s, r) => s + Math.abs(r.amount), 0);
    const bd = parseTransfer(a.bankData?.transferNumber);
    bankName = COMPE[bd.compe] ?? bankName;
    sections.push(`<h2>Dados da conta</h2>
<table class="kv"><tr><td>Titular</td><td>${esc(a.owner)}</td></tr>
<tr><td>CPF</td><td>${esc(a.taxNumber)}</td></tr>
<tr><td>Instituição</td><td>${esc(bankName)}${bd.compe ? ` · código ${esc(bd.compe)}` : ''}</td></tr>
<tr><td>Agência</td><td>${esc(bd.agencia)}</td></tr>
<tr><td>Conta corrente</td><td>${esc(bd.conta || a.number)}</td></tr>
<tr><td>Produto</td><td>${esc(a.name)}</td></tr>
<tr><td>Moeda</td><td>${esc(a.currencyCode)}</td></tr>
${a.bankData?.overdraftContractedLimit != null ? `<tr><td>Limite de cheque especial</td><td>${esc(brl(a.bankData.overdraftContractedLimit))} (utilizado ${esc(brl(a.bankData.overdraftUsedLimit))})</td></tr>` : ''}</table>
<h2>Movimentação</h2>
<table class="kv"><tr><td>Período</td><td>${br(dateFrom)} a ${br(dateTo)}</td></tr>
<tr><td>Lançamentos</td><td>${rows.length}</td></tr>
<tr><td>Entradas</td><td class="in">${esc(brl(inSum))}</td></tr>
<tr><td>Saídas</td><td class="out">${esc(brl(outSum))}</td></tr>
<tr><td>Saldo atual da conta (${br(a.updatedAt ?? item.lastUpdatedAt)})</td><td>${esc(brl(a.balance))}</td></tr></table>
<table><thead><tr><th>Data</th><th>Descrição</th><th>Categoria</th><th class="num">Valor</th></tr></thead><tbody>
${rows.map(r => `<tr><td>${br(r.date)}</td><td>${esc(r.description)}</td><td>${esc(r.category)}</td><td class="num ${r.amount < 0 ? 'out' : 'in'}">${esc(brl(r.amount))}</td></tr>`).join('\n')}
</tbody></table>`);
  }
  const title = `Extrato de conta corrente · ${bankName} · ${br(dateFrom)} a ${br(dateTo)}`;
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><title>${esc(title)}</title>
<style>@page{size:A4;margin:14mm}body{font-family:Segoe UI,system-ui,sans-serif;color:#222;font-size:11px}h1{font-size:18px;margin:0 0 4px}h2{font-size:14px;margin:22px 0 8px;border-bottom:1.5px solid #333;padding-bottom:3px}
.meta{color:#666;margin-bottom:12px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:3px 6px;text-align:left;vertical-align:top}th{background:#eee}thead{display:table-header-group}tr{page-break-inside:avoid}
.num{text-align:right;white-space:nowrap}.in{color:#0a7d2c}.out{color:#b00020}table.kv{width:auto;margin-bottom:10px}table.kv td:first-child{font-weight:600;background:#f6f6f6}</style></head><body>
<h1>${esc(title)}</h1>
<div class="meta">Emitido pelo titular em ${br(new Date().toISOString())} a partir dos dados compartilhados pela instituição via Open Finance (Pluggy), última atualização em ${br(item.lastUpdatedAt)}. Valores negativos são débitos. Este documento não é emitido pela instituição financeira.</div>
${sections.join('\n')}
</body></html>`;
  const htmlPath = new URL(`./${bank}-conta-corrente.html`, outDir);
  const pdfPath = fileURLToPath(new URL(`./${bank}-conta-corrente.pdf`, outDir));
  await writeFile(htmlPath, html, 'utf8');
  execFileSync(browser, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${pdfPath}`, htmlPath.href], {stdio: 'ignore', timeout: 60000});
  console.log(bank, 'contas', accounts.length, 'lançamentos', total, '->', pdfPath);
}
