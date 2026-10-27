"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hojeISO } from "@/lib/datas";
import type { Meta } from "@/lib/nutricao";
import { ALIMENTOS, NOME_OPCAO, OPCOES, SIMPLES, gerarDieta, type Escolhas, type Refeicao } from "@/lib/dieta";

const r0 = (x: number) => Math.round(x);
const nomeOpcao = (id: string) => NOME_OPCAO[id] || ALIMENTOS[id]?.nome || id;

export default function Dieta() {
  const [meta, setMeta] = useState<Meta | null>(null);
  const [esc, setEsc] = useState<Escolhas>(SIMPLES);
  const [carregado, setCarregado] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [mt, pf] = await Promise.all([
      sb.from("nutrition_targets").select("*").lte("vigencia_inicio", hojeISO()).order("vigencia_inicio", { ascending: false }).limit(1).maybeSingle(),
      sb.from("profiles").select("dieta").maybeSingle(),
    ]);
    setMeta(mt.data as Meta | null);
    const salvas = pf.data?.dieta as Partial<Escolhas> | null | undefined;
    if (salvas) setEsc({ ...SIMPLES, ...salvas });
    setCarregado(true);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const dieta = useMemo(() => (meta ? gerarDieta(meta, esc) : null), [meta, esc]);

  async function escolher(k: keyof Escolhas, v: string) {
    const nova = { ...esc, [k]: v };
    setEsc(nova); setMsg(null);
    const sb = createClient();
    const user = (await sb.auth.getSession()).data.session?.user;
    if (user) await sb.from("profiles").update({ dieta: nova }).eq("id", user.id);
  }
  async function simples() {
    setEsc(SIMPLES); setMsg(null);
    const sb = createClient();
    const user = (await sb.auth.getSession()).data.session?.user;
    if (user) await sb.from("profiles").update({ dieta: SIMPLES }).eq("id", user.id);
  }

  async function registrar(r: Refeicao) {
    const { error } = await createClient().from("foods_log").insert(r.itens.map((i) => ({
      data_hora: new Date().toISOString(), refeicao: r.nome, descricao: i.alimento.nome, quantidade_g: i.g,
      kcal: r0(i.kcal), prot_g: Math.round(i.prot * 10) / 10, carb_g: Math.round(i.carb * 10) / 10, gord_g: Math.round(i.gord * 10) / 10, origem: "taco",
    })));
    setMsg(error ? "Não consegui registrar: " + error.message : `${r.nome} registrado no diário de hoje.`);
  }

  const opcao = (k: keyof Escolhas, lista: readonly string[], rotulo: string) => (
    <div className="field" key={k}>
      <label htmlFor={"o" + k}>{rotulo}</label>
      <select id={"o" + k} value={esc[k]} onChange={(e) => escolher(k, e.target.value)}>
        {lista.map((o) => <option key={o} value={o}>{nomeOpcao(o)}</option>)}
      </select>
    </div>
  );

  return (
    <main className="wrap">
      <header>
        <h1>Minha dieta</h1>
        <p className="sub">Cardápio do dia em gramas, montado para bater a sua meta. Pese tudo já pronto (cozido ou grelhado).</p>
      </header>
      <Link className="link" href="/nutricao">‹ Voltar para Nutrição</Link>

      {carregado && !meta && (
        <section className="card">
          <p className="note" style={{ margin: 0 }}>Defina primeiro a meta de calorias e macros em Nutrição. A dieta é calculada a partir dela.</p>
          <Link className="btn" href="/nutricao">Definir meta</Link>
        </section>
      )}

      {meta && (
        <details className="card" open={!dieta}>
          <summary><h2>Alimentos</h2></summary>
          <div className="in" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <button className="btn ghost small" onClick={simples}>Dieta simples: arroz, feijão, frango e salada</button>
            <div className="grid2">
              {opcao("carbo", OPCOES.carbo, "Carboidrato do prato")}
              {opcao("feijao", OPCOES.feijao, "Feijão")}
              {opcao("proteina", OPCOES.proteina, "Proteína do almoço")}
              {opcao("proteinaJantar", OPCOES.proteina, "Proteína do jantar")}
              {opcao("salada", OPCOES.salada, "Salada")}
              {opcao("cafe", OPCOES.cafe, "Café da manhã")}
              {opcao("lanche", OPCOES.lanche, "Lanche da tarde")}
            </div>
          </div>
        </details>
      )}

      {msg && <p className="msg ok">{msg}</p>}

      {meta && dieta && (
        <>
          <section className="card">
            <div className="between"><h2>Total do dia</h2><span className="chip">Meta {meta.kcal_dia} kcal</span></div>
            <div className="grid3 small">
              <span>Kcal<br /><b>{r0(dieta.total.kcal)}</b> / {meta.kcal_dia}</span>
              <span>Proteína<br /><b>{r0(dieta.total.prot)}</b>{meta.prot_g ? ` / ${meta.prot_g} g` : " g"}</span>
              <span>Carbo<br /><b>{r0(dieta.total.carb)}</b>{meta.carb_g ? ` / ${meta.carb_g} g` : " g"}</span>
            </div>
            <p className="small muted" style={{ margin: 0 }}>Gordura {r0(dieta.total.gord)}{meta.gord_g ? ` / ${meta.gord_g}` : ""} g. Os valores fecham perto da meta porque tudo é arredondado para 5 g ou unidades inteiras.</p>
          </section>

          {dieta.refeicoes.map((r) => (
            <section className="card" key={r.nome}>
              <div className="between"><h2>{r.nome}</h2><span className="chip">{r0(r.total.kcal)} kcal</span></div>
              {r.itens.map((i) => (
                <div className="foodrow" key={i.alimento.id}>
                  <div style={{ minWidth: 0 }}>
                    <b>{i.alimento.nome}</b>
                    <div className="small muted">P {r0(i.prot)} · C {r0(i.carb)} · G {r0(i.gord)} · {r0(i.kcal)} kcal</div>
                  </div>
                  <div className="r"><b>{i.texto}</b></div>
                </div>
              ))}
              <p className="small muted" style={{ margin: 0 }}>Refeição: P {r0(r.total.prot)} g · C {r0(r.total.carb)} g · G {r0(r.total.gord)} g</p>
              <button className="btn ghost small" onClick={() => registrar(r)}>Comi esta refeição</button>
            </section>
          ))}

          <p className="note">Ponto de partida calculado com a tabela TACO, não substitui um nutricionista. Se a fome ou o cansaço apertarem, ou a força cair nos treinos, ajuste a meta em Nutrição e a dieta se refaz sozinha.</p>
        </>
      )}
    </main>
  );
}
