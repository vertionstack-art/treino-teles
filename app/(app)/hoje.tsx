"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDias, diasDaSemana, fmtCurta, fmtLonga, hojeISO } from "@/lib/datas";
import { CATALOGO, CURTO_DIA, NOMES_DIA, atividadesDoDia, type Atividade } from "@/lib/semana";
import { calcularSemana } from "@/lib/nutricao";
import { DAYNAME, DAYSUB, ORDEM, itens, proximoDaFila, type Dia, type Tempo } from "@/lib/treinos";
import Sheet from "@/components/sheet";
import HorariosJiu from "@/components/jiujitsu";

type Sess = { id: string; data: string; tipo: string; kcal: number | null; duracao_s: number | null; distancia_m: number | null; nome: string | null; plano_dia: string | null };

export default function Hoje() {
  const hoje = hojeISO();
  const dias = useMemo(() => diasDaSemana(hoje), [hoje]);
  const [nome, setNome] = useState("");
  const [ajustes, setAjustes] = useState<Record<string, string[]>>({});
  const [sessoes, setSessoes] = useState<Sess[]>([]);
  const [consumo, setConsumo] = useState<Record<string, number>>({});
  const [meta, setMeta] = useState<number | null>(null);
  const [peso, setPeso] = useState<number | null>(null);
  const [aberto, setAberto] = useState<string | null>(null);
  const [carregado, setCarregado] = useState(false);
  const [ultimoAntes, setUltimoAntes] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const ini = dias[0], fim = dias[6];
    const [p, dp, ws, fl, nt, bi, um] = await Promise.all([
      sb.from("profiles").select("nome").maybeSingle(),
      sb.from("day_plans").select("data, atividades").gte("data", ini).lte("data", fim),
      sb.from("workout_sessions").select("id, data, tipo, kcal, duracao_s, distancia_m, nome, plano_dia").gte("data", ini).lte("data", fim),
      sb.from("foods_log").select("data_hora, kcal").gte("data_hora", ini + "T03:00:00Z").lt("data_hora", addDias(fim, 1) + "T03:00:00Z"),
      sb.from("nutrition_targets").select("kcal_dia").lte("vigencia_inicio", hoje).order("vigencia_inicio", { ascending: false }).limit(1).maybeSingle(),
      sb.from("bioimpedance").select("peso").order("data", { ascending: false }).limit(1).maybeSingle(),
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
    setPeso(bi.data?.peso ? Number(bi.data.peso) : null);
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

  const aulas = (data: string) => sessoes.filter((s) => s.data === data && s.tipo === "jiujitsu");

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
            <AtividadeLinha key={a.id} a={a} data={hoje} feito={feito(hoje, a.tipo)} treino={fila[hoje]} aulas={aulas(hoje)} peso={peso} onChange={carregar} />
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
                {ats.map((a) => <span key={a.id}>{a.tipo === "musculacao" ? (fila[d] ? DAYNAME[fila[d]] : "Musculação · não registrada") : a.nome}</span>)}
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
          treino={fila[aberto]}
          peso={peso}
          onClose={() => setAberto(null)}
          onSaved={() => { carregar(); }}
        />
      )}
    </main>
  );
}

function AtividadeLinha({ a, data, feito, treino, aulas, peso, onChange }: { a: Atividade; data: string; feito: boolean; treino?: Dia; aulas: Sess[]; peso: number | null; onChange: () => void }) {
  let acao: React.ReactNode = null;
  if (a.tipo === "jiujitsu") acao = feito ? <span className="chip ok">✓ {aulas.length} {aulas.length === 1 ? "aula" : "aulas"}</span> : null;
  else if (feito) acao = <span className="chip ok">✓ Feito</span>;
  else if (a.tipo === "musculacao") acao = <Link className="btn small" href={`/musculacao${treino ? `?dia=${treino}` : ""}`}>Iniciar</Link>;
  else if (a.tipo === "esteira") acao = <Link className="btn small" href="/esteira">Registrar</Link>;
  const obs = a.tipo === "musculacao" && treino ? `${DAYNAME[treino]} (fila)` : a.obs;
  return (
    <div className={"act" + (feito ? " done" : "")} style={a.tipo === "jiujitsu" ? { flexWrap: "wrap" } : undefined}>
      <div style={{ minWidth: 0 }}>
        <b>{a.nome}</b>
        {obs && <span style={{ display: "block" }}>{obs}</span>}
      </div>
      {acao}
      {a.tipo === "jiujitsu" && <div style={{ flexBasis: "100%" }}><HorariosJiu data={data} aulas={aulas} peso={peso} onChange={onChange} /></div>}
    </div>
  );
}

function DiaSheet({ data, ajuste, sessoes, treino, peso, onClose, onSaved }: {
  data: string; ajuste?: string[]; sessoes: Sess[]; treino?: Dia; peso: number | null; onClose: () => void; onSaved: () => void;
}) {
  const ats = atividadesDoDia(data, ajuste);
  const [editando, setEditando] = useState(false);
  const [sel, setSel] = useState<string[]>(ats.map((a) => a.id));
  const [salvando, setSalvando] = useState(false);
  const dow = new Date(data + "T12:00:00Z").getUTCDay();

  // Versão da musculação: a última usada na tela de treino
  const pref = (() => {
    try { return JSON.parse(localStorage.getItem("treino-state") || "") as { t: Tempo }; } catch { return { t: "80" as Tempo }; }
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
                  {feito && a.tipo !== "jiujitsu" ? <span className="chip ok">✓ Feito</span> : null}
                </div>
                {a.obs && <span className="note">{a.obs}</span>}
                {letra && (
                  <>
                    <b className="small">{DAYNAME[letra]}{feito ? "" : " · próximo da fila"}</b>
                    <ol className="small" style={{ margin: 0, paddingLeft: 18 }}>
                      {itens(pref.t || "80", letra).filter((i) => i.sets > 0).map((i) => (
                        <li key={i.name}>{i.name} · <span className="muted">{i.sx}</span></li>
                      ))}
                    </ol>
                    {!feito && <Link className="btn small" href={`/musculacao?dia=${letra}`}>Abrir {DAYNAME[letra]}</Link>}
                  </>
                )}
                {a.tipo === "musculacao" && !feito && data < hojeISO() && <TreinoPassado data={data} onSaved={onSaved} />}
                {a.tipo === "jiujitsu" && <HorariosJiu data={data} aulas={sessoes.filter((s) => s.tipo === "jiujitsu")} peso={peso} onChange={onSaved} />}
                {a.tipo === "esteira" && !feito && <Link className="btn small" href="/esteira">Registrar cardio</Link>}
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

// Dia que já passou sem treino salvo: marcar qual treino da fila foi feito (sem séries), para a fila andar
function TreinoPassado({ data, onSaved }: { data: string; onSaved: () => void }) {
  const [salvando, setSalvando] = useState(false);
  async function marcar(d: Dia) {
    setSalvando(true);
    await createClient().from("workout_sessions").insert({ data, tipo: "musculacao", fonte: "manual", plano_dia: d, nome: `${DAYNAME[d]} · registrado depois` });
    setSalvando(false); onSaved();
  }
  return (
    <>
      <p className="note" style={{ margin: 0 }}>Nenhum treino salvo neste dia. Se você treinou, marque qual foi para a fila seguir certa.</p>
      <div className="seg" role="group" aria-label="Treino feito">
        {ORDEM.map((d) => <button key={d} disabled={salvando} onClick={() => marcar(d)}>{d}<small>{DAYSUB[d]}</small></button>)}
      </div>
    </>
  );
}
