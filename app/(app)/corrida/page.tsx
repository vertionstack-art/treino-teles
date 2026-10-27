"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDias, diasEntre, fmtCurta, fmtDataCompleta, fmtDuracao, fmtPace, hojeISO, inicioSemana } from "@/lib/datas";
import { PROVA, TIPO_CORRIDA, ZONAS_FC, ZONAS_PACE, gerarSemana, paceLeve, paceZona } from "@/lib/corrida";

type Plano = { id: string; data: string; tipo: string; distancia_km: number; pace_alvo: string; descricao: string; status: string };
type Corrida = { id: string; data: string; distancia_m: number | null; duracao_s: number | null; fc_media: number | null; nome: string | null; fonte: string };
type Feedback = { session_id: string; dor_0a10: number; local_dor: string | null; notas: string | null; created_at: string };

const LOCAIS = ["Joelho direito", "Joelho esquerdo", "Os dois joelhos", "Outro lugar"];

export default function Corrida() {
  const hoje = hojeISO();
  const seg = inicioSemana(hoje);
  const [perfil, setPerfil] = useState<{ retorno_lesao: boolean; retorno_nivel: number } | null>(null);
  const [plano, setPlano] = useState<Plano[]>([]);
  const [corridas, setCorridas] = useState<Corrida[]>([]);
  const [fb, setFb] = useState<Feedback[]>([]);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [{ data: p }, { data: rp }, { data: ws }] = await Promise.all([
      sb.from("profiles").select("retorno_lesao, retorno_nivel").maybeSingle(),
      sb.from("run_plan").select("*").gte("data", seg).lte("data", addDias(seg, 13)).order("data"),
      sb.from("workout_sessions").select("id, data, distancia_m, duracao_s, fc_media, nome, fonte").eq("tipo", "corrida").gte("data", addDias(hoje, -90)).order("data", { ascending: false }),
    ]);
    const prof = p ?? { retorno_lesao: true, retorno_nivel: 1 };
    setPerfil(prof);
    let planos = (rp || []) as Plano[];
    // Gera a semana atual se ainda não existir
    if (!planos.some((x) => x.data >= seg && x.data <= addDias(seg, 6))) {
      const novos = gerarSemana(seg, prof.retorno_lesao, prof.retorno_nivel);
      const { data: ins } = await sb.from("run_plan").insert(novos).select("*");
      planos = [...planos, ...((ins || []) as Plano[])].sort((a, b) => a.data.localeCompare(b.data));
    }
    setPlano(planos);
    const cs = (ws || []) as Corrida[];
    setCorridas(cs);
    if (cs.length) {
      const { data: f } = await sb.from("run_feedback").select("session_id, dor_0a10, local_dor, notas, created_at").in("session_id", cs.map((c) => c.id));
      setFb((f || []) as Feedback[]);
    } else setFb([]);
  }, [hoje, seg]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  async function salvarPerfil(retorno: boolean, nivel: number) {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    await sb.from("profiles").update({ retorno_lesao: retorno, retorno_nivel: nivel }).eq("id", user!.id);
    // Refaz as sessões futuras da semana com o novo modo
    await sb.from("run_plan").delete().gte("data", hoje).lte("data", addDias(seg, 6)).eq("status", "planejado");
    const novos = gerarSemana(seg, retorno, nivel).filter((n) => n.data >= hoje);
    if (novos.length) await sb.from("run_plan").insert(novos);
    setMsg("Plano da semana atualizado.");
    carregar();
  }

  const fbDe = (id: string) => fb.find((f) => f.session_id === id);
  const pendentes = corridas.filter((c) => !fbDe(c.id) && diasEntre(c.data, hoje) <= 14);
  const ultimoFb = [...fb].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  const proxima = plano.find((p) => p.data > hoje && p.status === "planejado");
  const diasProva = diasEntre(hoje, PROVA.data);
  const corridaNoDia = (d: string) => corridas.find((c) => c.data === d);
  const recentesSemDor = fb.length >= 2 && [...fb].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 2).every((f) => f.dor_0a10 < 3);

  async function reduzirProxima() {
    if (!proxima) return;
    await createClient().from("run_plan").update({
      distancia_km: Math.max(2, Math.round(proxima.distancia_km * 0.7 * 10) / 10),
      pace_alvo: paceLeve(),
      descricao: "Reduzida por dor: só leve, terreno plano. Pare se doer. " + proxima.descricao,
      status: "reduzido",
    }).eq("id", proxima.id);
    setMsg("Próxima corrida reduzida.");
    carregar();
  }

  return (
    <main className="wrap">
      <header>
        <h1>Corrida</h1>
        <p className="sub">Plano da semana, feedback de dor e corridas registradas.</p>
      </header>

      {msg && <p className="msg ok">{msg}</p>}

      {ultimoFb && ultimoFb.dor_0a10 >= 3 && (
        <div className="alert danger">
          <b>Dor {ultimoFb.dor_0a10}/10{ultimoFb.local_dor ? ` (${ultimoFb.local_dor.toLowerCase()})` : ""} na última corrida.</b> Fale com o fisioterapeuta antes de seguir.
          {proxima && proxima.status !== "reduzido" && (
            <div style={{ marginTop: 10 }}>
              <button className="btn small" onClick={reduzirProxima}>Reduzir a próxima ({fmtCurta(proxima.data)}, {proxima.distancia_km} km)</button>
            </div>
          )}
        </div>
      )}

      {pendentes.map((c) => <FeedbackCard key={c.id} c={c} onSaved={carregar} />)}

      <section className="card">
        <div className="between">
          <h2>Plano da semana</h2>
          {perfil?.retorno_lesao && <span className="chip warn">Retorno · nível {perfil.retorno_nivel}</span>}
        </div>
        {plano.filter((p) => p.data <= addDias(seg, 6)).map((p) => {
          const feita = corridaNoDia(p.data);
          return (
            <div key={p.id} className={"act" + (feita ? " done" : "")}>
              <div style={{ minWidth: 0 }}>
                <b>{fmtCurta(p.data)} · {TIPO_CORRIDA[p.tipo] || p.tipo} · {p.distancia_km} km</b>
                <span style={{ display: "block" }}>{p.pace_alvo}</span>
                <span style={{ display: "block" }}>{p.descricao}</span>
              </div>
              {feita ? <span className="chip ok">✓ {((feita.distancia_m || 0) / 1000).toFixed(1)} km</span>
                : p.status === "reduzido" ? <span className="chip warn">Reduzida</span>
                  : p.data < hoje ? <span className="chip">Não feita</span> : null}
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2>Modo retorno de lesão</h2>
        <p className="note" style={{ margin: 0 }}>Volume reduzido para voltar do joelho. Suba de nível só quando o fisioterapeuta liberar.</p>
        <label className="check">
          <input type="checkbox" checked={!!perfil?.retorno_lesao} onChange={(e) => perfil && salvarPerfil(e.target.checked, perfil.retorno_nivel)} />
          <span>Modo retorno ativo</span>
        </label>
        {perfil?.retorno_lesao && (
          <div className="field">
            <label htmlFor="nivel">Nível liberado</label>
            <select id="nivel" value={perfil.retorno_nivel} onChange={(e) => salvarPerfil(true, Number(e.target.value))}>
              {[1, 2, 3, 4, 5, 6].map((n) => {
                const s = gerarSemana(seg, true, n);
                return <option key={n} value={n}>Nível {n}: {s.reduce((a, x) => a + x.distancia_km, 0)} km/semana ({s.map((x) => x.distancia_km).join(" + ")})</option>;
              })}
            </select>
          </div>
        )}
        {perfil?.retorno_lesao && recentesSemDor && perfil.retorno_nivel < 6 && (
          <p className="msg ok">As duas últimas corridas ficaram com dor abaixo de 3. Se o fisio liberar, dá para subir para o nível {perfil.retorno_nivel + 1}.</p>
        )}
      </section>

      <section className="card">
        <div className="between">
          <h2>Próxima prova</h2>
          {PROVA.incerta && <span className="chip warn">Incerta</span>}
        </div>
        <div className="t">{PROVA.nome}</div>
        <p className="note" style={{ margin: 0 }}>
          {fmtDataCompleta(PROVA.data)} · {diasProva > 0 ? `faltam ${diasProva} dias` : "já passou"}. Depende da liberação do joelho.
        </p>
      </section>

      <section className="card">
        <h2>Corridas recentes</h2>
        {corridas.length ? (
          <div className="hist">
            {corridas.slice(0, 15).map((c) => {
              const f = fbDe(c.id);
              const km = (c.distancia_m || 0) / 1000;
              return (
                <div key={c.id}>
                  <span>{fmtCurta(c.data)} · {km.toFixed(1)} km{f ? ` · dor ${f.dor_0a10}` : ""}</span>
                  <span>{fmtDuracao(c.duracao_s)} · {km ? fmtPace((c.duracao_s || 0) / km) : "–"}{c.fc_media ? ` · FC ${c.fc_media}` : ""}</span>
                </div>
              );
            })}
          </div>
        ) : <p className="note" style={{ margin: 0 }}>Nenhuma corrida ainda. Registre abaixo.</p>}
      </section>

      <NovaCorrida onSaved={carregar} />

      <details className="card">
        <summary><h2>Zonas</h2></summary>
        <div className="in">
          <p className="small" style={{ marginTop: 0 }}><b>FC:</b> {ZONAS_FC}</p>
          <table>
            <thead><tr><th>Zona</th><th>Pace</th></tr></thead>
            <tbody>{Object.keys(ZONAS_PACE).map((z) => <tr key={z}><td>{z}</td><td>{paceZona(z)}</td></tr>)}</tbody>
          </table>
          <p className="note">Referências: meia de 20/09 em 1h50min24s (5:14/km); 5 km estimado em 23:54.</p>
        </div>
      </details>
    </main>
  );
}

function FeedbackCard({ c, onSaved }: { c: Corrida; onSaved: () => void }) {
  const [dor, setDor] = useState<number | null>(null);
  const [local, setLocal] = useState(LOCAIS[0]);
  const [notas, setNotas] = useState("");
  async function salvar() {
    if (dor == null) return;
    await createClient().from("run_feedback").insert({ session_id: c.id, dor_0a10: dor, local_dor: dor > 0 ? local : null, notas: notas || null });
    onSaved();
  }
  return (
    <section className="card">
      <h2>Como ficou o joelho?</h2>
      <p className="note" style={{ margin: 0 }}>Corrida de {fmtCurta(c.data)} · {((c.distancia_m || 0) / 1000).toFixed(1)} km. Dor de 0 a 10:</p>
      <div className="pain">
        {Array.from({ length: 11 }, (_, i) => <button key={i} aria-pressed={dor === i} onClick={() => setDor(i)}>{i}</button>)}
      </div>
      {dor != null && dor > 0 && (
        <div className="field">
          <label htmlFor={"l" + c.id}>Onde</label>
          <select id={"l" + c.id} value={local} onChange={(e) => setLocal(e.target.value)}>{LOCAIS.map((l) => <option key={l}>{l}</option>)}</select>
        </div>
      )}
      {dor != null && dor >= 3 && <p className="msg err">Dor 3 ou mais: o app vai sugerir reduzir a próxima corrida. Avise o fisio.</p>}
      <div className="field">
        <label htmlFor={"n" + c.id}>Observação (opcional)</label>
        <input id={"n" + c.id} value={notas} onChange={(e) => setNotas(e.target.value)} />
      </div>
      <button className="btn" disabled={dor == null} onClick={salvar}>Salvar</button>
    </section>
  );
}

function NovaCorrida({ onSaved }: { onSaved: () => void }) {
  const [data, setData] = useState(hojeISO());
  const [km, setKm] = useState("");
  const [min, setMin] = useState("");
  async function salvar() {
    const k = parseFloat(km.replace(",", ".")), m = parseFloat(min.replace(",", "."));
    if (!k || !m) return;
    await createClient().from("workout_sessions").insert({ data, tipo: "corrida", fonte: "manual", nome: "Corrida (manual)", distancia_m: k * 1000, duracao_s: Math.round(m * 60) });
    setKm(""); setMin(""); onSaved();
  }
  return (
    <details className="card">
      <summary><h2>Registrar corrida</h2></summary>
      <div className="in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <p className="note" style={{ margin: 0 }}>Registre cada corrida feita.</p>
        <div className="grid3">
          <div className="field"><label htmlFor="cd">Data</label><input id="cd" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field"><label htmlFor="ck">Km</label><input id="ck" inputMode="decimal" value={km} onChange={(e) => setKm(e.target.value)} /></div>
          <div className="field"><label htmlFor="cm">Minutos</label><input id="cm" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></div>
        </div>
        <button className="btn" onClick={salvar}>Salvar corrida</button>
      </div>
    </details>
  );
}
