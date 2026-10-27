import { NextResponse } from "next/server";

// Instruções de execução da API Ninjas (texto em inglês). A chave fica só no servidor.
// O plano grátis devolve até 5 resultados por busca; usamos o nome exato quando bate, senão o primeiro.
export async function GET(req: Request) {
  const nome = new URL(req.url).searchParams.get("nome")?.trim();
  const key = process.env.API_NINJAS_KEY;
  if (!key) return NextResponse.json({ erro: "API_NINJAS_KEY não configurada" }, { status: 503 });
  if (!nome || nome.length > 80) return NextResponse.json({ erro: "nome inválido" }, { status: 400 });

  const r = await fetch(`https://api.api-ninjas.com/v1/exercises?name=${encodeURIComponent(nome)}`, {
    headers: { "X-Api-Key": key },
    // Texto não muda: guarda por uma semana para poupar a cota
    next: { revalidate: 604800 },
  });
  if (!r.ok) return NextResponse.json({ erro: `API Ninjas respondeu ${r.status}` }, { status: 502 });
  const lista = (await r.json()) as { name: string; instructions?: string; safety_info?: string; difficulty?: string }[];
  const ex = lista.find((e) => e.name.toLowerCase() === nome.toLowerCase()) ?? lista[0];
  if (!ex?.instructions) return NextResponse.json({ erro: "sem instruções" }, { status: 404 });
  return NextResponse.json({ nome: ex.name, instrucoes: ex.instructions, seguranca: ex.safety_info ?? null, nivel: ex.difficulty ?? null });
}
