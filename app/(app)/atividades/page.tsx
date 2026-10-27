"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDias, fmtCurta, fmtDuracao, hojeISO } from "@/lib/datas";
import { MET_MUAYTHAI, kcalMet } from "@/lib/nutricao";

type Sess = { id: string; data: string; tipo: string; nome: string | null; duracao_s: number | null; kcal: number | null; intensidade: string | null; fonte: string; fc_media: number | null; distancia_m: number | null };
const NOME_TIPO: Record<string, string> = { musculacao: "Musculação", corrida: "Corrida", pilates: "Pilates", muaythai: "Muay thai", outro: "Outro" };

export default function Page() {
  return <Suspense><Atividades /></Suspense>;
}

function Atividades() {
  const params = useSearchParams();
  const [sessoes, setSessoes] = useState<Sess[]>([]);
  const [peso, setPeso] = useState<number | null>(null);
  const [data, setData] = useState(params.get("data") || hojeISO());
  const [min, setMin] = useState("60");
  const [int, setInt] = useState<"leve" | "moderada" | "forte">("moderada");
  const [msg, setMsg] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [{ data: s }, { data: b }] = await Promise.all([
      sb.from("workout_sessions").select("id, data, tipo, nome, duracao_s, kcal, intensidade, fonte, fc_media, distancia_m").gte("data", addDias(hojeISO(), -60)).order("data", { ascending: false }),
      sb.from("bioimpedance").select("peso").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSessoes((s || []) as Sess[]);
    setPeso(b?.peso ? Number(b.peso) : null);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  const kcal = peso ? kcalMet(MET_MUAYTHAI[int], peso, Number(min) || 0) : null;

  async function salvarMuay() {
    const m = Number(min) || 0;
    if (!m) return;
    await createClient().from("workout_sessions").insert({
      data, tipo: "muaythai", fonte: "manual", nome: `Muay thai (${int})`, duracao_s: m * 60, intensidade: int, kcal,
    });
    setMsg("Muay thai registrado.");
    carregar();
  }
  async function salvarPilates() {
    await createClient().from("workout_sessions").insert({ data, tipo: "pilates", fonte: "manual", nome: "Pilates (presença)", duracao_s: 3000 });
    setMsg("Presença no pilates registrada.");
    carregar();
  }
  async function apagar(id: string) {
    await createClient().from("workout_sessions").delete().eq("id", id);
    carregar();
  }

  return (
    <main className="wrap">
      <header>
        <h1>Atividades</h1>
        <p className="sub">Muay thai (sem relógio, registro na mão) e presença no pilates.</p>
      </header>
      {msg && <p className="msg ok">{msg}</p>}

      <section className="card">
        <h2>Muay thai</h2>
        <div className="grid2">
          <div className="field"><label htmlFor="md">Data</label><input id="md" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          <div className="field"><label htmlFor="mm">Minutos</label><input id="mm" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value)} /></div>
        </div>
        <div className="seg" role="group" aria-label="Intensidade">
          {(["leve", "moderada", "forte"] as const).map((i) => <button key={i} aria-pressed={int === i} onClick={() => setInt(i)} style={{ textTransform: "capitalize" }}>{i}</button>)}
        </div>
        <p className="note" style={{ margin: 0 }}>
          {kcal != null ? `≈ ${kcal} kcal (MET ${MET_MUAYTHAI[int]} × ${peso} kg do último exame × ${min} min).` : "Cadastre um exame em Corpo para estimar as calorias."}
        </p>
        <button className="btn" onClick={salvarMuay}>Registrar muay thai</button>
      </section>

      <section className="card">
        <h2>Pilates</h2>
        <p className="note" style={{ margin: 0 }}>Voll Pilates Vila Isabel, via Wellhub. A reserva abre 2 dias antes, a partir das 7h.</p>
        <button className="btn ghost" onClick={salvarPilates}>Registrar presença em {fmtCurta(data)}</button>
      </section>

      <section className="card">
        <h2>Últimos 60 dias</h2>
        <div className="hist">
          {sessoes.map((s) => (
            <div key={s.id}>
              <span>{fmtCurta(s.data)} · {NOME_TIPO[s.tipo] || s.tipo}</span>
              <span>
                {fmtDuracao(s.duracao_s)}{s.distancia_m ? ` · ${(s.distancia_m / 1000).toFixed(1)} km` : ""}{s.kcal ? ` · ${s.kcal} kcal` : ""}{s.fc_media ? ` · FC ${s.fc_media}` : ""}
                {s.fonte === "manual" && <button className="x" aria-label="Apagar" onClick={() => apagar(s.id)}>×</button>}
              </span>
            </div>
          ))}
          {!sessoes.length && <p className="note" style={{ margin: 0 }}>Nada registrado ainda.</p>}
        </div>
      </section>
    </main>
  );
}
