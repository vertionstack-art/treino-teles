// Gerador de dieta em gramas a partir da meta diária (kcal e macros) e dos alimentos escolhidos.
// Valores por 100 g da TACO (4ª ed.). Pesos sempre do alimento pronto (cozido/grelhado), como vai para a balança.
import type { Meta } from "./nutricao";

type Macro = { kcal: number; prot: number; carb: number; gord: number };
export type Alimento = Macro & { id: string; nome: string; unidade?: { g: number; nome: string; plural: string } };

export const ALIMENTOS: Record<string, Alimento> = {
  arroz: { id: "arroz", nome: "Arroz branco cozido", kcal: 128, prot: 2.5, carb: 28.1, gord: 0.2 },
  arroz_integral: { id: "arroz_integral", nome: "Arroz integral cozido", kcal: 124, prot: 2.6, carb: 25.8, gord: 1 },
  batata_doce: { id: "batata_doce", nome: "Batata-doce cozida", kcal: 77, prot: 0.6, carb: 18.4, gord: 0.1 },
  mandioca: { id: "mandioca", nome: "Mandioca cozida", kcal: 125, prot: 0.6, carb: 30.1, gord: 0.3 },
  cuscuz: { id: "cuscuz", nome: "Cuscuz de milho cozido", kcal: 113, prot: 2.2, carb: 25.3, gord: 0.7 },
  feijao: { id: "feijao", nome: "Feijão carioca cozido", kcal: 76, prot: 4.8, carb: 13.6, gord: 0.5 },
  feijao_preto: { id: "feijao_preto", nome: "Feijão preto cozido", kcal: 77, prot: 4.5, carb: 14, gord: 0.5 },
  frango: { id: "frango", nome: "Peito de frango grelhado", kcal: 159, prot: 32, carb: 0, gord: 2.5 },
  patinho: { id: "patinho", nome: "Patinho grelhado", kcal: 219, prot: 35.9, carb: 0, gord: 7.3 },
  peixe: { id: "peixe", nome: "Filé de merluza assado", kcal: 122, prot: 26.6, carb: 0, gord: 0.9 },
  ovo: { id: "ovo", nome: "Ovo cozido", kcal: 146, prot: 13.3, carb: 0.6, gord: 9.5, unidade: { g: 50, nome: "ovo", plural: "ovos" } },
  pao: { id: "pao", nome: "Pão francês", kcal: 300, prot: 8, carb: 58.6, gord: 3.1, unidade: { g: 50, nome: "pão", plural: "pães" } },
  banana: { id: "banana", nome: "Banana prata", kcal: 98, prot: 1.3, carb: 26, gord: 0.1 },
  mamao: { id: "mamao", nome: "Mamão formosa", kcal: 45, prot: 0.8, carb: 11.6, gord: 0.1 },
  aveia: { id: "aveia", nome: "Aveia em flocos", kcal: 394, prot: 13.9, carb: 66.6, gord: 8.5 },
  iogurte: { id: "iogurte", nome: "Iogurte natural desnatado", kcal: 41, prot: 3.8, carb: 5.8, gord: 0.3 },
  alface: { id: "alface", nome: "Alface", kcal: 11, prot: 1.3, carb: 1.7, gord: 0.2 },
  tomate: { id: "tomate", nome: "Tomate", kcal: 15, prot: 1.1, carb: 3.1, gord: 0.2 },
  brocolis: { id: "brocolis", nome: "Brócolis cozido", kcal: 25, prot: 2.1, carb: 4.4, gord: 0.5 },
  azeite: { id: "azeite", nome: "Azeite de oliva", kcal: 884, prot: 0, carb: 0, gord: 100 },
};

// Opções que a pessoa escolhe. A primeira de cada lista é a da dieta simples.
export const OPCOES = {
  carbo: ["arroz", "arroz_integral", "batata_doce", "mandioca", "cuscuz"],
  feijao: ["feijao", "feijao_preto", "sem"],
  proteina: ["frango", "patinho", "peixe"],
  salada: ["alface_tomate", "brocolis"],
  cafe: ["pao_ovo", "iogurte_aveia", "cuscuz_ovo"],
  lanche: ["iogurte_aveia", "pao_ovo", "fruta_ovo"],
} as const;
export const NOME_OPCAO: Record<string, string> = {
  sem: "Sem feijão", alface_tomate: "Alface e tomate", brocolis: "Brócolis",
  pao_ovo: "Pão, ovos e fruta", iogurte_aveia: "Iogurte, aveia e fruta", cuscuz_ovo: "Cuscuz e ovos", fruta_ovo: "Fruta e ovos",
};

export type Escolhas = {
  carbo: string; feijao: string; proteina: string; salada: string; cafe: string; lanche: string;
  // Jantar pode repetir o almoço ou usar outra proteína
  proteinaJantar: string;
};
export const SIMPLES: Escolhas = { carbo: "arroz", feijao: "feijao", proteina: "frango", salada: "alface_tomate", cafe: "pao_ovo", lanche: "iogurte_aveia", proteinaJantar: "frango" };

// Item da refeição: "p" ajusta para bater a proteína, "c" para o carboidrato; os outros têm peso fixo.
type ItemPlano = { id: string; papel: "p" | "c" | "fixo"; g: number };
// carbo: fração do carboidrato do dia. Café e lanche têm proteína fixa (ovos, iogurte); a que faltar vai para almoço e jantar.
type Molde = { nome: string; carbo: number; itens: ItemPlano[] };

function moldes(e: Escolhas): Molde[] {
  const salada: ItemPlano[] = e.salada === "brocolis" ? [{ id: "brocolis", papel: "fixo", g: 100 }]
    : [{ id: "alface", papel: "fixo", g: 50 }, { id: "tomate", papel: "fixo", g: 80 }];
  const prato = (prot: string): ItemPlano[] => [
    { id: e.carbo, papel: "c", g: 0 },
    ...(e.feijao !== "sem" ? [{ id: e.feijao, papel: "fixo" as const, g: 100 }] : []),
    { id: prot, papel: "p", g: 0 },
    ...salada,
    { id: "azeite", papel: "fixo", g: 5 },
  ];
  const lanchinho = (op: string, fruta: string, ovos: number): ItemPlano[] =>
    op === "pao_ovo" ? [{ id: "pao", papel: "c", g: 0 }, { id: "ovo", papel: "fixo", g: ovos * 50 }, { id: fruta, papel: "fixo", g: 100 }]
      : op === "cuscuz_ovo" ? [{ id: "cuscuz", papel: "c", g: 0 }, { id: "ovo", papel: "fixo", g: ovos * 50 }]
        : op === "fruta_ovo" ? [{ id: fruta, papel: "c", g: 0 }, { id: "ovo", papel: "fixo", g: ovos * 50 }]
          : [{ id: "iogurte", papel: "fixo", g: 170 }, { id: "aveia", papel: "c", g: 0 }, { id: fruta, papel: "fixo", g: 100 }];
  return [
    { nome: "Café da manhã", carbo: 0.25, itens: lanchinho(e.cafe, "banana", 3) },
    { nome: "Almoço", carbo: 0.30, itens: prato(e.proteina) },
    { nome: "Lanche da tarde", carbo: 0.15, itens: lanchinho(e.lanche, "mamao", 2) },
    { nome: "Jantar", carbo: 0.30, itens: prato(e.proteinaJantar) },
  ];
}

export type Linha = { alimento: Alimento; g: number; texto: string } & Macro;
export type Refeicao = { nome: string; itens: Linha[]; total: Macro };
export type Dieta = { refeicoes: Refeicao[]; total: Macro };

const soma = (l: Macro[]): Macro => l.reduce((a, x) => ({ kcal: a.kcal + x.kcal, prot: a.prot + x.prot, carb: a.carb + x.carb, gord: a.gord + x.gord }), { kcal: 0, prot: 0, carb: 0, gord: 0 });
const de = (a: Alimento, g: number): Macro => ({ kcal: (a.kcal * g) / 100, prot: (a.prot * g) / 100, carb: (a.carb * g) / 100, gord: (a.gord * g) / 100 });

// Arredonda para o que dá para pesar: 5 g, ou unidades inteiras (ovo, pão)
function arredondar(a: Alimento, g: number): number {
  if (g <= 0) return 0;
  if (a.unidade) return Math.max(1, Math.round(g / a.unidade.g)) * a.unidade.g;
  return Math.max(5, Math.round(g / 5) * 5);
}
function texto(a: Alimento, g: number) {
  if (!a.unidade) return `${g} g`;
  const n = Math.round(g / a.unidade.g);
  return `${n} ${n === 1 ? a.unidade.nome : a.unidade.plural} (${g} g)`;
}

// Resolve os gramas de "p" e "c" para bater proteína e carboidrato da refeição (sistema 2×2).
function resolver(m: Molde, alvo: { prot: number; carb: number }): ItemPlano[] {
  const itens = m.itens.map((i) => ({ ...i }));
  const fixo = soma(itens.filter((i) => i.papel === "fixo").map((i) => de(ALIMENTOS[i.id], i.g)));
  const p = itens.find((i) => i.papel === "p"), c = itens.find((i) => i.papel === "c");
  const P = Math.max(0, alvo.prot - fixo.prot), C = Math.max(0, alvo.carb - fixo.carb);
  if (!c) return itens;
  const ac = ALIMENTOS[c.id];
  if (!p) { c.g = (C / ac.carb) * 100; return itens; }
  const ap = ALIMENTOS[p.id];
  const det = ap.prot * ac.carb - ac.prot * ap.carb;
  let xp = det ? (P * ac.carb - ac.prot * C) / det : 0;
  let xc = det ? (ap.prot * C - P * ap.carb) / det : 0;
  if (xp < 0) { xp = 0; xc = C / ac.carb; }
  if (xc < 0) { xc = 0; xp = P / ap.prot; }
  p.g = xp * 100; c.g = xc * 100;
  return itens;
}

export function gerarDieta(meta: Pick<Meta, "kcal_dia" | "prot_g" | "carb_g" | "gord_g">, e: Escolhas): Dieta {
  const prot = meta.prot_g ?? Math.round((meta.kcal_dia * 0.3) / 4);
  const gord = meta.gord_g ?? Math.round((meta.kcal_dia * 0.25) / 9);
  const carb = meta.carb_g ?? Math.max(0, Math.round((meta.kcal_dia - prot * 4 - gord * 9) / 4));
  const ms = moldes(e);
  const planos: ItemPlano[][] = [];
  // Primeiro café e lanche (só o carboidrato é ajustado); a proteína que sobrar se divide entre almoço e jantar
  for (const k of [0, 2]) planos[k] = resolver(ms[k], { prot: 0, carb: carb * ms[k].carbo });
  const protLanches = soma([0, 2].flatMap((k) => planos[k].map((i) => de(ALIMENTOS[i.id], arredondar(ALIMENTOS[i.id], i.g))))).prot;
  const protPratos = Math.max(0, prot - protLanches);
  planos[1] = resolver(ms[1], { prot: protPratos * 0.5, carb: carb * ms[1].carbo });
  planos[3] = resolver(ms[3], { prot: protPratos * 0.5, carb: carb * ms[3].carbo });

  // Gordura que falta para a meta vai em azeite no almoço e no jantar (até 15 g cada)
  const parcial = soma(planos.flat().map((i) => de(ALIMENTOS[i.id], arredondar(ALIMENTOS[i.id], i.g))));
  const faltaGord = gord - parcial.gord;
  if (faltaGord > 0) {
    for (const k of [1, 3]) {
      const az = planos[k].find((i) => i.id === "azeite");
      if (az) az.g = Math.min(15, az.g + faltaGord / 2);
    }
  }

  const refeicoes = ms.map((m, k) => {
    const itens: Linha[] = planos[k].map((i) => {
      const a = ALIMENTOS[i.id], g = arredondar(a, i.g);
      return { alimento: a, g, texto: texto(a, g), ...de(a, g) };
    }).filter((l) => l.g > 0);
    return { nome: m.nome, itens, total: soma(itens) };
  });
  return { refeicoes, total: soma(refeicoes.map((r) => r.total)) };
}
