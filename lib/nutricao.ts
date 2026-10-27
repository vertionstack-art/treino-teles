// Meta diária e semanal com redistribuição do excesso
import { diasDaSemana } from "./datas";

// Limite: no máximo 15% abaixo da meta em qualquer dia (sem compensação agressiva)
export const CORTE_MAX = 0.15;

export type Meta = { kcal_dia: number; prot_g: number | null; carb_g: number | null; gord_g: number | null; vigencia_inicio: string };

export type Semana = {
  dias: string[];
  consumoDia: Record<string, number>;
  metaBase: number;
  metaHoje: number;
  reducaoDia: number;
  excesso: number;
  consumidoSemana: number;
  saldoSemana: number; // meta semanal - consumido (positivo = ainda pode comer)
};

export function calcularSemana(hoje: string, metaBase: number, consumoDia: Record<string, number>): Semana {
  const dias = diasDaSemana(hoje);
  const passados = dias.filter((d) => d < hoje);
  // Excesso líquido dos dias que já passaram (dias sem registro não contam)
  const saldoPassado = passados.reduce((acc, d) => (consumoDia[d] ? acc + (consumoDia[d] - metaBase) : acc), 0);
  const excesso = Math.max(0, saldoPassado);
  const restantes = dias.filter((d) => d >= hoje).length;
  const reducaoDia = restantes ? Math.min(excesso / restantes, metaBase * CORTE_MAX) : 0;
  const consumidoSemana = dias.reduce((a, d) => a + (consumoDia[d] || 0), 0);
  return {
    dias, consumoDia, metaBase,
    metaHoje: Math.round(metaBase - reducaoDia),
    reducaoDia: Math.round(reducaoDia),
    excesso: Math.round(excesso),
    consumidoSemana: Math.round(consumidoSemana),
    saldoSemana: Math.round(metaBase * 7 - consumidoSemana),
  };
}

// MET aproximado para estimar calorias: jiu-jitsu (aula de 1h) e esteira por velocidade
export const MET_JIUJITSU = 8;
export function metEsteira(kmh: number, inclinacao: number) {
  // Caminhada até 6,5 km/h; acima disso, trote/corrida. Cada 1% de inclinação soma cerca de 0,5 MET.
  const base = kmh <= 6.5 ? 2 + kmh * 0.45 : kmh * 1.0;
  return Math.round((base + inclinacao * 0.5) * 10) / 10;
}
export function kcalMet(met: number, pesoKg: number, minutos: number) {
  return Math.round(met * pesoKg * (minutos / 60));
}

export const REFEICOES = ["Café da manhã", "Lanche da manhã", "Almoço", "Lanche da tarde", "Jantar", "Ceia", "Pré-treino", "Pós-treino"];

export function refeicaoPorHora(h: number) {
  if (h < 10) return "Café da manhã";
  if (h < 12) return "Lanche da manhã";
  if (h < 15) return "Almoço";
  if (h < 18) return "Lanche da tarde";
  if (h < 22) return "Jantar";
  return "Ceia";
}
