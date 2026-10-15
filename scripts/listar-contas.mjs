// Mostra o que a API enxerga em cada item de config/items.json: status, contas (com ID) e investimentos.
// Útil para validar a configuração antes de gerar extratos. Uso: node scripts/listar-contas.mjs
import {loadConfig, createClient, brl} from './lib.mjs';

const {credentials, items} = await loadConfig();
const api = await createClient(credentials);
const mask = s => (s ? String(s).replace(/\d(?=\d{4})/g, '*') : '');

for (const [bank, itemId] of Object.entries(items)) {
  let item;
  try { item = await api.get('/items/' + itemId); } catch (e) { console.log(`\n${bank}: ERRO ${e.message}`); continue; }
  console.log(`\n${bank}: item ${item.status}/${item.executionStatus} · conector ${item.connector?.name} (${item.connector?.id}) · atualizado ${item.lastUpdatedAt}`);
  const accounts = (await api.get('/accounts?itemId=' + itemId)).results ?? [];
  for (const a of accounts) console.log(`  ${a.type}/${a.subtype}  ${a.name ?? ''} ${mask(a.number)}  saldo ${brl(a.balance)}  accountId=${a.id}`);
  const inv = (await api.get('/investments?itemId=' + itemId)).results ?? [];
  if (inv.length) {
    const byType = {};
    for (const i of inv) byType[i.type + '/' + (i.subtype ?? '')] = (byType[i.type + '/' + (i.subtype ?? '')] ?? 0) + 1;
    console.log('  investimentos:', Object.entries(byType).map(([k, n]) => `${k} x${n}`).join(', '));
  }
}
