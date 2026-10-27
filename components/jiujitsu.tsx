"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { diaSemana } from "@/lib/datas";
import { JIU_HORARIOS, JIU_USUAL } from "@/lib/semana";
import { MET_JIUJITSU, kcalMet } from "@/lib/nutricao";

export type AulaJiu = { id: string; nome: string | null };
const nomeAula = (h: string) => `Jiu-jitsu ${h}`;
const inicioAula = (data: string, h: string) => {
  const [hh, mm] = h.replace("h", ":").split(":");
  return `${data}T${hh.padStart(2, "0")}:${(mm || "00").padEnd(2, "0")}:00-03:00`;
};

// Botões com os horários do dia: tocar marca ou desmarca a presença naquela aula
export default function HorariosJiu({ data, aulas, peso, onChange }: { data: string; aulas: AulaJiu[]; peso?: number | null; onChange: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const horarios = JIU_HORARIOS[diaSemana(data)] || [];
  if (!horarios.length) return <p className="note" style={{ margin: 0 }}>Sem aula de jiu-jitsu neste dia.</p>;

  async function alternar(h: string) {
    setBusy(h);
    const sb = createClient();
    const feita = aulas.find((a) => a.nome === nomeAula(h));
    if (feita) await sb.from("workout_sessions").delete().eq("id", feita.id);
    else await sb.from("workout_sessions").insert({
      data, tipo: "jiujitsu", fonte: "manual", nome: nomeAula(h), inicio: inicioAula(data, h), duracao_s: 3600,
      kcal: peso ? kcalMet(MET_JIUJITSU, peso, 60) : null,
    });
    setBusy(null);
    onChange();
  }

  return (
    <div className="seg" role="group" aria-label="Aulas de jiu-jitsu">
      {horarios.map((h) => {
        const foi = aulas.some((a) => a.nome === nomeAula(h));
        return (
          <button key={h} aria-pressed={foi} disabled={busy === h} onClick={() => alternar(h)}>
            {foi ? "✓ " : ""}{h}<small>{foi ? "fui" : JIU_USUAL.includes(h) ? "de costume" : "marcar"}</small>
          </button>
        );
      })}
    </div>
  );
}
