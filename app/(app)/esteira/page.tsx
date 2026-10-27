"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { addDias, diasDaSemana, fmtCurta, fmtDuracao, hojeISO } from "@/lib/datas";
import { kcalMet, metEsteira } from "@/lib/nutricao";

type Sess = { id: string; data: string; duracao_s: number | null; distancia_m: number | null; kcal: number | null; nome: string | null };

const n = (v: string) => parseFloat(v.replace(",", ".")) || 0;
const virgula = (v: number | string) => String(v).replace(".", ",");

export default function Esteira() {
  const hoje = hojeISO();
  const [sessoes, setSessoes] = useState<Sess[]>([]);
  const [peso, setPeso] = useState<number | null>(null);
  const [data, setData] = useState(hoje);
  const [min, setMin] = useState("30");
  const [vel, setVel] = useState("6");
  const [inc, setInc] = useState("8");
  const [kcalPainel, setKcalPainel] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [{ data: s }, { data: b }] = await Promise.all([
      sb.from("workout_sessions").select("id, data, duracao_s, distancia_m, kcal, nome").eq("tipo", "esteira").gte("data", addDias(hoje, -90)).order("data", { ascending: false }),
      sb.from("bioimpedance").select("peso").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSessoes((s || []) as Sess[]);
    setPeso(b?.peso ? Number(b.peso) : null);
  }, [hoje]);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const met = metEsteira(n(vel), n(inc));
  const estimado = peso && n(min) ? kcalMet(met, peso, n(min)) : null;
  const km = Math.round(n(vel) * (n(min) / 60) * 10) / 10;

  async function salvar() {
    if (!n(min)) return;
    await createClient().from("workout_sessions").insert({
      data, tipo: "esteira", fonte: "manual", duracao_s: Math.round(n(min) * 60), distancia_m: km ? km * 1000 : null,
      kcal: n(kcalPainel) ? Math.round(n(kcalPainel)) : estimado,
      nome: `Esteira · ${virgula(vel)} km/h · ${virgula(inc)}%`,
    });
    setKcalPainel(""); setMsg("Cardio registrado.");
    carregar();
  }
  async function apagar(id: string) {
    await createClient().from("workout_sessions").delete().eq("id", id);
    carregar();
  }

  const semana = diasDaSemana(hoje);
  const daSemana = sessoes.filter((s) => s.data >= semana[0] && s.data <= semana[6]);
  const minSemana = Math.round(daSemana.reduce((a, s) => a + (s.duracao_s || 0), 0) / 60);
  const kcalSemana = daSemana.reduce((a, s) => a + (s.kcal || 0), 0);

  return (
    <main className="wrap">
      <header>
        <h1>Esteira</h1>
        <p className="sub">Cardio depois da musculação, na terça e na quinta. Ajuda a emagrecer sem tirar força.</p>
      </header>
      {msg && <p className="msg ok">{msg}</p>}

      <section className="card">
        <h2>Esta semana</h2>
        <div className="stats">
          <div className="stat"><b>{daSemana.length}</b><span>Sessões</span></div>
          <div className="stat"><b>{minSemana}</b><span>Minutos</span></div>
          <div className="stat"><b>{kcalSemana || "–"}</b><span>Kcal</span></div>
        </div>
        <p className="note" style={{ margin: 0 }}>Sugestão: 25–35 min de caminhada inclinada (5,5–6,5 km/h, 6–12%) ou trote leve. Ritmo em que dá para falar frases curtas.</p>
      </section>

      <section className="card">
        <h2>Registrar cardio</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="ed">Data</label><input id="ed" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field"><label htmlFor="em">Minutos</label><input id="em" inputMode="decimal" value={min} onChange={(e) => setMin(e.target.value)} /></div>
          <div className="field"><label htmlFor="ev">Velocidade (km/h)</label><input id="ev" inputMode="decimal" value={vel} onChange={(e) => setVel(e.target.value)} /></div>
          <div className="field"><label htmlFor="ei">Inclinação (%)</label><input id="ei" inputMode="decimal" value={inc} onChange={(e) => setInc(e.target.value)} /></div>
        </div>
        <div className="field">
          <label htmlFor="ek">Kcal do painel (opcional)</label>
          <input id="ek" inputMode="numeric" value={kcalPainel} onChange={(e) => setKcalPainel(e.target.value)} placeholder={estimado ? `≈ ${estimado} estimado` : ""} />
        </div>
        <p className="note" style={{ margin: 0 }}>
          {km ? `≈ ${virgula(km)} km. ` : ""}
          {estimado ? `≈ ${estimado} kcal (MET ${virgula(met)} × ${peso} kg × ${min} min). Se preencher o painel, vale o painel.` : "Registre seu peso em Mais → Peso para estimar as calorias."}
        </p>
        <button className="btn" onClick={salvar}>Salvar cardio</button>
      </section>

      <section className="card">
        <h2>Recentes</h2>
        {sessoes.length ? (
          <div className="hist">
            {sessoes.slice(0, 20).map((s) => (
              <div key={s.id}>
                <span>{fmtCurta(s.data)} · {fmtDuracao(s.duracao_s)}{s.distancia_m ? ` · ${(s.distancia_m / 1000).toFixed(1)} km` : ""}</span>
                <span>
                  {s.kcal ? `${s.kcal} kcal` : "–"}
                  <button className="x" aria-label="Apagar" onClick={() => apagar(s.id)}>×</button>
                </span>
              </div>
            ))}
          </div>
        ) : <p className="note" style={{ margin: 0 }}>Nenhum cardio ainda.</p>}
      </section>
    </main>
  );
}
