"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { DAYNAME, DAYSHORT, DURNAME, LOCNAME, MUS, ORDEM, W, defReps, itens, parse, proximoDaFila, ytUrl, type Dia, type Local, type Tempo } from "@/lib/treinos";
import { fmtCurta, fmtDuracao, hojeISO } from "@/lib/datas";

type Serie = { kg?: string; reps?: string; ok?: boolean };
type Sessao = { d: Dia; l: Local; t: Tempo; start: number; sets: Record<number, Serie[]>; simple: Record<number, boolean> };
type Estado = { d: Dia; l: Local; t: Tempo };
type Ultima = Record<string, { date: string; sets: { kg: string; reps: string }[] }>;
type Hist = { id: string; data: string; plano_dia: string | null; local: string | null; duracao_s: number | null; series: number | null; volume_kg: number | null; kcal: number | null; fc_media: number | null };
type Rest = { end: number; total: number; label: string; fired: boolean };

function load<T>(k: string, d: T): T {
  try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; }
}
function store(k: string, v: unknown) {
  try { localStorage.setItem(k, JSON.stringify(v)); } catch {}
}
const agora = () => Date.now();

// iOS: tocar como mídia (som mesmo no silencioso) e destravar o áudio num toque do usuário
function destravarAudio(atual: AudioContext | null): AudioContext | null {
  try { const n = navigator as Navigator & { audioSession?: { type: string } }; if (n.audioSession) n.audioSession.type = "playback"; } catch {}
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const a = atual || new AC();
    a.resume?.();
    const o = a.createOscillator(), g = a.createGain();
    g.gain.value = 0.0001; o.connect(g); g.connect(a.destination); o.start(); o.stop(a.currentTime + 0.02);
    return a;
  } catch { return atual; }
}
function bipe(a: AudioContext | null) {
  try {
    if (a) {
      const t0 = a.currentTime;
      [0, 0.35, 0.7].forEach((dt, k) => {
        const o = a.createOscillator(), g = a.createGain(); o.type = "square"; o.frequency.value = k === 2 ? 1320 : 880;
        g.gain.setValueAtTime(0.0001, t0 + dt); g.gain.exponentialRampToValueAtTime(0.35, t0 + dt + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dt + 0.25);
        o.connect(g); g.connect(a.destination); o.start(t0 + dt); o.stop(t0 + dt + 0.27);
      });
    }
  } catch {}
  try { navigator.vibrate?.([300, 150, 300]); } catch {}
}

const fmt = (s: number) => { s = Math.max(0, Math.round(s)); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };

export default function Treino() {
  const params = useSearchParams();
  const [st, setSt] = useState<Estado>({ d: "U1", l: "rua", t: "80" });
  const [proximo, setProximo] = useState<Dia>("U1");
  const escolhido = useRef(false);
  const [session, setSession] = useState<Sessao | null>(null);
  const [ultima, setUltima] = useState<Ultima>({});
  const [hist, setHist] = useState<Hist[]>([]);
  const [summary, setSummary] = useState<{ dur: number; sets: number; vol: number } | null>(null);
  const [rest, setRest] = useState<Rest | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const arm = useRef({ fin: 0, can: 0 });
  const actx = useRef<AudioContext | null>(null);
  const wake = useRef<WakeLockSentinel | null>(null);
  const toastT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const toast = useCallback((m: string, ms = 2200) => {
    setToastMsg(m);
    clearTimeout(toastT.current);
    toastT.current = setTimeout(() => setToastMsg(null), ms);
  }, []);

  // Estado inicial: sessão em andamento > parâmetro ?dia > próximo da fila (definido ao carregar o histórico)
  useEffect(() => {
    let s = load<Sessao | null>("treino-session", null);
    if (s && !ORDEM.includes(s.d)) s = null; // sessão do programa antigo
    let e = load<Estado>("treino-state", { d: "U1", l: "rua", t: "80" });
    if (!(W[e.l] && W[e.l][e.t]) || !ORDEM.includes(e.d)) e = { d: "U1", l: e.l in W ? e.l : "rua", t: e.t in DURNAME ? e.t : "80" };
    if (s) { e = { d: s.d, l: s.l, t: s.t }; escolhido.current = true; }
    else {
      const p = params.get("dia") as Dia | null;
      if (p && ORDEM.includes(p)) { e.d = p; escolhido.current = true; }
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSt(e);
    setSession(s);
  }, [params]);

  const carregar = useCallback(async () => {
    const supabase = createClient();
    const [{ data: sets }, { data: h }] = await Promise.all([
      supabase
        .from("workout_sets")
        .select("exercicio, serie, carga_kg, reps, workout_sessions!inner(data, tipo)")
        .eq("ok", true)
        .eq("workout_sessions.tipo", "musculacao")
        .order("data", { referencedTable: "workout_sessions", ascending: false })
        .limit(800),
      supabase
        .from("workout_sessions")
        .select("id, data, plano_dia, local, duracao_s, series, volume_kg, kcal, fc_media")
        .eq("tipo", "musculacao")
        .order("data", { ascending: false })
        .limit(15),
    ]);
    const u: Ultima = {};
    type Row = { exercicio: string; serie: number; carga_kg: number | null; reps: number | null; workout_sessions: { data: string } | { data: string }[] };
    const linhas = ((sets || []) as Row[]).map((r) => ({ ...r, data: Array.isArray(r.workout_sessions) ? r.workout_sessions[0].data : r.workout_sessions.data }));
    linhas.sort((a, b) => (a.data < b.data ? 1 : a.data > b.data ? -1 : a.serie - b.serie));
    for (const r of linhas) {
      const cur = u[r.exercicio];
      if (cur && cur.date !== r.data) continue;
      if (!cur) u[r.exercicio] = { date: r.data, sets: [] };
      u[r.exercicio].sets.push({ kg: r.carga_kg != null ? String(r.carga_kg) : "", reps: r.reps != null ? String(r.reps) : "" });
    }
    setUltima(u);
    const hs = (h || []) as Hist[];
    setHist(hs);
    const prox = proximoDaFila(hs.find((x) => ORDEM.includes(x.plano_dia as Dia))?.plano_dia);
    setProximo(prox);
    if (!escolhido.current) setSt((e) => ({ ...e, d: prox }));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const its = useMemo(() => itens(st.l, st.t, st.d), [st]);
  const salvarSessao = (s: Sessao | null) => { setSession(s); store("treino-session", s); };
  const mudar = (k: keyof Estado, v: string) => {
    const n = { ...st, [k]: v } as Estado;
    if (k === "d") escolhido.current = true;
    setSt(n); store("treino-state", n); setSummary(null);
  };

  // Som e tela -------------------------------------------------------------------
  const unlockAudio = () => { actx.current = destravarAudio(actx.current); };
  const beep = () => bipe(actx.current);
  const keepAwake = useCallback(async () => {
    try {
      if ("wakeLock" in navigator && document.visibilityState === "visible") wake.current = await navigator.wakeLock.request("screen");
    } catch {}
  }, []);
  useEffect(() => {
    if (!session) return;
    keepAwake();
    const v = () => { if (document.visibilityState === "visible") { keepAwake(); setNow(agora()); } };
    document.addEventListener("visibilitychange", v);
    return () => document.removeEventListener("visibilitychange", v);
  }, [session, keepAwake]);

  // Relógio ------------------------------------------------------------------------
  useEffect(() => {
    if (!session && !rest) return;
    const i = setInterval(() => setNow(agora()), 250);
    return () => clearInterval(i);
  }, [session, rest]);
  useEffect(() => {
    if (rest && !rest.fired && rest.end - now <= 0) {
      beep();
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRest({ ...rest, fired: true });
      setTimeout(() => setRest((r) => (r && r.fired ? null : r)), 6000);
    }
  }, [now, rest]);

  const startRest = (sec: number, label: string) => {
    unlockAudio();
    const t = agora();
    setRest({ end: t + sec * 1000, total: sec, label, fired: false });
    setNow(t);
  };

  // Treino -------------------------------------------------------------------------
  const startWorkout = () => {
    unlockAudio();
    salvarSessao({ ...st, start: agora(), sets: {}, simple: {} });
    setSummary(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    toast("Treino iniciado. Bom treino!");
  };

  const finishWorkout = async () => {
    if (!session) return;
    if (Date.now() - arm.current.fin > 3000) { arm.current.fin = Date.now(); toast("Toque de novo em Finalizar para salvar"); return; }
    setSalvando(true);
    const supabase = createClient();
    let nSets = 0, vol = 0;
    const linhas: { exercicio: string; ordem: number; serie: number; carga_kg: number | null; reps: number | null; ok: boolean }[] = [];
    its.forEach((it, i) => {
      (session.sets[i] || []).forEach((s, k) => {
        if (!s?.ok) return;
        const kg = parseFloat(s.kg || "") || null, reps = parseInt(s.reps || "") || null;
        nSets++; vol += (kg || 0) * (reps || 0);
        linhas.push({ exercicio: it.name, ordem: i, serie: k + 1, carga_kg: kg, reps, ok: true });
      });
    });
    const dur = Math.round((Date.now() - session.start) / 1000);
    const data = hojeISO(new Date(session.start));
    const dados = {
      data, tipo: "musculacao", plano_dia: session.d, local: session.l, duracao_s: dur, series: nSets,
      volume_kg: Math.round(vol), inicio: new Date(session.start).toISOString(),
      nome: `${DAYNAME[session.d]} · ${session.l === "rua" ? "Rua" : "Prédio"} · ${DURNAME[session.t]}`,
    };
    let sessionId: string | null = null;
    const { data: nova, error } = await supabase.from("workout_sessions").insert({ ...dados, fonte: "app" }).select("id").single();
    if (!error) sessionId = nova.id;
    if (!sessionId) { setSalvando(false); toast("Não consegui salvar. Verifique a internet e tente de novo.", 4000); return; }
    if (linhas.length) {
      const { error } = await supabase.from("workout_sets").insert(linhas.map((l) => ({ ...l, session_id: sessionId })));
      if (error) { setSalvando(false); toast("Sessão salva, mas as séries falharam. Tente Finalizar de novo.", 4000); return; }
    }
    setSummary({ dur, sets: nSets, vol: Math.round(vol) });
    salvarSessao(null); setRest(null); setSalvando(false);
    try { wake.current?.release(); } catch {}
    window.scrollTo({ top: 0, behavior: "smooth" });
    carregar();
  };

  const cancelWorkout = () => {
    if (Date.now() - arm.current.can > 3000) { arm.current.can = Date.now(); toast("Toque de novo em Descartar para apagar este treino"); return; }
    salvarSessao(null); setRest(null);
  };

  const setCampo = (i: number, s: number, f: "kg" | "reps", v: string) => {
    if (!session) return;
    const sets = { ...session.sets, [i]: [...(session.sets[i] || [])] };
    sets[i][s] = { ...(sets[i][s] || {}), [f]: v.replace(",", ".") };
    salvarSessao({ ...session, sets });
  };

  // Sugestão para uma série vazia: série anterior de hoje > mesma série da última vez > última carga da última vez
  const sugestao = (i: number, s: number): { kg: string; reps: string } => {
    const arr = session?.sets[i] || [];
    const lp = ultima[its[i].name];
    let ant: Serie | undefined;
    for (let k = s - 1; k >= 0; k--) if (arr[k]?.kg) { ant = arr[k]; break; }
    const ult = lp?.sets[s] || (lp?.sets.length ? lp.sets[lp.sets.length - 1] : undefined);
    return { kg: ant?.kg || ult?.kg || "", reps: ant?.reps || ult?.reps || defReps(its[i].target) };
  };

  // Preenche as séries ainda abertas: com a última vez (se houver) ou repetindo a última série feita hoje
  const repetir = (i: number) => {
    if (!session) return;
    const it = its[i], lp = ultima[it.name];
    const arr = [...(session.sets[i] || [])];
    let ref: Serie | undefined;
    for (let k = arr.length - 1; k >= 0; k--) if (arr[k]?.kg) { ref = arr[k]; break; }
    if (!lp?.sets.length && !ref) { toast("Faça a primeira série para poder repetir"); return; }
    let n = 0;
    for (let s = 0; s < it.sets; s++) {
      const v = arr[s] || {};
      if (v.ok || v.kg) continue;
      const fonte = lp?.sets[s] || ref || lp?.sets[lp.sets.length - 1];
      if (!fonte) continue;
      arr[s] = { ...v, kg: fonte.kg, reps: v.reps || fonte.reps || defReps(it.target) };
      n++;
    }
    salvarSessao({ ...session, sets: { ...session.sets, [i]: arr } });
    toast(n ? `${n} série(s) preenchida(s) ${lp?.sets.length ? "com a última vez" : "repetindo a anterior"}. Confira e marque ✓.` : "Nada para preencher");
  };

  const marcar = (i: number, s: number) => {
    if (!session) return;
    const it = its[i];
    const sug = sugestao(i, s);
    const sets = { ...session.sets, [i]: [...(session.sets[i] || [])] };
    const v = { ...(sets[i][s] || {}) };
    v.ok = !v.ok;
    if (v.ok) {
      if (!v.kg && sug.kg) v.kg = sug.kg;
      if (!v.reps) v.reps = sug.reps;
    }
    sets[i][s] = v;
    salvarSessao({ ...session, sets });
    if (!v.ok) return;
    if (it.group) {
      const L = it.group[0];
      const block = its.map((x, k) => ({ x, k })).filter((o) => o.x.group && o.x.group[0] === L);
      const pos = block.findIndex((o) => o.k === i);
      if (pos < block.length - 1) { setRest(null); toast("Agora: " + block[pos + 1].x.group + " · " + block[pos + 1].x.name); }
      else startRest(block[block.length - 1].x.restS || 60, "Descanso · próxima rodada do bloco " + L);
    } else if (it.restS) {
      const done = sets[i].filter((z) => z?.ok).length;
      startRest(it.restS, done >= it.sets ? "Descanso · próximo exercício" : `Descanso · série ${done + 1} de ${it.sets}`);
    }
  };

  // Render -------------------------------------------------------------------------
  const total = its.filter((i) => !i.opt).reduce((a, i) => a + i.sets, 0);
  const lastSame = hist.find((h) => h.plano_dia === st.d && h.local === st.l);
  const howto =
    st.t === "50" ? "Superséries: faça A1 e A2 alternando, descanse e repita. Depois B, depois C. Marque ✓ em cada série; o descanso começa sozinho."
      : st.t === "50s" ? "Versão para academia cheia: um exercício por vez, menos séries e só os exercícios principais. Marque ✓ em cada série; o descanso começa sozinho."
        : "Um exercício por vez. Marque ✓ em cada série; o timer de descanso começa sozinho.";

  const volume = useMemo(() => {
    const tot: Record<string, number> = {};
    for (const d of ORDEM) for (const it of W[st.l][st.t][d].map(parse)) if (it.mus) for (const [m, v] of Object.entries(it.mus)) tot[m] = (tot[m] || 0) + (v || 0);
    return tot;
  }, [st.l, st.t]);

  // Rótulo "Bloco X · par/trio" antes do primeiro exercício de cada bloco
  const rotulos = its.map((it, i) => {
    if (!it.group) return null;
    const L = it.group[0];
    if (i > 0 && its[i - 1].group?.[0] === L) return null;
    return `Bloco ${L}${its.filter((x) => x.group && x.group[0] === L).length > 2 ? " · trio" : " · par"}`;
  });
  const restLeft = rest ? (rest.end - now) / 1000 : 0;

  return (
    <>
      <main className="wrap">
        <header>
          <h1>Musculação</h1>
          <p className="sub">Superior e inferior em fila: o app sugere sempre o próximo. Treino perdido não sai da fila, só atrasa.</p>
        </header>

        {!session && (
          <div className="controls">
            <div className="seg" role="group" aria-label="Treino">
              {ORDEM.map((d) => (
                <button key={d} aria-pressed={st.d === d} onClick={() => mudar("d", d)}>
                  {DAYSHORT[d]}<small>{d === proximo ? "próximo" : d === "L" ? "perna" : "superior"}</small>
                </button>
              ))}
            </div>
            <div className="seg" role="group" aria-label="Local">
              <button aria-pressed={st.l === "rua"} onClick={() => mudar("l", "rua")}>Academia da rua</button>
              <button aria-pressed={st.l === "predio"} onClick={() => mudar("l", "predio")}>Academia do prédio</button>
            </div>
            <div className="seg" role="group" aria-label="Tempo">
              <button aria-pressed={st.t === "80"} onClick={() => mudar("t", "80")}>1h20<small>completo</small></button>
              <button aria-pressed={st.t === "50"} onClick={() => mudar("t", "50")}>50 min<small>conjugado</small></button>
              <button aria-pressed={st.t === "50s"} onClick={() => mudar("t", "50s")}>50 min<small>simples</small></button>
            </div>
          </div>
        )}

        {summary && (
          <div className="summary">
            <h2>Treino salvo</h2>
            <div className="stats">
              <div className="stat"><b>{fmtDuracao(summary.dur)}</b><span>Duração</span></div>
              <div className="stat"><b>{summary.sets}</b><span>Séries</span></div>
              <div className="stat"><b>{summary.vol.toLocaleString("pt-BR")}</b><span>kg levantados</span></div>
            </div>
            <button className="btn ghost small" onClick={() => setSummary(null)}>Fechar</button>
          </div>
        )}

        {session ? (
          <div className="live">
            <div>
              <div className="lbl">{DAYNAME[st.d]} · {st.l === "rua" ? "Rua" : "Prédio"} · {DURNAME[st.t]}</div>
              <div className="clock">{fmtDuracao((now - session.start) / 1000)}</div>
            </div>
            <div className="acts2">
              <button onClick={cancelWorkout}>Descartar</button>
              <button className="fin" onClick={finishWorkout} disabled={salvando}>{salvando ? "Salvando…" : "Finalizar"}</button>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="t">{DAYNAME[st.d]}</div>
            <div className="chips">
              <span className="chip">{LOCNAME[st.l]}</span>
              <span className="chip">{DURNAME[st.t]}</span>
              <span className="chip">{total} séries</span>
              {lastSame && <span className="chip">Última vez: {fmtCurta(lastSame.data)}</span>}
            </div>
            {st.d !== proximo && <p className="note" style={{ margin: 0 }}>O próximo da fila é {DAYNAME[proximo]}. Você escolheu outro.</p>}
            <button className="btn" onClick={startWorkout}>Iniciar treino</button>
          </div>
        )}

        <p className="howto">{howto}</p>

        <div className="list">
          {its.map((it, i) => {
            const label = rotulos[i] ? <div className="label">{rotulos[i]}</div> : null;
            const n = i + 1;
            const lp = ultima[it.name];
            const isWarm = it.sets === 0;
            let allOk = false;
            let body: React.ReactNode = null;
            if (session) {
              if (isWarm) {
                allOk = !!session.simple[i];
                body = (
                  <button className={"btn small" + (allOk ? "" : " ghost")} onClick={() => salvarSessao({ ...session, simple: { ...session.simple, [i]: !allOk } })}>
                    {allOk ? "✓ Feito" : "Marcar como feito"}
                  </button>
                );
              } else {
                const arr = session.sets[i] || [];
                let okCount = 0;
                const rows = Array.from({ length: it.sets }, (_, s) => {
                  const v = arr[s] || {};
                  if (v.ok) okCount++;
                  const sug = sugestao(i, s);
                  return (
                    <div className={"setrow" + (v.ok ? " ok" : "")} key={s}>
                      <span className="sn">{s + 1}</span>
                      <input inputMode="decimal" type="text" value={v.kg || ""} placeholder={sug.kg || "kg"} aria-label={`Carga série ${s + 1}`} onChange={(e) => setCampo(i, s, "kg", e.target.value)} />
                      <input inputMode="numeric" type="text" value={v.reps || ""} placeholder={sug.reps || it.target} aria-label={`Repetições série ${s + 1}`} onChange={(e) => setCampo(i, s, "reps", e.target.value)} />
                      <button className="ck" aria-label={`Concluir série ${s + 1}`} onClick={() => marcar(i, s)}>✓</button>
                    </div>
                  );
                });
                allOk = okCount === it.sets;
                body = (
                  <div className="sets">
                    <div className="sethead"><span>Série</span><span style={{ textAlign: "center" }}>Carga (kg)</span><span style={{ textAlign: "center" }}>Reps ({it.target})</span><span /></div>
                    {rows}
                  </div>
                );
              }
            }
            return (
              <div key={st.l + st.t + st.d + i} style={{ display: "contents" }}>
                {label}
                <div className={"ex" + (it.group ? " sup" : "") + (it.opt ? " opt" : "") + (allOk ? " done" : "")}>
                  <div className="hd">
                    <span className="n">{it.group || n}</span>
                    <div style={{ minWidth: 0 }}>
                      <div className="nm">{it.name}{it.opt && <span className="note"> (opcional)</span>}</div>
                      <div className="meta"><b>{it.sx}</b>{it.rest && <span>Descanso {it.rest}</span>}</div>
                      {it.tip && <div className="tip">{it.tip}</div>}
                      {lp && lp.sets.length > 0 && (
                        <div className="last">Última ({fmtCurta(lp.date)}): <b>{lp.sets.map((s) => `${s.kg || "–"}kg×${s.reps || "–"}`).join(" · ")}</b></div>
                      )}
                    </div>
                  </div>
                  {(!isWarm || it.restS > 0) && (
                    <div className="tools">
                      {!isWarm && <a className="tool yt" href={ytUrl(it.name)} target="_blank" rel="noopener">Vídeo</a>}
                      {it.restS > 0 && <button className="tool tm" onClick={() => startRest(it.restS, "Descanso · " + it.name)}>⏱ {it.restS}s</button>}
                      {session && !isWarm && <button className="tool tm" onClick={() => repetir(i)}>↻ Repetir</button>}
                    </div>
                  )}
                  {body}
                </div>
              </div>
            );
          })}
        </div>

        <details className="card">
          <summary><h2>Histórico</h2></summary>
          <div className="in hist">
            {hist.length ? hist.map((h) => (
              <div key={h.id}>
                <span>{fmtCurta(h.data)} · {h.plano_dia ? DAYSHORT[h.plano_dia] || h.plano_dia : "Treino"}{h.local === "predio" ? " · Prédio" : h.local === "rua" ? " · Rua" : ""}</span>
                <span>{fmtDuracao(h.duracao_s)} · {h.series ?? "–"} séries · {(h.volume_kg ?? 0).toLocaleString("pt-BR")} kg{h.kcal ? ` · ${h.kcal} kcal` : ""}</span>
              </div>
            )) : <p className="note" style={{ margin: 0 }}>Nenhum treino salvo ainda. Toque em Iniciar treino e, no fim, em Finalizar.</p>}
          </div>
        </details>

        <details className="card">
          <summary><h2>Volume por semana</h2></summary>
          <div className="in">
            <p className="note" style={{ marginTop: 0 }}>Séries por grupo muscular numa semana com os 3 treinos. &quot;ABC&quot; é o Full Body anterior (1h20, rua). O volume caiu de propósito: a musculação agora é acessória à corrida.</p>
            <div className="tbl">
              <table>
                <thead><tr><th>Grupo</th><th>ABC</th><th>Agora</th></tr></thead>
                <tbody>
                  {MUS.map(([m, lbl, antes]) => {
                    const agora = volume[m] || 0;
                    return <tr key={m}><td>{lbl}</td><td>{antes}</td><td>{agora}</td></tr>;
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </details>

        <details className="card">
          <summary><h2>Regras</h2></summary>
          <div className="in">
            <ul>
              <li><b>Dois treinos no mesmo dia:</b> musculação antes da corrida, ou separe por 6h.</li>
              <li><b>Pilates no mesmo dia:</b> musculação primeiro. Se o pilates for antes, deixe ao menos 2h.</li>
              <li><b>Fila:</b> faltou um dia? Faça o treino que ficou para trás na próxima ida. Ele não é pulado, só atrasa.</li>
              <li><b>Perna:</b> só uma vez por semana (treino Inferior), para joelho e tendão recuperarem com corrida e pilates.</li>
              <li><b>Semana com 2 idas:</b> pelo menos um Superior e o Inferior.</li>
              <li><b>Abdômen:</b> só no Superior 2. O pilates já trabalha o core.</li>
              <li><b>Cardio da academia:</b> dispense nos dias de corrida ou muay thai.</li>
              <li><b>Semana cheia ou cansado:</b> use a versão de 50 min. Conjugado mantém o volume; simples é para academia cheia ou dia de cansaço.</li>
              <li><b>Intensidade:</b> termine cada série sentindo que daria para fazer mais 1 ou 2 repetições.</li>
              <li><b>Progressão:</b> quando fizer todas as séries no topo da faixa (ex.: 4×10 em &quot;8–10&quot;), aumente a carga.</li>
              <li><b>Objetivo:</b> a musculação é acessória à corrida e à composição corporal.</li>
              <li><b>Superséries (A1/A2):</b> uma série de A1, logo uma de A2, descanse e repita.</li>
              <li><span className="warn">Prédio:</span> halteres leves. Quando ficar fácil, suba para 15 repetições ou use a barra com anilhas. Sem rack, evite carga pesada nas costas.</li>
            </ul>
          </div>
        </details>
      </main>

      {rest && (
        <div className={"restbar" + (rest.fired ? " end" : "")}>
          <div className="row">
            <div>
              <div className="big">{rest.fired ? "0:00" : fmt(restLeft)}</div>
              <div className="cap">{rest.fired ? "Descanso acabou! Próxima série." : rest.label}</div>
            </div>
            <div className="btns">
              <button onClick={() => setRest({ ...rest, end: rest.end - 15000 })}>−15</button>
              <button onClick={() => setRest({ ...rest, end: rest.end + 15000, total: rest.total + 15, fired: false })}>+15</button>
              <button onClick={() => setRest(null)}>Pular</button>
            </div>
          </div>
          <div className="prog"><i style={{ width: rest.fired ? "0%" : Math.max(0, (restLeft / rest.total) * 100) + "%" }} /></div>
        </div>
      )}
      {toastMsg && <div className="toast">{toastMsg}</div>}
    </>
  );
}
