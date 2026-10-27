// Semana padrão do Lucas e catálogo de atividades para ajustar um dia.
import { diaSemana } from "./datas";

export type TipoAtividade = "musculacao" | "jiujitsu" | "esteira" | "descanso";
export type Atividade = { id: string; tipo: TipoAtividade; nome: string; obs?: string };

export const CATALOGO: Record<string, Atividade> = {
  musculacao: { id: "musculacao", tipo: "musculacao", nome: "Musculação", obs: "Próximo treino da fila" },
  jiujitsu: { id: "jiujitsu", tipo: "jiujitsu", nome: "Jiu-jitsu", obs: "Marque as aulas que você foi" },
  esteira: { id: "esteira", tipo: "esteira", nome: "Cardio na esteira", obs: "Depois da musculação" },
  descanso: { id: "descanso", tipo: "descanso", nome: "Descanso" },
};

// Índice = getDay() (0 = domingo)
export const PADRAO: string[][] = [
  ["descanso"],
  ["musculacao", "jiujitsu"],
  ["musculacao", "esteira"],
  ["musculacao", "jiujitsu"],
  ["musculacao", "esteira"],
  ["musculacao", "jiujitsu"],
  ["descanso"],
];

// Horários das aulas de jiu-jitsu por dia da semana (getDay()). Os mais frequentes vêm marcados como "usual".
export const JIU_HORARIOS: Record<number, string[]> = {
  1: ["10h", "19h", "21h"],
  3: ["10h", "19h", "21h"],
  5: ["10h", "20h30"],
};
export const JIU_USUAL = ["19h", "20h30"];

export const NOMES_DIA = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
export const CURTO_DIA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export function atividadesDoDia(iso: string, ajuste?: string[] | null): Atividade[] {
  const ids = ajuste && ajuste.length ? ajuste : PADRAO[diaSemana(iso)];
  return ids.map((id) => CATALOGO[id]).filter(Boolean);
}
