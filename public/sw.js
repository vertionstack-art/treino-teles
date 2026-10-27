// Service worker: guarda as telas e os arquivos do app para abrir sem internet.
// Telas: rede primeiro (com prazo), cópia guardada se a rede falhar. Arquivos com hash (_next/static): cache primeiro.
// Os dados do Supabase são cuidados em lib/offline.ts, não aqui.
const VERSAO = "v1";
const TELAS = `telas-${VERSAO}`;
const ARQUIVOS = `arquivos-${VERSAO}`;
const ROTAS = ["/", "/musculacao", "/esteira", "/nutricao", "/nutricao/dieta", "/atividades", "/corpo", "/protocolo", "/mais"];
const PRAZO_TELA = 4000;

self.addEventListener("install", () => self.skipWaiting());

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if ((k.startsWith("telas-") || k.startsWith("arquivos-")) && k !== TELAS && k !== ARQUIVOS) await caches.delete(k);
    await self.clients.claim();
    await guardarTudo();
  })());
});

self.addEventListener("message", (e) => {
  if (e.data === "guardar") e.waitUntil(guardarTudo());
});

const estatico = (url) =>
  url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") ||
  ["/icon", "/apple-icon", "/manifest.webmanifest"].includes(url.pathname);

// Baixa todas as telas (só com login: redirecionamento para /login não é guardado) e os arquivos que elas usam
async function guardarTudo() {
  const telas = await caches.open(TELAS);
  const arquivos = await caches.open(ARQUIVOS);
  const usados = new Set();
  for (const rota of ROTAS) {
    try {
      const r = await fetch(rota, { credentials: "same-origin" });
      if (!r.ok || r.redirected) continue;
      const html = await r.clone().text();
      await telas.put(rota, r);
      for (const m of html.matchAll(/\/_next\/static\/[^"'\s)\\]+/g)) usados.add(m[0]);
    } catch {}
  }
  for (const a of usados) {
    if (await arquivos.match(a)) continue;
    try { const r = await fetch(a); if (r.ok) await arquivos.put(a, r); } catch {}
  }
  // Limpa arquivos de versões antigas do app quando o cache cresce
  const chaves = await arquivos.keys();
  if (usados.size && chaves.length > 400) {
    for (const k of chaves) if (!usados.has(new URL(k.url).pathname)) await arquivos.delete(k);
  }
}

const OFFLINE = `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sem conexão</title><body style="font-family:system-ui;padding:32px 20px;background:#F3F5FA;color:#0C111C">
<h1 style="font-size:22px">Sem conexão</h1><p>Esta tela ainda não foi guardada no aparelho. Abra o app uma vez com internet para ela ficar disponível offline.</p>
<p><a href="/">Voltar para Hoje</a></p></body></html>`;

async function tela(req) {
  const url = new URL(req.url);
  const cache = await caches.open(TELAS);
  const rede = fetch(req).then(async (r) => {
    if (r.ok && !r.redirected && ROTAS.includes(url.pathname)) await cache.put(url.pathname, r.clone());
    return r;
  });
  rede.catch(() => {});
  const prazo = new Promise((ok) => setTimeout(() => ok(null), PRAZO_TELA));
  const r = await Promise.race([rede, prazo]).catch(() => null);
  if (r) return r;
  const salvo = await cache.match(url.pathname);
  if (salvo) return salvo;
  try { return await rede; } catch {
    return new Response(OFFLINE, { status: 503, headers: { "content-type": "text/html; charset=utf-8" } });
  }
}

async function arquivo(req) {
  const cache = await caches.open(ARQUIVOS);
  const salvo = await cache.match(req, { ignoreSearch: true });
  if (salvo) return salvo;
  const r = await fetch(req);
  if (r.ok) await cache.put(req, r.clone());
  return r;
}

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (req.mode === "navigate") {
    if (url.pathname.startsWith("/auth/") || url.pathname === "/login") return;
    e.respondWith(tela(req));
  } else if (estatico(url)) {
    e.respondWith(arquivo(req));
  }
});
