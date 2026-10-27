import { NextResponse } from "next/server";

// Busca o vídeo de um exercício na ExerciseDB v2 (RapidAPI). A chave fica só no servidor.
// O plano grátis não permite cache, então cada pedido vai até a API (2.000 por mês).
const HOST = "edb-with-videos-and-images-by-ascendapi.p.rapidapi.com";

export async function GET(_req: Request, ctx: RouteContext<"/api/exercicio/[id]">) {
  const { id } = await ctx.params;
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return NextResponse.json({ erro: "RAPIDAPI_KEY não configurada" }, { status: 503 });
  if (!/^exr_[A-Za-z0-9]+$/.test(id)) return NextResponse.json({ erro: "id inválido" }, { status: 400 });

  const r = await fetch(`https://${HOST}/api/v1/exercises/${id}`, {
    headers: { "x-rapidapi-key": key, "x-rapidapi-host": HOST },
    cache: "no-store",
  });
  if (!r.ok) return NextResponse.json({ erro: `ExerciseDB respondeu ${r.status}` }, { status: 502 });
  const { data } = (await r.json()) as { data?: { name?: string; videoUrl?: string; imageUrl?: string; equipments?: string[] } };
  if (!data?.videoUrl && !data?.imageUrl) return NextResponse.json({ erro: "sem mídia" }, { status: 404 });
  return NextResponse.json(
    { nome: data.name?.trim(), video: data.videoUrl ?? null, imagem: data.imageUrl ?? null, equipamento: data.equipments?.[0] ?? null },
    { headers: { "Cache-Control": "no-store" } },
  );
}
