// Demonstração de cada exercício (chave = nome usado em lib/treinos.ts).
// edb: id na ExerciseDB v2 (AscendAPI, plano grátis da RapidAPI): vídeo 3D com o músculo em destaque, com marca d'água.
//      O plano grátis não permite guardar a mídia, então o vídeo é buscado na hora por /api/exercicio/[id].
// fdb: id na free-exercise-db (domínio público): fotos de início e fim. Usada quando o exercício não está
//      na ExerciseDB grátis, ou se o vídeo falhar.
export type Midia = { edb?: string; fdb?: string };

export const MIDIA: Record<string, Midia> = {
  // A · Peito
  "Supino reto com barra": { edb: "exr_41n2hxnFMotsXTj3", fdb: "Barbell_Bench_Press_-_Medium_Grip" },
  "Supino inclinado com halteres": { fdb: "Incline_Dumbbell_Press" },
  "Supino declinado ou paralelas": { fdb: "Dips_-_Chest_Version" },
  "Crucifixo na máquina (peck deck)": { fdb: "Butterfly" },
  "Crossover na polia": { fdb: "Cable_Crossover" },
  "Abdominal na polia (crunch)": { fdb: "Cable_Crunch" },
  // B · Costas
  "Remada curvada com barra": { fdb: "Bent_Over_Barbell_Row" },
  "Puxada frontal aberta": { fdb: "Wide-Grip_Lat_Pulldown" },
  "Remada baixa com triângulo": { fdb: "Seated_Cable_Rows" },
  "Remada unilateral com halter": { edb: "exr_41n2hY9EdwkdGz9a", fdb: "One-Arm_Dumbbell_Row" },
  "Pulldown com braço estendido": { fdb: "Straight-Arm_Pulldown" },
  "Prancha": { edb: "exr_41n2hXQw5yAbbXL8", fdb: "Plank" },
  // C · Bíceps e tríceps
  "Rosca direta com barra": { fdb: "Barbell_Curl" },
  "Tríceps testa com barra W": { edb: "exr_41n2hdHtZrMPkcqY", fdb: "EZ-Bar_Skullcrusher" },
  "Rosca alternada com halteres": { fdb: "Dumbbell_Alternate_Bicep_Curl" },
  "Tríceps corda no pulley": { fdb: "Triceps_Pushdown_-_Rope_Attachment" },
  "Rosca martelo": { edb: "exr_41n2hGioS8HumEF7", fdb: "Alternate_Hammer_Curl" },
  "Tríceps francês com halter": { fdb: "Standing_Dumbbell_Triceps_Extension" },
  // D · Perna
  "Agachamento livre": { fdb: "Barbell_Squat" },
  "Leg press": { fdb: "Leg_Press" },
  "Stiff com barra": { edb: "exr_41n2hn8rpbYihzEW", fdb: "Stiff-Legged_Barbell_Deadlift" },
  "Cadeira extensora": { fdb: "Leg_Extensions" },
  "Mesa flexora": { fdb: "Lying_Leg_Curls" },
  "Panturrilha em pé": { edb: "exr_41n2hdWu3oaCGdWT", fdb: "Standing_Calf_Raises" },
  // E · Ombro
  "Desenvolvimento com barra ou halteres": { edb: "exr_41n2hs6camM22yBG", fdb: "Dumbbell_Shoulder_Press" },
  "Elevação lateral com halteres": { edb: "exr_41n2hjuGpcex14w7", fdb: "Side_Lateral_Raise" },
  "Elevação frontal com halteres": { edb: "exr_41n2howQHvcrcrW6", fdb: "Front_Dumbbell_Raise" },
  "Crucifixo inverso (peck deck)": { edb: "exr_41n2hyNf5GebszTf", fdb: "Reverse_Machine_Flyes" },
  "Encolhimento com halteres": { fdb: "Dumbbell_Shrug" },
  "Face pull na polia": { fdb: "Face_Pull" },
};

const FDB = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
export const fotosFdb = (id: string) => [`${FDB}${id}/0.jpg`, `${FDB}${id}/1.jpg`];
