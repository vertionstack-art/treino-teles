// Programa ABCDE do Lucas: A peito, B costas, C bíceps e tríceps, D perna, E ombro.
// Fila contínua A → B → C → D → E. Treino perdido não sai da fila.
// Objetivo: emagrecer, ganhar massa e força. O primeiro exercício de cada treino é o de força (faixa menor, descanso maior).
// Linha: [nome, séries, descanso, dica, (grupo | "opt" | {músculo: séries})...]
type Musc = Partial<Record<"q" | "p" | "c" | "pe" | "o" | "bi" | "tri", number>>;
type Linha = [string, string, string, string, ...(string | Musc)[]];
export type Dia = "A" | "B" | "C" | "D" | "E";
export type Tempo = "80" | "50" | "50s";

export const ORDEM: Dia[] = ["A", "B", "C", "D", "E"];

// Versões completas. As de 50 min são derivadas abaixo.
const BASE: Record<Dia, Linha[]> = {
  A: [["Aquecimento", "5 min esteira", "", "Mais 2 × 15 rotação externa com elástico"],
    ["Supino reto com barra", "4 × 6–8", "120s", "Exercício de força: carga alta, técnica limpa", { pe: 4 }],
    ["Supino inclinado com halteres", "4 × 8–10", "90s", "", { pe: 4 }],
    ["Supino declinado ou paralelas", "3 × 8–10", "75s", "", { pe: 3 }],
    ["Crucifixo na máquina (peck deck)", "3 × 12", "60s", "", { pe: 3 }],
    ["Crossover na polia", "3 × 12–15", "60s", "Aperte no fim do movimento", { pe: 3 }],
    ["Abdominal na polia (crunch)", "3 × 15", "45s", "", "opt"]],
  B: [["Aquecimento", "5 min esteira", "", "Mais 2 × 15 pull-apart com elástico"],
    ["Remada curvada com barra", "4 × 6–8", "120s", "Exercício de força: coluna neutra", { c: 4 }],
    ["Puxada frontal aberta", "4 × 8–10", "90s", "", { c: 4 }],
    ["Remada baixa com triângulo", "3 × 10", "75s", "", { c: 3 }],
    ["Remada unilateral com halter", "3 × 10 cada lado", "60s", "", { c: 3 }],
    ["Pulldown com braço estendido", "3 × 12", "60s", "", { c: 3 }],
    ["Prancha", "3 × 40s", "45s", "", "opt"]],
  C: [["Aquecimento", "5 min esteira", "", "Mobilidade de cotovelo e punho"],
    ["Rosca direta com barra", "4 × 6–8", "90s", "Exercício de força: sem roubar com o tronco", { bi: 4 }],
    ["Tríceps testa com barra W", "4 × 6–8", "90s", "Exercício de força", { tri: 4 }],
    ["Rosca alternada com halteres", "3 × 10", "60s", "", { bi: 3 }],
    ["Tríceps corda no pulley", "3 × 12", "60s", "", { tri: 3 }],
    ["Rosca martelo", "3 × 12", "60s", "", { bi: 3 }],
    ["Tríceps francês com halter", "3 × 12", "60s", "", { tri: 3 }]],
  D: [["Aquecimento", "5 min bike + mobilidade de quadril", "", "Bike poupa mais o joelho que a esteira"],
    ["Agachamento livre", "4 × 6–8", "150s", "Exercício de força: desça até a coxa paralela", { q: 4 }],
    ["Leg press", "4 × 10", "90s", "", { q: 4 }],
    ["Stiff com barra", "3 × 8–10", "90s", "", { p: 3 }],
    ["Cadeira extensora", "3 × 12", "60s", "", { q: 3 }],
    ["Mesa flexora", "3 × 12", "60s", "", { p: 3 }],
    ["Panturrilha em pé", "4 × 15", "45s", ""]],
  E: [["Aquecimento", "5 min esteira", "", "Mais 2 × 15 rotação externa com elástico"],
    ["Desenvolvimento com barra ou halteres", "4 × 6–8", "120s", "Exercício de força", { o: 4 }],
    ["Elevação lateral com halteres", "4 × 12–15", "60s", "", { o: 4 }],
    ["Elevação frontal com halteres", "3 × 12", "60s", "", { o: 3 }],
    ["Crucifixo inverso (peck deck)", "3 × 15", "45s", "Ombro posterior, ajuda na postura e no jiu-jitsu", { o: 3 }],
    ["Encolhimento com halteres", "3 × 12", "60s", ""],
    ["Face pull na polia", "3 × 15", "45s", "", "opt"]],
};

const ehAquec = (l: Linha) => !/×/.test(l[1]);
const extras = (l: Linha) => l.slice(4) as (string | Musc)[];
const musc = (l: Linha) => extras(l).find((e) => typeof e === "object") as Musc | undefined;
const opt = (l: Linha) => extras(l).includes("opt");
const capSeries = (l: Linha, max: number): Linha => {
  const m = /^(\d+)\s*×(.*)$/.exec(l[1]);
  if (!m || +m[1] <= max) return l;
  const mu = musc(l);
  const novo = mu ? (Object.fromEntries(Object.entries(mu).map(([k, v]) => [k, Math.min(v!, max)])) as Musc) : undefined;
  return [l[0], `${max} ×${m[2]}`, l[2], l[3], ...extras(l).map((e) => (typeof e === "object" ? novo! : e))];
};
const aquec3 = (l: Linha): Linha => [l[0], l[1].replace(/^5 min/, "3 min"), "", l[3]];

// 50 min simples: um exercício por vez, só os principais, no máximo 3 séries
function simples(b: Linha[]): Linha[] {
  const [aq, ...resto] = b;
  return [aquec3(aq), ...resto.filter((l) => !opt(l)).slice(0, 6).map((l) => capSeries(l, 3))];
}

// 50 min conjugado: exercícios em pares (A1/A2, B1/B2...), o último bloco vira trio se sobrar um
function conjugado(b: Linha[]): Linha[] {
  const [aq, ...resto] = b;
  const ex = resto.filter((l) => !opt(l) && !ehAquec(l));
  const grupos: Linha[][] = [];
  for (let i = 0; i < ex.length; i += 2) grupos.push(ex.slice(i, i + 2));
  if (grupos.length > 1 && grupos[grupos.length - 1].length === 1) grupos[grupos.length - 2].push(grupos.pop()![0]);
  const out: Linha[] = [aquec3(aq)];
  grupos.forEach((g, gi) => {
    const L = String.fromCharCode(65 + gi);
    g.forEach((l, k) => {
      const ultimo = k === g.length - 1;
      const rest = ultimo ? (g.length > 2 ? "45s após o trio" : "60s após o par") : "";
      const mu = musc(l);
      out.push([l[0], l[1], rest, l[3], `${L}${k + 1}`, ...(mu ? [mu] : [])]);
    });
  });
  return out;
}

export const W: Record<Tempo, Record<Dia, Linha[]>> = {
  "80": BASE,
  "50": Object.fromEntries(ORDEM.map((d) => [d, conjugado(BASE[d])])) as Record<Dia, Linha[]>,
  "50s": Object.fromEntries(ORDEM.map((d) => [d, simples(BASE[d])])) as Record<Dia, Linha[]>,
};

export const DURNAME: Record<Tempo, string> = { "80": "Completo", "50": "50 min conjugado", "50s": "50 min simples" };
export const DAYNAME: Record<Dia, string> = { A: "A · Peito", B: "B · Costas", C: "C · Bíceps e tríceps", D: "D · Perna", E: "E · Ombro" };
export const DAYSHORT: Record<string, string> = { A: "A", B: "B", C: "C", D: "D", E: "E" };
export const DAYSUB: Record<Dia, string> = { A: "peito", B: "costas", C: "braço", D: "perna", E: "ombro" };
export const MUS: [keyof Musc, string][] = [
  ["pe", "Peito"], ["c", "Costas"], ["bi", "Bíceps"], ["tri", "Tríceps"], ["q", "Quadríceps"], ["p", "Posterior de coxa"], ["o", "Ombro"],
];

// Próximo da fila a partir do último treino feito
export function proximoDaFila(ultimo: string | null | undefined): Dia {
  const i = ORDEM.indexOf(ultimo as Dia);
  return i < 0 ? "A" : ORDEM[(i + 1) % ORDEM.length];
}

export type Item = {
  name: string; sx: string; rest: string; tip: string; group: string | null; opt: boolean;
  mus: Musc | null; sets: number; restS: number; target: string;
};

export function parse(row: Linha): Item {
  const [name, sx, rest, tip, ...extra] = row;
  let group: string | null = null, op = false, mus: Musc | null = null;
  for (const e of extra) {
    if (e === "opt") op = true;
    else if (typeof e === "string") group = e;
    else if (e && typeof e === "object") mus = e;
  }
  return { name, sx, rest, tip, group, opt: op, mus, sets: setsOf(sx), restS: parseInt(rest) || 0, target: targetOf(sx) };
}
function setsOf(sx: string) { const m = /^(\d+)\s*×/.exec(sx); return m ? +m[1] : 0; }
function targetOf(sx: string) { const p = sx.split("×")[1] || ""; const m = /\d+(?:[–-]\d+)?/.exec(p); return m ? m[0] : "máx"; }
export function defReps(t: string) { const m = /(\d+)$/.exec(t); return m ? m[1] : ""; }
export function ytUrl(name: string) {
  const q = name.replace(/\s*\(.*?\)\s*/g, " ").trim() + " execução correta shorts";
  return "https://www.youtube.com/results?search_query=" + encodeURIComponent(q);
}
export function itens(t: Tempo, d: Dia): Item[] {
  return W[t][d].map(parse);
}
