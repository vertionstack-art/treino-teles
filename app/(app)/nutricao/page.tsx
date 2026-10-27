"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDias, diasDaSemana, fmtCurta, fmtLonga, hojeISO } from "@/lib/datas";
import { CURTO_DIA } from "@/lib/semana";
import { CORTE_MAX, REFEICOES, calcularSemana, refeicaoPorHora, type Meta } from "@/lib/nutricao";
import { buscar, carregarTaco, porGramas, type Taco } from "@/lib/taco";

type Registro = { id: string; data_hora: string; refeicao: string | null; descricao: string; quantidade_g: number | null; kcal: number | null; prot_g: number | null; carb_g: number | null; gord_g: number | null; origem: string; confianca: string | null };
// base: valores por 100 g (TACO). Quando existe, mudar os gramas recalcula o resto.
type Base = { kcal: number; prot: number; carb: number; gord: number };
type ItemEd = { descricao: string; quantidade_g: string; kcal: string; prot_g: string; carb_g: string; gord_g: string; base?: Base };
type Recente = { descricao: string; quantidade_g: number; base: Base };
const deBase = (descricao: string, g: number, base: Base): ItemEd => {
  const v = porGramas(base, g);
  return { descricao, quantidade_g: String(g), kcal: String(v.kcal), prot_g: String(v.prot), carb_g: String(v.carb), gord_g: String(v.gord), base };
};
const vazio = (): ItemEd => ({ descricao: "", quantidade_g: "", kcal: "", prot_g: "", carb_g: "", gord_g: "" });
const n = (s: string) => parseFloat(String(s).replace(",", ".")) || 0;
const r0 = (x: number) => Math.round(x);

export default function Nutricao() {
  const hoje = hojeISO();
  const [dia, setDia] = useState(hoje);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [registros, setRegistros] = useState<Registro[]>([]);
  const [consumo, setConsumo] = useState<Record<string, number>>({});
  const [ref, setRef] = useState<{ tmb: number | null; mlg: number | null; peso: number | null }>({ tmb: null, mlg: null, peso: null });
  const [carregado, setCarregado] = useState(false);
  const dias = useMemo(() => diasDaSemana(dia), [dia]);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const ini = dias[0], fim = dias[6];
    const [mt, fl, bio] = await Promise.all([
      sb.from("nutrition_targets").select("*").lte("vigencia_inicio", dia).order("vigencia_inicio", { ascending: false }).limit(1).maybeSingle(),
      sb.from("foods_log").select("*").gte("data_hora", ini + "T03:00:00Z").lt("data_hora", addDias(fim, 1) + "T03:00:00Z").order("data_hora"),
      sb.from("bioimpedance").select("tmb, mlg, peso").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setMeta(mt.data as Meta | null);
    const regs = (fl.data || []) as Registro[];
    const c: Record<string, number> = {};
    for (const f of regs) { const d = hojeISO(new Date(f.data_hora)); c[d] = (c[d] || 0) + Number(f.kcal || 0); }
    setConsumo(c);
    setRegistros(regs.filter((f) => hojeISO(new Date(f.data_hora)) === dia));
    setRef({ tmb: bio.data?.tmb ?? null, mlg: bio.data?.mlg ?? null, peso: bio.data?.peso ?? null });
    setCarregado(true);
  }, [dia, dias]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const semana = meta ? calcularSemana(dia === hoje ? hoje : dia, meta.kcal_dia, consumo) : null;
  const metaDia = semana ? (dia === hoje ? semana.metaHoje : dia < hoje ? meta!.kcal_dia : semana.metaHoje) : null;
  const tot = registros.reduce((a, r) => ({ kcal: a.kcal + Number(r.kcal || 0), p: a.p + Number(r.prot_g || 0), c: a.c + Number(r.carb_g || 0), g: a.g + Number(r.gord_g || 0) }), { kcal: 0, p: 0, c: 0, g: 0 });

  async function apagar(id: string) {
    await createClient().from("foods_log").delete().eq("id", id);
    carregar();
  }

  const porRefeicao = REFEICOES.map((rf) => ({ rf, itens: registros.filter((r) => (r.refeicao || "Outros") === rf) })).filter((g) => g.itens.length);
  const outros = registros.filter((r) => !REFEICOES.includes(r.refeicao || ""));

  return (
    <main className="wrap">
      <header>
        <h1>Nutrição</h1>
        <p className="sub">Registre pela busca na TACO ou na mão. Objetivo: recomposição, com meta moderada e proteína alta.</p>
      </header>

      <div className="between">
        <button className="btn ghost small" onClick={() => setDia(addDias(dia, -1))} aria-label="Dia anterior">‹</button>
        <b style={{ textTransform: "capitalize" }}>{dia === hoje ? "Hoje" : fmtLonga(dia)}</b>
        <button className="btn ghost small" onClick={() => setDia(addDias(dia, 1))} disabled={dia >= hoje} aria-label="Próximo dia">›</button>
      </div>

      {meta && metaDia ? (
        <section className="card">
          <div className="stats">
            <div className="stat"><b>{r0(tot.kcal)}</b><span>Consumidas</span></div>
            <div className="stat"><b>{metaDia}</b><span>Meta do dia</span></div>
            <div className="stat"><b>{metaDia - r0(tot.kcal)}</b><span>Restam</span></div>
          </div>
          <div className={"bar" + (tot.kcal > metaDia ? " over" : "")}><i style={{ width: Math.min(100, (tot.kcal / metaDia) * 100) + "%" }} /></div>
          <div className="grid3 small">
            <span>Proteína<br /><b>{r0(tot.p)}</b>{meta.prot_g ? ` / ${meta.prot_g} g` : " g"}</span>
            <span>Carboidrato<br /><b>{r0(tot.c)}</b>{meta.carb_g ? ` / ${meta.carb_g} g` : " g"}</span>
            <span>Gordura<br /><b>{r0(tot.g)}</b>{meta.gord_g ? ` / ${meta.gord_g} g` : " g"}</span>
          </div>
          {semana && semana.reducaoDia > 0 && dia >= hoje && (
            <p className="note" style={{ margin: 0 }}>Meta reduzida em {semana.reducaoDia} kcal para redistribuir {semana.excesso} kcal de excesso dos dias anteriores (limite de {CORTE_MAX * 100}% por dia).</p>
          )}
        </section>
      ) : carregado ? (
        <MetaForm ref0={ref} onSaved={carregar} aberto />
      ) : null}

      <NovoRegistro dia={dia} onSaved={carregar} />

      <section className="card">
        <h2>Registros do dia</h2>
        {registros.length === 0 && <p className="note" style={{ margin: 0 }}>Nada registrado neste dia.</p>}
        {[...porRefeicao, ...(outros.length ? [{ rf: "Outros", itens: outros }] : [])].map((g) => (
          <div key={g.rf}>
            <div className="label">{g.rf}</div>
            {g.itens.map((r) => (
              <div className="foodrow" key={r.id}>
                <div style={{ minWidth: 0 }}>
                  <b>{r.descricao}</b>
                  <div className="small muted">
                    {r.quantidade_g ? `${r0(Number(r.quantidade_g))} g · ` : ""}P {r0(Number(r.prot_g || 0))} · C {r0(Number(r.carb_g || 0))} · G {r0(Number(r.gord_g || 0))}
                    {r.origem === "taco" ? " · TACO" : r.origem !== "manual" && ` · estimado por foto${r.confianca ? ` (${r.confianca})` : ""}`}
                  </div>
                </div>
                <div className="r"><b>{r0(Number(r.kcal || 0))}</b> kcal <button className="x" aria-label="Apagar" onClick={() => apagar(r.id)}>×</button></div>
              </div>
            ))}
          </div>
        ))}
      </section>

      {semana && (
        <section className="card">
          <h2>Semana</h2>
          <div className="tbl">
            <table>
              <thead><tr><th>Dia</th><th>Consumido</th><th>Meta</th><th>Saldo</th></tr></thead>
              <tbody>
                {semana.dias.map((d) => {
                  const c = r0(consumo[d] || 0);
                  const m = d < hoje ? semana.metaBase : semana.metaHoje;
                  return (
                    <tr key={d}>
                      <td>{CURTO_DIA[new Date(d + "T12:00:00Z").getUTCDay()]} {fmtCurta(d)}</td>
                      <td>{c || "–"}</td>
                      <td>{m}</td>
                      <td className={c && c > m ? "down" : c ? "up" : ""}>{c ? m - c : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="note" style={{ margin: 0 }}>
            Meta semanal {(semana.metaBase * 7).toLocaleString("pt-BR")} kcal · consumido {semana.consumidoSemana.toLocaleString("pt-BR")} ·{" "}
            {semana.saldoSemana >= 0 ? `faltam ${semana.saldoSemana.toLocaleString("pt-BR")}` : `passou ${Math.abs(semana.saldoSemana).toLocaleString("pt-BR")}`}.
            Quando um dia passa da meta, o excesso é dividido nos dias restantes, sem cortar mais de {CORTE_MAX * 100}% de nenhum dia.
          </p>
        </section>
      )}

      {meta && <MetaForm ref0={ref} atual={meta} onSaved={carregar} />}
    </main>
  );
}

function NovoRegistro({ dia, onSaved }: { dia: string; onSaved: () => void }) {
  const [modo, setModo] = useState<"busca" | "manual">("busca");
  const [taco, setTaco] = useState<Taco[]>([]);
  const [termo, setTermo] = useState("");
  const [recentes, setRecentes] = useState<Recente[]>([]);
  const [itens, setItens] = useState<ItemEd[] | null>(null);
  const [refeicao, setRefeicao] = useState(refeicaoPorHora(new Date().getHours()));
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  function limpar() {
    setItens(null); setErro(null); setTermo("");
  }

  // TACO carregada uma vez; recentes = últimos alimentos registrados pela busca (com o peso usado)
  useEffect(() => {
    carregarTaco().then(setTaco);
    createClient().from("foods_log").select("descricao, quantidade_g, kcal, prot_g, carb_g, gord_g")
      .eq("origem", "taco").order("data_hora", { ascending: false }).limit(80)
      .then(({ data }) => {
        const vistos = new Set<string>(), out: Recente[] = [];
        for (const r of data || []) {
          const g = Number(r.quantidade_g) || 0;
          if (!g || vistos.has(r.descricao)) continue;
          vistos.add(r.descricao);
          const k = 100 / g;
          out.push({ descricao: r.descricao, quantidade_g: g, base: { kcal: Number(r.kcal) * k, prot: Number(r.prot_g) * k, carb: Number(r.carb_g) * k, gord: Number(r.gord_g) * k } });
          if (out.length >= 8) break;
        }
        setRecentes(out);
      });
  }, []);
  const resultados = useMemo(() => buscar(taco, termo), [taco, termo]);
  const adicionar = (it: ItemEd) => { setItens((l) => [...(l || []), it]); setTermo(""); };

  async function salvar() {
    const lista = (itens ?? []).filter((i) => i.descricao && n(i.kcal) >= 0);
    if (!lista.length) return;
    setBusy(true);
    // Horário: agora, se for hoje; meio-dia, se for outro dia
    const quando = dia === hojeISO() ? new Date().toISOString() : new Date(dia + "T15:00:00Z").toISOString();
    const origem = modo === "busca" ? "taco" : "manual";
    const { error } = await createClient().from("foods_log").insert(lista.map((i) => ({
      data_hora: quando, refeicao, descricao: i.descricao, quantidade_g: n(i.quantidade_g) || null,
      kcal: n(i.kcal), prot_g: n(i.prot_g), carb_g: n(i.carb_g), gord_g: n(i.gord_g),
      origem,
    })));
    setBusy(false);
    if (error) { setErro("Não consegui salvar: " + error.message); return; }
    if (modo === "busca") {
      const novos = lista.filter((i) => i.base).map((i) => ({ descricao: i.descricao, quantidade_g: n(i.quantidade_g), base: i.base! }));
      setRecentes((r) => [...novos, ...r.filter((x) => !novos.some((y) => y.descricao === x.descricao))].slice(0, 8));
    }
    limpar(); onSaved();
  }

  const editar = (k: number, campo: keyof Omit<ItemEd, "base">, v: string) =>
    setItens((l) => l!.map((x, i) => {
      if (i !== k) return x;
      if (campo === "quantidade_g" && x.base) return { ...deBase(x.descricao, n(v), x.base), quantidade_g: v };
      // Editar kcal ou macros na mão desliga o recálculo automático daquele item
      return { ...x, [campo]: v, base: campo === "descricao" ? x.base : undefined };
    }));

  return (
    <section className="card">
      <h2>Adicionar</h2>
      <div className="seg" role="group" aria-label="Como registrar">
        <button aria-pressed={modo === "busca"} onClick={() => { setModo("busca"); limpar(); }}>Buscar<small>TACO</small></button>
        <button aria-pressed={modo === "manual"} onClick={() => { setModo("manual"); limpar(); setItens([vazio()]); }}>Na<small>mão</small></button>
      </div>

      <div className="field">
        <label htmlFor="ref">Refeição</label>
        <select id="ref" value={refeicao} onChange={(e) => setRefeicao(e.target.value)}>{REFEICOES.map((r) => <option key={r}>{r}</option>)}</select>
      </div>

      {modo === "busca" && (
        <>
          <div className="field">
            <label htmlFor="busca">Alimento</label>
            <input id="busca" type="search" autoComplete="off" value={termo} onChange={(e) => setTermo(e.target.value)} placeholder="Ex.: arroz, frango grelhado, banana" />
          </div>
          {termo.trim().length > 1 && (
            <div className="results">
              {resultados.map((t) => (
                <button key={t.id} className="result" onClick={() => adicionar(deBase(t.nome, 100, t))}>
                  <span><b>{t.nome}</b><small>{t.categoria}</small></span>
                  <span className="r">{t.kcal} kcal<small>P {t.prot} · C {t.carb} · G {t.gord}</small></span>
                </button>
              ))}
              {!resultados.length && <p className="note" style={{ margin: 0 }}>Nada na TACO com esse nome. Tente outra palavra ou registre na mão.</p>}
            </div>
          )}
          {!termo && recentes.length > 0 && (
            <>
              <div className="label">Recentes</div>
              <div className="results">
                {recentes.map((r) => (
                  <button key={r.descricao} className="result" onClick={() => adicionar(deBase(r.descricao, r.quantidade_g, r.base))}>
                    <span><b>{r.descricao}</b><small>{r.quantidade_g} g</small></span>
                    <span className="r">{porGramas(r.base, r.quantidade_g).kcal} kcal</span>
                  </button>
                ))}
              </div>
            </>
          )}
          <p className="small muted" style={{ margin: 0 }}>Valores por 100 g da TACO (NEPA/Unicamp, 4ª ed.). Ao escolher, ajuste os gramas e o resto se recalcula.</p>
        </>
      )}

      {itens && (
        <>
          {itens.map((i, k) => (
            <div key={k} className="card" style={{ padding: 12 }}>
              <div className="field"><label>Alimento</label><input value={i.descricao} onChange={(e) => editar(k, "descricao", e.target.value)} /></div>
              <div className="grid3">
                <div className="field"><label>Gramas</label><input inputMode="decimal" value={i.quantidade_g} onChange={(e) => editar(k, "quantidade_g", e.target.value)} /></div>
                <div className="field"><label>Kcal</label><input inputMode="decimal" value={i.kcal} onChange={(e) => editar(k, "kcal", e.target.value)} /></div>
                <div className="field"><label>Prot. g</label><input inputMode="decimal" value={i.prot_g} onChange={(e) => editar(k, "prot_g", e.target.value)} /></div>
                <div className="field"><label>Carbo g</label><input inputMode="decimal" value={i.carb_g} onChange={(e) => editar(k, "carb_g", e.target.value)} /></div>
                <div className="field"><label>Gord. g</label><input inputMode="decimal" value={i.gord_g} onChange={(e) => editar(k, "gord_g", e.target.value)} /></div>
                <div className="field" style={{ justifyContent: "flex-end" }}>
                  {itens.length > 1 && <button className="btn ghost small" onClick={() => setItens(itens.filter((_, x) => x !== k))}>Remover</button>}
                </div>
              </div>
            </div>
          ))}
          <button className="link" onClick={() => setItens([...itens, vazio()])}>+ Adicionar item</button>
          <p className="small" style={{ margin: 0 }}>Total: <b>{r0(itens.reduce((a, i) => a + n(i.kcal), 0))} kcal</b> · P {r0(itens.reduce((a, i) => a + n(i.prot_g), 0))} g</p>
          {erro && <p className="msg err">{erro}</p>}
          <button className="btn" onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
          {modo === "busca" && <button className="link" onClick={limpar}>Limpar lista</button>}
        </>
      )}
    </section>
  );
}

function MetaForm({ ref0, atual, onSaved, aberto }: { ref0: { tmb: number | null; mlg: number | null; peso: number | null }; atual?: Meta; onSaved: () => void; aberto?: boolean }) {
  // Ponto de partida: TMB × 1,55 menos 500 kcal; proteína 2 g por kg de massa livre de gordura
  const sugKcal = ref0.tmb ? Math.round((ref0.tmb * 1.55 - 500) / 50) * 50 : 2400;
  const sugP = ref0.mlg ? Math.round(ref0.mlg * 2) : 180;
  const sugG = ref0.peso ? Math.round(ref0.peso * 0.8) : 80;
  const sugC = Math.max(0, Math.round((sugKcal - sugP * 4 - sugG * 9) / 4));
  const [kcal, setKcal] = useState(String(atual?.kcal_dia ?? sugKcal));
  const [p, setP] = useState(String(atual?.prot_g ?? sugP));
  const [c, setC] = useState(String(atual?.carb_g ?? sugC));
  const [g, setG] = useState(String(atual?.gord_g ?? sugG));

  async function salvar() {
    await createClient().from("nutrition_targets").insert({ vigencia_inicio: hojeISO(), kcal_dia: n(kcal), prot_g: n(p) || null, carb_g: n(c) || null, gord_g: n(g) || null });
    onSaved();
  }

  return (
    <details className="card" open={aberto}>
      <summary><h2>{atual ? "Meta diária" : "Defina a meta diária"}</h2></summary>
      <div className="in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {!atual && (
          <p className="note" style={{ margin: 0 }}>
            Valores pré-preenchidos como ponto de partida{ref0.tmb ? ` (TMB ${ref0.tmb} kcal do último exame)` : ""}. Ajuste com seu nutricionista ou treinador.
          </p>
        )}
        <div className="grid2">
          <div className="field"><label htmlFor="mk">Kcal por dia</label><input id="mk" inputMode="numeric" value={kcal} onChange={(e) => setKcal(e.target.value)} /></div>
          <div className="field"><label htmlFor="mp">Proteína (g)</label><input id="mp" inputMode="numeric" value={p} onChange={(e) => setP(e.target.value)} /></div>
          <div className="field"><label htmlFor="mc">Carboidrato (g)</label><input id="mc" inputMode="numeric" value={c} onChange={(e) => setC(e.target.value)} /></div>
          <div className="field"><label htmlFor="mg">Gordura (g)</label><input id="mg" inputMode="numeric" value={g} onChange={(e) => setG(e.target.value)} /></div>
        </div>
        <p className="small muted" style={{ margin: 0 }}>Meta semanal: {(n(kcal) * 7).toLocaleString("pt-BR")} kcal. A nova meta vale a partir de hoje.</p>
        <button className="btn" onClick={salvar}>Salvar meta</button>
      </div>
    </details>
  );
}
