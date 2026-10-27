"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtCurta, fmtNum, hojeISO } from "@/lib/datas";
import Grafico from "@/components/grafico";

// Pesagens ficam na tabela bioimpedance (só a coluna peso e o IMC calculado pela altura)
type Pesagem = { id: string; data: string; peso: number | null };

export default function Peso() {
  const [pesagens, setPesagens] = useState<Pesagem[]>([]);
  const [perfil, setPerfil] = useState<{ altura_cm: number | null; peso_meta: number | null } | null>(null);
  const [data, setData] = useState(hojeISO());
  const [kg, setKg] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [{ data: b }, { data: p }] = await Promise.all([
      sb.from("bioimpedance").select("id, data, peso").not("peso", "is", null).order("data"),
      sb.from("profiles").select("altura_cm, peso_meta").maybeSingle(),
    ]);
    setPesagens(((b || []) as Pesagem[]).map((x) => ({ ...x, peso: x.peso != null ? Number(x.peso) : null })));
    setPerfil(p ? { altura_cm: p.altura_cm != null ? Number(p.altura_cm) : null, peso_meta: p.peso_meta != null ? Number(p.peso_meta) : null } : null);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const altura = perfil?.altura_cm ? perfil.altura_cm / 100 : null;
  const meta = perfil?.peso_meta ?? null;
  const atual = pesagens[pesagens.length - 1]?.peso ?? null;
  const inicial = pesagens[0]?.peso ?? null;
  const perdeu = inicial != null && atual != null ? inicial - atual : 0;
  // Média de perda por semana desde a primeira pesagem
  const semanas = pesagens.length > 1 ? (new Date(pesagens[pesagens.length - 1].data).getTime() - new Date(pesagens[0].data).getTime()) / (7 * 86400000) : 0;
  const ritmo = semanas >= 1 ? perdeu / semanas : null;

  async function salvar() {
    const p = parseFloat(kg.replace(",", "."));
    if (!p) { setErro("Informe o peso em kg."); return; }
    setErro(null);
    const { error } = await createClient().from("bioimpedance").upsert(
      { data, peso: p, imc: altura ? Math.round((p / (altura * altura)) * 10) / 10 : null },
      { onConflict: "user_id,data" },
    );
    if (error) { setErro(error.message); return; }
    setKg(""); carregar();
  }
  async function apagar(id: string) {
    await createClient().from("bioimpedance").delete().eq("id", id);
    carregar();
  }

  return (
    <main className="wrap">
      <header>
        <h1>Peso</h1>
        <p className="sub">Pese-se de manhã, em jejum, depois do banheiro. Uma vez por semana basta; o que importa é a tendência.</p>
      </header>

      {meta && atual != null && (
        <section className="card">
          <div className="between"><h2>Meta</h2><span className="chip">{fmtNum(meta)} kg</span></div>
          <div className="stats">
            <div className="stat"><b>{fmtNum(atual, 1)}</b><span>Peso atual</span></div>
            <div className="stat"><b>{fmtNum(Math.max(0, atual - meta), 1)}</b><span>Faltam kg</span></div>
            <div className="stat"><b>{fmtNum(Math.max(0, perdeu), 1)}</b><span>Já perdeu kg</span></div>
          </div>
          {inicial != null && inicial > meta && (
            <div className="bar"><i style={{ width: Math.min(100, Math.max(0, (perdeu / (inicial - meta)) * 100)) + "%" }} /></div>
          )}
          <p className="note" style={{ margin: 0 }}>
            {ritmo != null ? `Média de ${fmtNum(ritmo, 1)} kg por semana. ` : ""}
            Ritmo saudável: 0,5 a 1 kg por semana. Se a força cair nos treinos, suba um pouco as calorias.
            {altura ? ` IMC atual ${fmtNum(atual / (altura * altura), 1)}.` : ""}
          </p>
        </section>
      )}

      <section className="card">
        <h2>Registrar peso</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="pd">Data</label><input id="pd" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field"><label htmlFor="pk">Peso (kg)</label><input id="pk" inputMode="decimal" value={kg} onChange={(e) => setKg(e.target.value)} placeholder={atual != null ? String(atual).replace(".", ",") : ""} /></div>
        </div>
        {erro && <p className="msg err">{erro}</p>}
        <button className="btn" onClick={salvar}>Salvar peso</button>
      </section>

      <section className="card">
        <h2>Evolução</h2>
        <Grafico pontos={pesagens.filter((p) => p.peso != null).map((p) => ({ data: p.data, v: p.peso! }))} unidade="kg" casas={1} />
        <div className="hist">
          {[...pesagens].reverse().map((p) => (
            <div key={p.id}>
              <span>{fmtCurta(p.data)}</span>
              <span>{fmtNum(p.peso, 1)} kg <button className="x" aria-label="Apagar" onClick={() => apagar(p.id)}>×</button></span>
            </div>
          ))}
          {!pesagens.length && <p className="note" style={{ margin: 0 }}>Nenhuma pesagem ainda.</p>}
        </div>
      </section>
    </main>
  );
}
