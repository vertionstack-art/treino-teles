"use client";

import { useEffect, useState } from "react";
import { MIDIA, fotosFdb, videoWger } from "@/lib/midia";

type Edb = { video: string | null; imagem: string | null; nome?: string; equipamento?: string | null };
type Instr = { nome: string; instrucoes: string; seguranca: string | null; nivel: string | null };

// Demonstração dentro do card, na ordem: vídeo 3D da ExerciseDB → vídeo da wger → fotos de início e fim.
// Embaixo, as instruções da API Ninjas quando a chave está configurada.
export default function Demo({ nome }: { nome: string }) {
  const m = MIDIA[nome];
  const [edb, setEdb] = useState<Edb | null>(null);
  const [falhouEdb, setFalhouEdb] = useState(false);
  const [falhouWger, setFalhouWger] = useState(false);
  const [instr, setInstr] = useState<Instr | null>(null);
  const [quadro, setQuadro] = useState(0);

  const fonte = m?.edb && !falhouEdb ? "edb" : m?.wger && !falhouWger ? "wger" : m?.fdb ? "fdb" : null;

  useEffect(() => {
    if (!m?.edb) return;
    let vivo = true;
    fetch(`/api/exercicio/${m.edb}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((j: Edb) => { if (vivo) { if (j.video || j.imagem) setEdb(j); else setFalhouEdb(true); } })
      .catch(() => { if (vivo) setFalhouEdb(true); });
    return () => { vivo = false; };
  }, [m?.edb]);

  useEffect(() => {
    if (!m?.en) return;
    let vivo = true;
    fetch(`/api/instrucoes?nome=${encodeURIComponent(m.en)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j: Instr | null) => { if (vivo && j) setInstr(j); })
      .catch(() => {});
    return () => { vivo = false; };
  }, [m?.en]);

  useEffect(() => {
    if (fonte !== "fdb") return;
    const t = setInterval(() => setQuadro((q) => 1 - q), 900);
    return () => clearInterval(t);
  }, [fonte]);

  if (!m) return <p className="small muted" style={{ margin: 0 }}>Sem demonstração para este exercício. Use o YouTube.</p>;

  let midia: React.ReactNode = null;
  if (fonte === "edb") {
    midia = !edb ? (
      <><div className="demo-fotos" aria-busy="true" /><span className="small muted">Carregando vídeo…</span></>
    ) : (
      <>
        {edb.video ? (
          <video src={edb.video} poster={edb.imagem ?? undefined} autoPlay loop muted playsInline onError={() => setFalhouEdb(true)} />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={edb.imagem!} alt={edb.nome || nome} />
        )}
        <span className="small muted">{edb.nome}{edb.equipamento ? ` · ${edb.equipamento.toLowerCase()}` : ""} · ExerciseDB</span>
      </>
    );
  } else if (fonte === "wger") {
    midia = (
      <>
        <video src={videoWger(m.wger!)} poster={m.fdb ? fotosFdb(m.fdb)[0] : undefined} controls loop muted playsInline preload="none" onError={() => setFalhouWger(true)} />
        <span className="small muted">Toque no play · vídeo pesado, prefira o Wi-Fi · wger.de (CC BY-SA)</span>
      </>
    );
  } else if (fonte === "fdb") {
    const fotos = fotosFdb(m.fdb!);
    midia = (
      <>
        <div className="demo-fotos">
          {fotos.map((f, i) => (
            // eslint-disable-next-line @next/next/no-img-element
            <img key={f} src={f} alt={i === 0 ? "Posição inicial" : "Posição final"} style={{ opacity: quadro === i ? 1 : 0 }} />
          ))}
        </div>
        <span className="small muted">Início e fim do movimento · free-exercise-db</span>
      </>
    );
  }

  return (
    <div className="demo">
      {midia}
      {instr && (
        <details className="demo-instr">
          <summary className="small"><b>Como fazer</b> <span className="muted">(em inglês · API Ninjas)</span></summary>
          <p className="small" style={{ margin: "6px 0 0" }}>{instr.instrucoes}</p>
          {instr.seguranca && <p className="small muted" style={{ margin: "6px 0 0" }}><b>Segurança:</b> {instr.seguranca}</p>}
        </details>
      )}
    </div>
  );
}
