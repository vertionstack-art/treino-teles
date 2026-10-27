"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDias, diasDaSemana, fmtCurta, fmtLonga, hojeISO } from "@/lib/datas";
import { CATALOGO, CURTO_DIA, NOMES_DIA, atividadesDoDia, type Atividade } from "@/lib/semana";
import { calcularSemana } from "@/lib/nutricao";
import { TIPO_CORRIDA } from "@/lib/corrida";
import { DAYNAME, ORDEM, itens, proximoDaFila, type Dia, type Local, type Tempo } from "@/lib/treinos";
import Sheet from "@/components/sheet";

type Sess = { id: string; data: string; tipo: string; kcal: number | null; duracao_s: number | null; distancia_m: number | null; nome: string | null; plano_dia: string | null };
type Plano = { data: string; tipo: string; distancia_km: number; pace_alvo: string; descricao: string };

export default function Hoje() {
  const hoje = hojeISO();
  const dias = useMemo(() => diasDaSemana(hoje), [hoje]);
  const [nome, setNome] = useState("");
  const [ajustes, setAjustes] = useState<Record<string, string[]>>({});
  const [sessoes, setSessoes] = useState<Sess[]>([]);
  const [consumo, setConsumo] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState<number | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [ultimoAntes, setUltimoAntes] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const ini = dias[0], fim = dias[6];
    const [p, dp, ws, fl, nt, rp, um] = await Promise.all([
      sb.from("profiles").select("nome").maybeSingle(),
      sb.from("day_plans").select("data, atividades").gte("data", ini).lte("data", fim),
      sb.from("workout_sessions").select("id, data, tipo, kcal, duracao_s, distancia_m, nome, plano_dia").gte("data", ini).lte("data", fim),
      sb.from("foods_log").select("data_hora, kcal").gte("data_hora", ini + "T03:00:00Z").lt("data_hora", addDias(fim, 1) + "T03:00:00Z"),
      sb.from("nutrition_targets").select("kcal_dia").lte("vigencia_inicio", hoje).order("vigencia_inicio", { ascending: false }).limit(1).maybeSingle(),
      sb.from("run_plan").select("data, tipo, distancia_km, pace_alvo, descricao").gte("data", ini).lte("data", fim),
      // Último treino da fila antes desta semana
      sb.from("workout_sessions").select("plano_dia").eq("tipo", "musculacao").in("plano_dia", ORDEM).lt("data", ini)
        .order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setUltimoAntes(um.data?.plano_dia ?? null);
    setNome(p.data?.nome || "");
    setAjustes(Object.fromEntries((dp.data || []).map((d) => [d.data, d.atividades as string[]])));
    setSessoes((ws.data || []) as Sess[]);
    const c: Record<string, number> = {};
    for (const f of fl.data || []) { const d = hojeISO(new Date(f.data_hora)); c[d] = (c[d] || 0) + Number(f.kcal || 0); }
    setConsumo(c);
    setMeta(nt.data?.kcal_dia ?? null);
    setPlanos((rp.data || []) as Plano[]);
    setCarregado(true);
  }, [dias, hoje]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const feito = (data: string, tipo: string) => sessoes.some((s) => s.data === data && s.tipo === tipo);

  // Treino da fila em cada dia de musculação: feitos mostram o que foi feito; os próximos seguem a fila
  const fila = useMemo(() => {
    const out: Record<string, Dia> = {};
    let ultimo = ultimoAntes;
    for (const d of dias) {
      const feitoNoDia = sessoes.find((s) => s.data === d && s.tipo === "musculacao" && ORDEM.includes(s.plano_dia as Dia));
      if (feitoNoDia) { out[d] = feitoNoDia.plano_dia as Dia; ultimo = feitoNoDia.plano_dia; continue; }
      if (d >= hoje && atividadesDoDia(d, ajustes[d]).some((a) => a.tipo === "musculacao")) {
        out[d] = proximoDaFila(ultimo);
        ultimo = out[d];
      }
    }
    return out;
  }, [dias, sessoes, ultimoAntes, hoje, ajustes]);
  const atividadesHoje = atividadesDoDia(hoje, ajustes[hoje]);
  const semana = meta ? calcularSemana(hoje, meta, consumo) : null;
  const consumidoHoje = Math.round(consumo[hoje] || 0);
  const gastoHoje = sessoes.filter((s) => s.data === hoje).reduce((a, s) => a + (s.kcal || 0), 0);

  async function registrarPilates(data: string) {
    await createClient().from("workout_sessions").insert({ data, tipo: "pilates", fonte: "manual", nome: "Pilates (presença)", duracao_s: 3000 });
    carregar();
  }

  return (
    <main className="wrap">
      <header>
        <h1>Hoje</h1>
        <p className="sub">{fmtLonga(hoje)}{nome ? ` · Olá, ${nome}` : ""}</p>
      </header>

      <section className="card">
        <div className="t">Atividades do dia</div>
        <div className="acts">
          {atividadesHoje.map((a) => (
            <AtividadeLinha key={a.id} a={a} data={hoje} feito={feito(hoje, a.tipo)} treino={fila[hoje]} plano={planos.find((p) => p.data === hoje)} onPilates={() => registrarPilates(hoje)} />
          ))}
        </div>
      </section>

      <section className="card">
        <div className="between">
          <h2>Calorias</h2>
          <Link className="btn ghost small" href="/nutricao">Registrar</Link>
        </div>
        {semana ? (
          <>
            <div className="stats">
              <div className="stat"><b>{consumidoHoje}</b><span>Consumidas</span></div>
              <div className="stat"><b>{semana.metaHoje}</b><span>Meta hoje</span></div>
              <div className="stat"><b>{gastoHoje || "–"}</b><span>Gasto atividades</span></div>
            </div>
            <div className={"bar" + (consumidoHoje > semana.metaHoje ? " over" : "")}>
              <i style={{ width: Math.min(100, (consumidoHoje / semana.metaHoje) * 100) + "%" }} />
            </div>
            <p className="note" style={{ margin: 0 }}>
              {semana.saldoSemana >= 0 ? `Faltam ${semana.saldoSemana.toLocaleString("pt-BR")} kcal para fechar a meta da semana.` : `A semana passou ${Math.abs(semana.saldoSemana).toLocaleString("pt-BR")} kcal da meta.`}
              {semana.reducaoDia > 0 && ` Meta de hoje reduzida em ${semana.reducaoDia} kcal para compensar o excesso, sem passar de 15%.`}
            </p>
          </>
        ) : carregado ? (
          <p className="note" style={{ margin: 0 }}>Defina sua meta de calorias em Nutrição para ver o saldo do dia e da semana.</p>
        ) : null}
      </section>

      <section className="card">
        <h2>Semana</h2>
        <div className="week">
          {dias.map((d) => {
            const ats = atividadesDoDia(d, ajustes[d]);
            const ok = ats.filter((a) => a.tipo !== "descanso").every((a) => feito(d, a.tipo)) && ats.some((a) => a.tipo !== "descanso");
            return (
              <button key={d} className={"day" + (d === hoje ? " today" : "") + (ok && d <= hoje ? " done" : "") + (ajustes[d] ? " ajustado" : "")} onClick={() => setAberto(d)}>
                <b>{CURTO_DIA[new Date(d + "T12:00:00Z").getUTCDay()]}</b>
                <small>{fmtCurta(d)}{ajustes[d] ? " · ajustado" : ""}</small>
                {ats.map((a) => <span key={a.id}>{a.tipo === "musculacao" && fila[d] ? DAYNAME[fila[d]].replace(" (perna)", "") : a.nome}</span>)}
              </button>
            );
          })}
        </div>
        <p className="note" style={{ margin: 0 }}>Toque em um dia para ver os detalhes ou trocar as atividades.</p>
      </section>

      {aberto && (
        <DiaSheet
          data={aberto}
          ajuste={ajustes[aberto]}
          sessoes={sessoes.filter((s) => s.data === aberto)}
          plano={planos.find((p) => p.data === aberto)}
          treino={fila[aberto]}
          onClose={() => setAberto(null)}
          onSaved={() => { carregar(); }}
          onPilates={() => registrarPilates(aberto)}
        />
      )}
    </main>
  );
}

function AtividadeLinha({ a, data, feito, plano, treino, onPilates }: { a: Atividade; data: string; feito: boolean; plano?: Plano; treino?: Dia; onPilates: () => void }) {
  let acao: React.ReactNode = null;
  if (feito) acao = <span className="chip ok">✓ Feito</span>;
  else if (a.tipo === "musculacao") acao = <Link className="btn small" href={`/musculacao${treino ? `?dia=${treino}` : ""}`}>Iniciar</Link>;
  else if (a.tipo === "corrida") acao = <Link className="btn small" href="/corrida">Ver plano</Link>;
  else if (a.tipo === "pilates") acao = <button className="btn small" onClick={onPilates}>Fui</button>;
  else if (a.tipo === "muaythai") acao = <Link className="btn small" href={`/atividades?novo=muaythai&data=${data}`}>Registrar</Link>;
  const obs = a.tipo === "corrida" && plano ? `${TIPO_CORRIDA[plano.tipo] || plano.tipo} · ${plano.distancia_km} km · ${plano.pace_alvo}`
    : a.tipo === "musculacao" && treino ? `${DAYNAME[treino]} (fila)` : a.obs;
  return (
    <div className={"act" + (feito ? " done" : "")}>
      <div style={{ minWidth: 0 }}>
        <b>{a.nome}</b>
        {obs && <span style={{ display: "block" }}>{obs}</span>}
      </div>
      {acao}
    </div>
  );
}

function DiaSheet({ data, ajuste, sessoes, plano, treino, onClose, onSaved, onPilates }: {
  data: string; ajuste?: string[]; sessoes: Sess[]; plano?: Plano; treino?: Dia; onClose: () => void; onSaved: () => void; onPilates: () => void;
}) {
  const ats = atividadesDoDia(data, ajuste);
  const [editando, setEditando] = useState(false);
  const [sel, setSel] = useState<string[]>(ats.map((a) => a.id));
  const [salvando, setSalvando] = useState(false);
  const dow = new Date(data + "T12:00:00Z").getUTCDay();

  // Local e tempo da musculação: os últimos usados na tela de treino
  const pref = (() => {
    try { return JSON.parse(localStorage.getItem("treino-state") || "") as { l: Local; t: Tempo }; } catch { return { l: "rua" as Local, t: "80" as Tempo }; }
  })();

  async function salvar() {
    setSalvando(true);
    const sb = createClient();
    const ids = sel.length ? sel : ["descanso"];
    await sb.from("day_plans").upsert({ data, atividades: ids }, { onConflict: "user_id,data" });
    setSalvando(false); setEditando(false); onSaved();
  }
  async function padrao() {
    setSalvando(true);
    await createClient().from("day_plans").delete().eq("data", data);
    setSalvando(false); setEditando(false); onSaved();
  }

  return (
    <Sheet titulo={`${NOMES_DIA[dow]}, ${fmtCurta(data)}`} onClose={onClose}>
      {!editando ? (
        <>
          {ats.map((a) => {
            const letra = a.tipo === "musculacao" ? treino : undefined;
            const feito = sessoes.some((s) => s.tipo === a.tipo);
            return (
              <div key={a.id} className="card">
                <div className="between">
                  <b>{a.nome}</b>
                  {feito ? <span className="chip ok">✓ Feito</span> : a.tipo === "pilates" ? <button className="btn small" onClick={onPilates}>Fui</button> : null}
                </div>
                {a.obs && <span className="note">{a.obs}</span>}
                {letra && (
                  <>
                    <b className="small">{DAYNAME[letra]}{feito ? "" : " · próximo da fila"}</b>
                    <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
                      {itens(pref.l || "rua", pref.t || "80", letra).filter((i) => i.sets > 0).map((i) => (
                        <li key={i.name}>{i.name} · <span className="muted">{i.sx}</span></li>
                      ))}
                    </ol>
                    {!feito && <Link className="btn small" href={`/musculacao?dia=${letra}`}>Abrir {DAYNAME[letra]}</Link>}
                  </>
                )}
                {a.tipo === "corrida" && (plano ? (
                  <p className="small" style={{ margin: 0 }}>
                    <b>{TIPO_CORRIDA[plano.tipo] || plano.tipo}</b> · {plano.distancia_km} km · {plano.pace_alvo}<br />
                    <span className="muted">{plano.descricao}</span>
                  </p>
                ) : <Link className="small" href="/corrida">Ver plano da corrida</Link>)}
                {a.tipo === "muaythai" && !feito && <Link className="btn small" href={`/atividades?novo=muaythai&data=${data}`}>Registrar muay thai</Link>}
              </div>
            );
          })}
          {sessoes.length > 0 && (
            <div className="card">
              <b>Registrado neste dia</b>
              {sessoes.map((s) => (
                <span key={s.id} className="small">{s.nome || s.tipo}{s.kcal ? ` · ${s.kcal} kcal` : ""}{s.distancia_m ? ` · ${(s.distancia_m / 1000).toFixed(1)} km` : ""}</span>
              ))}
            </div>
          )}
          <button className="btn ghost" onClick={() => setEditando(true)}>Ajustar este dia</button>
        </>
      ) : (
        <>
          <p className="note" style={{ margin: 0 }}>Escolha o que fazer neste dia. Vale só para esta data; a semana padrão não muda.</p>
          {Object.values(CATALOGO).map((a) => (
            <label key={a.id} className="check">
              <input
                type="checkbox"
                checked={sel.includes(a.id)}
                onChange={(e) => setSel(e.target.checked ? [...sel.filter((x) => x !== "descanso" || a.id === "descanso"), a.id] : sel.filter((x) => x !== a.id))}
              />
              <span>{a.nome}</span>
            </label>
          ))}
          <button className="btn" onClick={salvar} disabled={salvando}>Salvar ajuste</button>
          {ajuste && <button className="btn ghost" onClick={padrao} disabled={salvando}>Voltar ao padrão</button>}
          <button className="link" onClick={() => setEditando(false)}>Cancelar</button>
        </>
      )}
    </Sheet>
  );
}
