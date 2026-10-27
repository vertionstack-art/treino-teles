"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { fmtDataCompleta, fmtNum } from "@/lib/datas";
import { enviar, linkAssinado, prepararArquivo } from "@/lib/arquivo";
import Grafico from "@/components/grafico";

type Exame = {
  id: string; data: string; peso: number | null; gordura_kg: number | null; pgc: number | null; mme: number | null; mlg: number | null;
  imc: number | null; tmb: number | null; agua_l: number | null; proteina_kg: number | null; minerais_kg: number | null; rcq: number | null; pdf_path: string | null;
};
const METRICAS: { k: keyof Exame; nome: string; un: string; casas?: number }[] = [
  { k: "peso", nome: "Peso", un: "kg" },
  { k: "gordura_kg", nome: "Gordura", un: "kg" },
  { k: "pgc", nome: "% gordura", un: "%" },
  { k: "mme", nome: "Músculo (MME)", un: "kg" },
  { k: "mlg", nome: "Massa magra", un: "kg" },
  { k: "imc", nome: "IMC", un: "" },
  { k: "tmb", nome: "TMB", un: "kcal", casas: 0 },
];
const CAMPOS: { k: keyof Exame; nome: string }[] = [
  { k: "peso", nome: "Peso (kg)" }, { k: "gordura_kg", nome: "Gordura (kg)" }, { k: "pgc", nome: "% gordura" },
  { k: "mme", nome: "MME (kg)" }, { k: "mlg", nome: "Massa livre de gordura (kg)" }, { k: "imc", nome: "IMC" },
  { k: "tmb", nome: "TMB (kcal)" }, { k: "agua_l", nome: "Água (L)" }, { k: "proteina_kg", nome: "Proteína (kg)" },
  { k: "minerais_kg", nome: "Minerais (kg)" }, { k: "rcq", nome: "Cintura-quadril" },
];
const num = (v: number | null | undefined) => (v == null ? null : Number(v));
const magra = (e: Exame) => num(e.mlg) ?? (e.peso != null && e.gordura_kg != null ? Number(e.peso) - Number(e.gordura_kg) : null);

export default function Corpo() {
  const [exames, setExames] = useState<Exame[]>([]);
  const [metrica, setMetrica] = useState<keyof Exame>("peso");

  const carregar = useCallback(async () => {
    const { data } = await createClient().from("bioimpedance").select("*").order("data");
    setExames((data || []) as Exame[]);
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { carregar(); }, [carregar]);

  // Alerta: massa magra caiu mais do que a gordura entre dois exames seguidos
  const alertas = exames.slice(1).map((e, i) => {
    const a = exames[i];
    const dMagra = (magra(a) ?? 0) - (magra(e) ?? 0);
    const dGord = Number(a.gordura_kg ?? 0) - Number(e.gordura_kg ?? 0);
    return { de: a, para: e, dMagra, dGord, dMme: Number(a.mme ?? 0) - Number(e.mme ?? 0), alerta: dMagra > 0 && dMagra > dGord };
  });
  const ultimo = alertas[alertas.length - 1];
  const m = METRICAS.find((x) => x.k === metrica)!;
  const pontos = exames.filter((e) => e[metrica] != null).map((e) => ({ data: e.data, v: Number(e[metrica]) }));
  const ult = exames[exames.length - 1];
  const prim = exames[0];

  async function abrirLaudo(p: string) {
    const u = await linkAssinado("laudos", p);
    if (u) window.open(u, "_blank");
  }

  return (
    <main className="wrap">
      <header>
        <h1>Corpo</h1>
        <p className="sub">Bioimpedância a cada 2 meses. InBody/Biospace, altura 184 cm.</p>
      </header>

      {ultimo?.alerta && (
        <div className="alert danger">
          <b>Massa magra caiu mais que a gordura.</b> Entre {fmtDataCompleta(ultimo.de.data)} e {fmtDataCompleta(ultimo.para.data)}: massa magra −{fmtNum(ultimo.dMagra, 1)} kg,
          gordura −{fmtNum(ultimo.dGord, 1)} kg{ultimo.dMme > 0 ? `, músculo esquelético −${fmtNum(ultimo.dMme, 1)} kg` : ""}. Meta calórica moderada e proteína alta ajudam a preservar a massa magra.
        </div>
      )}

      {ult && prim && (
        <section className="card">
          <div className="between"><h2>Último exame</h2><span className="chip">{fmtDataCompleta(ult.data)}</span></div>
          <div className="stats">
            <div className="stat"><b>{fmtNum(ult.peso, 1)}</b><span>Peso kg</span></div>
            <div className="stat"><b>{fmtNum(ult.pgc, 1)}%</b><span>Gordura</span></div>
            <div className="stat"><b>{fmtNum(ult.mme, 1)}</b><span>MME kg</span></div>
          </div>
          <p className="note" style={{ margin: 0 }}>
            Desde {fmtDataCompleta(prim.data)}: {fmtNum(Number(prim.peso) - Number(ult.peso), 1)} kg a menos, {fmtNum(Number(prim.gordura_kg) - Number(ult.gordura_kg), 1)} kg de gordura a menos
            {ult.tmb ? ` · TMB ${ult.tmb} kcal` : ""}{ult.agua_l ? ` · água ${fmtNum(ult.agua_l, 1)} L` : ""}.
          </p>
        </section>
      )}

      <section className="card">
        <h2>Evolução</h2>
        <div className="chips">
          {METRICAS.map((x) => (
            <button key={x.k} className={"chip" + (metrica === x.k ? "" : " ok")} style={{ border: 0, cursor: "pointer", opacity: metrica === x.k ? 1 : 0.7 }} onClick={() => setMetrica(x.k)}>{x.nome}</button>
          ))}
        </div>
        <Grafico pontos={pontos} unidade={m.un} casas={m.casas ?? 1} />
      </section>

      <section className="card">
        <h2>Exames</h2>
        <div className="tbl">
          <table>
            <thead><tr><th>Data</th><th>Peso</th><th>Gord. kg</th><th>%G</th><th>MME</th><th>Magra</th><th>IMC</th><th></th></tr></thead>
            <tbody>
              {[...exames].reverse().map((e) => {
                const al = alertas.find((a) => a.para.id === e.id);
                return (
                  <tr key={e.id}>
                    <td>{e.data.split("-").reverse().join("/")}</td>
                    <td>{fmtNum(e.peso, 1)}</td><td>{fmtNum(e.gordura_kg, 1)}</td><td>{fmtNum(e.pgc, 1)}</td>
                    <td>{fmtNum(e.mme, 1)}</td>
                    <td className={al?.alerta ? "down" : ""}>{fmtNum(magra(e), 1)}</td>
                    <td>{fmtNum(e.imc, 1)}</td>
                    <td>{e.pdf_path && <button className="x" onClick={() => abrirLaudo(e.pdf_path!)}>Laudo</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="note" style={{ margin: 0 }}>Em vermelho: exame em que a massa magra caiu mais que a gordura.</p>
      </section>

      <NovoExame onSaved={carregar} />
    </main>
  );
}

function NovoExame({ onSaved }: { onSaved: () => void }) {
  const [arq, setArq] = useState<{ blob: Blob; ext: string } | null>(null);
  const [form, setForm] = useState<Record<string, string>>({ data: "" });
  const [busy, setBusy] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function escolher(f?: File) {
    if (!f) { setArq(null); return; }
    const p = await prepararArquivo(f);
    setArq({ blob: p.blob, ext: p.ext });
  }

  async function salvar() {
    if (!form.data) { setErro("Informe a data do exame."); return; }
    setBusy(true);
    const path = arq ? await enviar("laudos", arq.blob, arq.ext) : null;
    const row: Record<string, string | number | null> = { data: form.data, pdf_path: path };
    for (const c of CAMPOS) row[c.k] = form[c.k] ? Number(String(form[c.k]).replace(",", ".")) : null;
    const { error } = await createClient().from("bioimpedance").upsert(row, { onConflict: "user_id,data" });
    setBusy(false);
    if (error) { setErro(error.message); return; }
    setArq(null); setForm({ data: "" }); onSaved();
  }

  return (
    <section className="card">
      <h2>Novo exame</h2>
      <div className="field"><label htmlFor="dt">Data do exame</label><input id="dt" type="date" value={form.data} onChange={(e) => setForm({ ...form, data: e.target.value })} /></div>
      <div className="grid2">
        {CAMPOS.map((c) => (
          <div className="field" key={c.k}>
            <label htmlFor={"c" + c.k}>{c.nome}</label>
            <input id={"c" + c.k} inputMode="decimal" value={form[c.k] || ""} onChange={(e) => setForm({ ...form, [c.k]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="field">
        <label htmlFor="laudo">Laudo (opcional, só para guardar)</label>
        <input id="laudo" type="file" accept="application/pdf,image/*" onChange={(e) => escolher(e.target.files?.[0])} />
      </div>
      <button className="btn" onClick={salvar} disabled={busy}>{busy ? "Salvando…" : "Salvar"}</button>
      {erro && <p className="msg err">{erro}</p>}
    </section>
  );
}
