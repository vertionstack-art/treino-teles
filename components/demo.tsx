"use client";

import { useEffect, useState } from "react";
import { MIDIA, fotosFdb } from "@/lib/midia";

type Video = { video: string | null; imagem: string | null; nome?: string; equipamento?: string | null };

// Demonstração dentro do card: vídeo 3D da ExerciseDB quando existe; senão, fotos de início e fim alternando.
export default function Demo({ nome }: { nome: string }) {
  const m = MIDIA[nome];
  const [video, setVideo] = useState<Video | null>(null);
  const [falhou, setFalhou] = useState(false);
  const [quadro, setQuadro] = useState(0);
  const usarFotos = !!m?.fdb && (!m.edb || falhou);

  useEffect(() => {
    if (!m?.edb) return;
    let vivo = true;
    fetch(`/api/exercicio/${m.edb}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Video) => { if (vivo) setVideo(j); })
      .catch(() => { if (vivo) setFalhou(true); });
    return () => { vivo = false; };
  }, [m?.edb]);

  useEffect(() => {
    if (!usarFotos) return;
    const t = setInterval(() => setQuadro((q) => 1 - q), 900);
    return () => clearInterval(t);
  }, [usarFotos]);

  if (!m) return <p className="small muted" style={{ margin: 0 }}>Sem demonstração para este exercício. Use o YouTube.</p>;

  if (usarFotos) {
    const fotos = fotosFdb(m.fdb!);
    return (
      <div className="demo">
        <div className="demo-fotos">
          {/* eslint-disable-next-line @next/next/no-img-element -- imagens externas pequenas, sem otimização da Vercel */}
          {fotos.map((f, i) => <img key={f} src={f} alt={i === 0 ? "Posição inicial" : "Posição final"} style={{ opacity: quadro === i ? 1 : 0 }} />)}
        </div>
        <span className="small muted">Início e fim do movimento · free-exercise-db</span>
      </div>
    );
  }

  if (!video) return <div className="demo"><div className="demo-fotos" aria-busy="true" /><span className="small muted">Carregando vídeo…</span></div>;

  return (
    <div className="demo">
      {video.video ? (
        <video src={video.video} poster={video.imagem ?? undefined} autoPlay loop muted playsInline onError={() => setFalhou(true)} />
      ) : video.imagem ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={video.imagem} alt={video.nome || nome} />
      ) : null}
      <span className="small muted">{video.nome}{video.equipamento ? ` · ${video.equipamento.toLowerCase()}` : ""} · ExerciseDB</span>
    </div>
  );
}
