// Funções comuns: autenticação, GET com erro legível, paginação do /v2/transactions.
// Credenciais e IDs vêm de config/credentials.json e config/items.json (ambos ignorados pelo git).
import {readFile} from 'node:fs/promises';

export const BASE = 'https://api.pluggy.ai';
const configDir = new URL('../config/', import.meta.url);

export async function loadConfig() {
  let credentials, items;
  try {
    credentials = JSON.parse(await readFile(new URL('./credentials.json', configDir), 'utf8'));
  } catch {
    throw new Error('Falta config/credentials.json. Copie config/credentials.example.json e preencha Client ID e Secret do Dashboard.');
  }
  try {
    items = JSON.parse(await readFile(new URL('./items.json', configDir), 'utf8')).items;
  } catch {
    throw new Error('Falta config/items.json. Copie config/items.example.json e preencha o Item ID de cada banco (veja o README).');
  }
  if (!credentials.clientId || !credentials.clientSecret) throw new Error('credentials.json sem clientId/clientSecret');
  if (!items || !Object.keys(items).length) throw new Error('items.json sem nenhum item');
  return {credentials, items};
}

export async function createClient(credentials) {
  const r = await fetch(BASE + '/auth', {
    method: 'POST',
    headers: {'content-type': 'application/json'},
    body: JSON.stringify({clientId: credentials.clientId, clientSecret: credentials.clientSecret}),
  });
  const auth = await r.json().catch(() => ({}));
  if (!auth.apiKey) throw new Error(`Autenticação falhou (${r.status}). Confira Client ID e Secret.`);
  const headers = {'X-API-KEY': auth.apiKey};

  async function get(path) {
    const res = await fetch(BASE + path, {headers});
    const text = await res.text();
    let json = null;
    try { json = JSON.parse(text); } catch {}
    if (res.status !== 200) throw new Error(`${path} -> ${res.status} ${text.slice(0, 200)}`);
    return json;
  }

  // /v2/transactions pagina por cursor: `next` já vem como query string pronta
  // ("?accountId=...&after=..."); dateFrom/dateTo precisam ser repetidos. Page size é fixo.
  async function transactions(accountId, {dateFrom, dateTo} = {}) {
    const range = (dateFrom ? `&dateFrom=${dateFrom}` : '') + (dateTo ? `&dateTo=${dateTo}` : '');
    const rows = [];
    let next = null, pages = 0;
    do {
      const url = next ? `/v2/transactions${next}${range}` : `/v2/transactions?accountId=${accountId}${range}`;
      const page = await get(url);
      rows.push(...(page.results ?? []));
      next = page.next ?? null;
    } while (next && ++pages < 100);
    return rows
      .filter(t => (!dateFrom || t.date.slice(0, 10) >= dateFrom) && (!dateTo || t.date.slice(0, 10) <= dateTo))
      .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  return {get, transactions};
}

export const brl = n => (n ?? 0).toLocaleString('pt-BR', {style: 'currency', currency: 'BRL'});
export const br = d => (d ? d.slice(0, 10).split('-').reverse().join('/') : '');
export const esc = s => String(s ?? '').replace(/[&<>"]/g, ch => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[ch]));
export const iso = d => d.toISOString().slice(0, 10);
