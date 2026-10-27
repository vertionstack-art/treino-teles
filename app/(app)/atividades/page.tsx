"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { addDias, diaSemana, fmtCurta, fmtDuracao, hojeISO } from "@/lib/datas";
import { JIU_HORARIOS } from "@/lib/semana";
import HorariosJiu from "@/components/jiujitsu";

type Sess = { id: string; data: string; tipo: string; nome: string | null; duracao_s: number | null; kcal: number | null; fonte: string; distancia_m: number | null };
const NOME_TIPO: Record<string, string> = { musculacao: "Musculação", esteira: "Esteira", jiujitsu: "Jiu-jitsu", outro: "Outro" };

export default function Page() {
  return <Suspense><Atividades /></Suspense>;
}

function Atividades() {
  const params = useSearchParams();
  const [sessoes, setSessoes] = useState<Sess[]>([]);
  const [peso, setPeso] = useState<number | null>(null);
  const [data, setData] = useState(params.get("data") || hojeISO());

  const carregar = useCallback(async () => {
    const sb = createClient();
    const [{ data: s }, { data: b }] = await Promise.all([
      sb.from("workout_sessions").select("id, data, tipo, nome, duracao_s, kcal, fonte, distancia_m").gte("data", addDias(hojeISO(), -60))
        .order("data", { ascending: false }).order("inicio", { ascending: false }),
      sb.from("bioimpedance").select("peso").order("data", { ascending: false }).limit(1).maybeSingle(),
    ]);
    setSessoes((s || []) as Sess[]);
    setPeso(b?.peso ? Number(b.peso) : null);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  async function apagar(id: string) {
    await createClient().from("workout_sessions").delete().eq("id", id);
    carregar();
  }

  const aulasDoDia = sessoes.filter((s) => s.data === data && s.tipo === "jiujitsu");
  const aulas30 = sessoes.filter((s) => s.tipo === "jiujitsu" && s.data >= addDias(hojeISO(), -29)).length;

  return (
    <main className="wrap">
      <header>
        <h1>Atividades</h1>
        <p className="sub">Presença no jiu-jitsu e histórico de tudo que você registrou.</p>
      </header>

      <section className="card">
        <div className="between">
          <h2>Jiu-jitsu</h2>
          <span className="chip">{aulas30} {aulas30 === 1 ? "aula" : "aulas"} em 30 dias</span>
        </div>
        <p className="note" style={{ margin: 0 }}>Seg e qua: 10h, 19h e 21h. Sex: 10h e 20h30. Toque nas aulas que você foi; toque de novo para desmarcar.</p>
        <div className="field"><label htmlFor="jd">Data</label><input id="jd" type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
        {JIU_HORARIOS[diaSemana(data)] ? (
          <HorariosJiu data={data} aulas={aulasDoDia} peso={peso} onChange={carregar} />
        ) : <p className="note" style={{ margin: 0 }}>Sem aula de jiu-jitsu em {fmtCurta(data)}. Escolha uma segunda, quarta ou sexta.</p>}
        {!peso && <p className="small muted" style={{ margin: 0 }}>Registre seu peso em Mais → Peso para estimar as calorias das aulas.</p>}
      </section>

      <section className="card">
        <h2>Últimos 60 dias</h2>
        <div className="hist">
          {sessoes.map((s) => (
            <div key={s.id}>
              <span>{fmtCurta(s.data)} · {s.tipo === "jiujitsu" && s.nome ? s.nome : NOME_TIPO[s.tipo] || s.tipo}</span>
              <span>
                {fmtDuracao(s.duracao_s)}{s.distancia_m ? ` · ${(s.distancia_m / 1000).toFixed(1)} km` : ""}{s.kcal ? ` · ${s.kcal} kcal` : ""}
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
