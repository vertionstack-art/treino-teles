// Demonstração de cada exercício (chave = nome usado em lib/treinos.ts).
// edb: id na ExerciseDB v2 (AscendAPI, plano grátis da RapidAPI): vídeo 3D com o músculo em destaque, com marca d'água.
//      O plano grátis não permite guardar a mídia, então o vídeo é buscado na hora por /api/exercicio/[id].
// wger: vídeo da wger.de (CC BY-SA, gravado pela comunidade). Usado quando a ExerciseDB grátis não tem o exercício.
//       São arquivos grandes (até ~60 MB, HEVC que o iPhone toca), então só carregam quando a pessoa dá play.
// fdb: id na free-exercise-db (domínio público): fotos de início e fim. Para o que não tem vídeo, ou se o vídeo falhar.
// en: nome em inglês para buscar as instruções de execução na API Ninjas.
export type Midia = { edb?: string; wger?: string; fdb?: string; en?: string };

export const MIDIA: Record<string, Midia> = {
  // A · Peito
  "Supino reto com barra": { edb: "exr_41n2hxnFMotsXTj3", fdb: "Barbell_Bench_Press_-_Medium_Grip", en: "Barbell Bench Press - Medium Grip" },
  "Supino inclinado com halteres": { fdb: "Incline_Dumbbell_Press", wger: "537/b9c937e9-daeb-42a9-be8e-7a77e368478c.MOV", en: "Incline dumbbell bench press" },
  "Supino declinado ou paralelas": { fdb: "Dips_-_Chest_Version", wger: "194/dd9a663f-d8ba-4621-823b-13788ccb66bc.MOV", en: "AM Chest Dips" },
  "Crucifixo na máquina (peck deck)": { fdb: "Butterfly", en: "Butterfly" },
  "Crossover na polia": { fdb: "Cable_Crossover", en: "cable crossover" },
  "Abdominal na polia (crunch)": { fdb: "Cable_Crunch", en: "Kneeling cable crunch" },
  // B · Costas
  "Remada curvada com barra": { fdb: "Bent_Over_Barbell_Row", en: "bent over barbell row" },
  "Puxada frontal aberta": { fdb: "Wide-Grip_Lat_Pulldown", en: "Wide-Grip Lat Pull-Down - Gethin Variation" },
  "Remada baixa com triângulo": { fdb: "Seated_Cable_Rows", wger: "512/fff4c294-93f0-4926-b3a2-bf59ad4afaa5.MOV", en: "Seated Cable Rows" },
  "Remada unilateral com halter": { edb: "exr_41n2hY9EdwkdGz9a", fdb: "One-Arm_Dumbbell_Row", en: "one-arm dumbbell row" },
  "Pulldown com braço estendido": { fdb: "Straight-Arm_Pulldown", en: "straight-arm pulldown" },
  "Prancha": { edb: "exr_41n2hXQw5yAbbXL8", fdb: "Plank", en: "Elbow plank" },
  // C · Bíceps e tríceps
  "Rosca direta com barra": { fdb: "Barbell_Curl", wger: "91/483f4bff-e108-41f1-8e7b-0caf24952552.MOV", en: "barbell curl" },
  "Tríceps testa com barra W": { edb: "exr_41n2hdHtZrMPkcqY", fdb: "EZ-Bar_Skullcrusher", en: "ez-bar skullcrusher" },
  "Rosca alternada com halteres": { fdb: "Dumbbell_Alternate_Bicep_Curl", wger: "92/8bfb917c-3d0d-49b9-8073-5d7e01c1b894.MOV", en: "dumbbell alternate bicep curl" },
  "Tríceps corda no pulley": { fdb: "Triceps_Pushdown_-_Rope_Attachment", wger: "659/1f2eb3b6-3185-429f-8330-26dc88f39aff.MOV", en: "triceps pushdown - rope attachment" },
  "Rosca martelo": { edb: "exr_41n2hGioS8HumEF7", fdb: "Alternate_Hammer_Curl", en: "Hammer Curls" },
  "Tríceps francês com halter": { fdb: "Standing_Dumbbell_Triceps_Extension", wger: "211/85f6eb25-a76c-409e-9af9-497794ac0dfb.MOV", en: "standing dumbbell triceps extension" },
  // D · Perna
  "Agachamento livre": { fdb: "Barbell_Squat", en: "barbell squat" },
  "Leg press": { fdb: "Leg_Press", wger: "371/6aae16b4-01b9-4eb4-935c-3250f84d2c59.MOV", en: "leg press" },
  "Stiff com barra": { edb: "exr_41n2hn8rpbYihzEW", fdb: "Stiff-Legged_Barbell_Deadlift", en: "Barbell stiff-legged deadlift" },
  "Cadeira extensora": { fdb: "Leg_Extensions", en: "leg extensions" },
  "Mesa flexora": { fdb: "Lying_Leg_Curls", wger: "365/becaf013-5044-40d0-bae9-7ed60c973737.MOV", en: "lying leg curls" },
  "Panturrilha em pé": { edb: "exr_41n2hdWu3oaCGdWT", fdb: "Standing_Calf_Raises", en: "standing calf raises" },
  // E · Ombro
  "Desenvolvimento com barra ou halteres": { edb: "exr_41n2hs6camM22yBG", fdb: "Dumbbell_Shoulder_Press", en: "Seated dumbbell shoulder press" },
  "Elevação lateral com halteres": { edb: "exr_41n2hjuGpcex14w7", fdb: "Side_Lateral_Raise", en: "side lateral raise" },
  "Elevação frontal com halteres": { edb: "exr_41n2howQHvcrcrW6", fdb: "Front_Dumbbell_Raise", en: "Dumbbell front raise" },
  "Crucifixo inverso (peck deck)": { edb: "exr_41n2hyNf5GebszTf", fdb: "Reverse_Machine_Flyes", en: "reverse machine flyes" },
  "Encolhimento com halteres": { fdb: "Dumbbell_Shrug", wger: "570/bd1f14a3-9d2b-4ec0-b6b9-e82d739f7e60.MOV", en: "Standing dumbbell shrug" },
  "Face pull na polia": { fdb: "Face_Pull", wger: "222/eea93fcc-6a3c-4783-8f70-0234c791a001.MOV", en: "Standing face pull" },
};

const FDB = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
export const videoWger = (caminho: string) => `https://wger.de/media/exercise-video/${caminho}`;
export const fotosFdb = (id: string) => [`${FDB}${id}/0.jpg`, `${FDB}${id}/1.jpg`];
