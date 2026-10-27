// Uso sem internet, por baixo do cliente do Supabase:
// - leitura: tenta a rede (com prazo) e guarda a resposta; sem rede, devolve a última cópia guardada.
// - escrita: sem rede, entra numa fila no aparelho e responde como se tivesse salvo; sobe quando a conexão voltar.
// - leituras já mostram o que está na fila (inserções, alterações e exclusões), para a tela não "desfazer" o que foi marcado.

const BASE = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/`;
const CACHE = "dados-v1";
const FILA = "fila-offline";
const RECUSADOS = "fila-recusados";
const PRAZO_LEITURA = 6000;

type Linha = Record<string, unknown>;
export type Item = { id: string; url: string; method: string; headers: Record<string, string>; body: string | null };

export const lerFila = (): Item[] => {
  try { return JSON.parse(localStorage.getItem(FILA) || "[]"); } catch { return []; }
};
const gravarFila = (f: Item[]) => {
  try { localStorage.setItem(FILA, JSON.stringify(f)); } catch {}
  window.dispatchEvent(new Event("fila"));
};
export const recusados = () => Number(localStorage.getItem(RECUSADOS) || 0);
export const limparRecusados = () => { localStorage.removeItem(RECUSADOS); window.dispatchEvent(new Event("fila")); };

const tabela = (url: string) => new URL(url).pathname.split("/").pop() || "";
const RESERVADOS = new Set(["select", "order", "limit", "offset", "on_conflict", "columns", "__obj"]);

// A linha atende aos filtros da URL? null = filtro que não sei avaliar (ou coluna ausente).
function casa(linha: Linha, url: string): boolean | null {
  for (const [col, filtro] of new URL(url).searchParams) {
    if (RESERVADOS.has(col)) continue;
    if (col.includes(".") || ["or", "and", "not"].includes(col)) return null;
    const p = filtro.indexOf(".");
    const op = filtro.slice(0, p), val = filtro.slice(p + 1);
    const v = linha[col];
    if (op === "is") { if ((val === "null") !== (v == null)) return false; continue; }
    if (v === undefined) return null;
    const a = v == null ? "" : String(v);
    const cmp = (b: string) => {
      const na = Number(a), nb = Number(b);
      return a !== "" && b !== "" && !isNaN(na) && !isNaN(nb) ? na - nb : a < b ? -1 : a > b ? 1 : 0;
    };
    const ok =
      op === "eq" ? cmp(val) === 0 :
      op === "neq" ? cmp(val) !== 0 :
      op === "gt" ? cmp(val) > 0 :
      op === "gte" ? cmp(val) >= 0 :
      op === "lt" ? cmp(val) < 0 :
      op === "lte" ? cmp(val) <= 0 :
      op === "in" ? val.replace(/^\(|\)$/g, "").split(",").map((s) => s.replace(/^"|"$/g, "")).some((s) => cmp(s) === 0) :
      null;
    if (ok === null) return null;
    if (!ok) return false;
  }
  return true;
}

const linhasDoCorpo = (body: string | null): Linha[] => {
  if (!body) return [];
  try { const d = JSON.parse(body); return Array.isArray(d) ? d : [d]; } catch { return []; }
};

// Aplica a fila sobre a lista que veio da rede ou do cache
export function comPendentes(url: string, linhas: Linha[], fila = lerFila()): Linha[] {
  const t = tabela(url);
  let out = linhas.map((l) => ({ ...l }));
  for (const it of fila) {
    if (tabela(it.url) !== t) continue;
    if (it.method === "POST") {
      const conflito = (new URL(it.url).searchParams.get("on_conflict") || "").split(",").filter(Boolean);
      for (const nova of linhasDoCorpo(it.body)) {
        const chaves = conflito.filter((c) => c in nova);
        const i = chaves.length ? out.findIndex((l) => chaves.every((c) => String(l[c]) === String(nova[c]))) : -1;
        if (i >= 0) out[i] = { ...out[i], ...nova };
        else if (casa(nova, url) === true) out.push({ ...nova });
      }
    } else if (it.method === "PATCH") {
      const mudanca = linhasDoCorpo(it.body)[0] || {};
      out = out.map((l) => (casa(l, it.url) === true ? { ...l, ...mudanca } : l));
    } else if (it.method === "DELETE") {
      out = out.filter((l) => casa(l, it.url) !== true);
    }
  }
  return out;
}

const guardar = async (chave: string, r: Response) => {
  try { await (await caches.open(CACHE)).put(chave, r); } catch {}
};

async function ler(url: string, init: RequestInit, objeto: boolean): Promise<Response> {
  const chave = `${url}${url.includes("?") ? "&" : "?"}__obj=${objeto ? 1 : 0}`;
  let res: Response | null = null;
  if (navigator.onLine) {
    const rede = fetch(url, init).then(async (r) => {
      if (r.ok) await guardar(chave, r.clone());
      return r;
    });
    rede.catch(() => {});
    const prazo = new Promise<null>((ok) => setTimeout(() => ok(null), PRAZO_LEITURA));
    res = await Promise.race([rede, prazo]).catch(() => null);
  }
  if (!res || res.status === 401 || res.status >= 500) {
    const salvo = await caches.open(CACHE).then((c) => c.match(chave)).catch(() => undefined);
    if (salvo) res = salvo;
    else if (!res) throw new TypeError("Sem conexão e sem cópia guardada");
  }
  if (objeto || !res.ok || !lerFila().length) return res;
  const linhas = (await res.json()) as Linha[];
  const h = new Headers({ "content-type": "application/json" });
  if (res.headers.get("content-range")) h.set("content-range", res.headers.get("content-range")!);
  return new Response(JSON.stringify(comPendentes(url, linhas)), { status: res.status, headers: h });
}

function enfileirar(url: string, method: string, headers: Headers, body: string | null): Response {
  const fila = lerFila();
  const prefer = (headers.get("prefer") || "").split(",").map((s) => s.trim()).filter(Boolean);
  const objeto = (headers.get("accept") || "").includes("vnd.pgrst.object");
  let linhas: Linha[] = [];

  if (method === "DELETE") {
    // Apagar algo que ainda está na fila: só tira da fila
    const u = new URL(url);
    const alvo = u.searchParams.get("id")?.match(/^eq\.(.+)$/)?.[1];
    const it = alvo && [...u.searchParams.keys()].length === 1 && fila.find((i) => i.method === "POST" && tabela(i.url) === tabela(url) && linhasDoCorpo(i.body).some((l) => l.id === alvo));
    if (it) {
      const resto = linhasDoCorpo(it.body).filter((l) => l.id !== alvo);
      gravarFila(resto.length ? fila.map((i) => (i === it ? { ...i, body: JSON.stringify(resto) } : i)) : fila.filter((i) => i !== it));
      return new Response(null, { status: 204 });
    }
  }

  if (method === "POST") {
    linhas = linhasDoCorpo(body);
    if (!prefer.some((p) => p.startsWith("resolution="))) {
      // Inserção: o id nasce aqui, para outras escritas poderem apontar para ela,
      // e o reenvio ignora duplicata caso o primeiro envio tenha chegado.
      for (const l of linhas) if (l.id == null) l.id = crypto.randomUUID();
      prefer.push("resolution=ignore-duplicates");
      const u = new URL(url);
      const cols = u.searchParams.get("columns");
      if (cols && !cols.split(",").includes('"id"')) { u.searchParams.set("columns", `${cols},"id"`); url = u.toString(); }
    }
    body = JSON.stringify(linhas);
  }

  // No reenvio ninguém lê a resposta: sem return=representation nem accept de objeto
  // (uma duplicata ignorada devolveria 0 linhas e o pedido de objeto daria erro)
  const h: Record<string, string> = { "content-type": "application/json" };
  const preferEnvio = prefer.filter((p) => !p.startsWith("return="));
  if (preferEnvio.length) h.prefer = preferEnvio.join(",");
  if (headers.get("content-profile")) h["content-profile"] = headers.get("content-profile")!;
  gravarFila([...fila, { id: crypto.randomUUID(), url, method, headers: h, body }]);

  if (prefer.includes("return=representation")) {
    return new Response(JSON.stringify(objeto ? linhas[0] ?? null : linhas), { status: 201, headers: { "content-type": "application/json" } });
  }
  return new Response(null, { status: method === "POST" ? 201 : 204 });
}

// fetch usado pelo cliente do Supabase no navegador
export async function offlineFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : null;
  if (!url || typeof window === "undefined" || !url.startsWith(BASE)) return fetch(input, init);
  const method = (init.method || "GET").toUpperCase();
  const headers = new Headers(init.headers);
  if (method === "GET") return ler(url, init, (headers.get("accept") || "").includes("vnd.pgrst.object"));
  if (method === "HEAD") return fetch(url, init);
  if (navigator.onLine) {
    try {
      const r = await fetch(url, init);
      if (r.status !== 401) return r; // 401: login venceu sem rede para renovar; sobe depois com login novo
    } catch {} // caiu no meio: vai para a fila
  }
  return enfileirar(url, method, headers, typeof init.body === "string" ? init.body : null);
}

// Sobe a fila em ordem. Para no primeiro erro de rede ou de login e tenta de novo depois.
let enviando = false;
export async function enviarFila(token: string, apikey: string) {
  if (enviando || !navigator.onLine) return;
  enviando = true;
  try {
    for (let it = lerFila()[0]; it; it = lerFila()[0]) {
      let r: Response;
      try {
        r = await fetch(it.url, { method: it.method, headers: { ...it.headers, apikey, authorization: `Bearer ${token}` }, body: it.body });
      } catch { break; }
      if (r.status === 401 || r.status === 408 || r.status === 429 || r.status >= 500) break;
      if (!r.ok) {
        // Dado recusado pelo banco (não adianta repetir)
        console.error("Registro offline recusado", it, await r.text().catch(() => ""));
        localStorage.setItem(RECUSADOS, String(recusados() + 1));
      }
      gravarFila(lerFila().filter((i) => i.id !== it.id));
    }
  } finally {
    enviando = false;
  }
}
