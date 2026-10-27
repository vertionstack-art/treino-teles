"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { enviarFila, lerFila, limparRecusados, recusados } from "@/lib/offline";

const GUARDAR_A_CADA = 6 * 3600 * 1000;

// Liga o modo offline (service worker), sobe a fila quando a conexão volta e mostra o estado no topo
export default function Offline() {
  const [online, setOnline] = useState(true);
  const [pendentes, setPendentes] = useState(0);
  const [erros, setErros] = useState(0);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").then(async (reg) => {
        await navigator.serviceWorker.ready;
        try {
          if (Date.now() - Number(localStorage.getItem("guardado-em") || 0) < GUARDAR_A_CADA) return;
          localStorage.setItem("guardado-em", String(Date.now()));
        } catch {}
        reg.active?.postMessage("guardar");
      }).catch(() => {});
    }

    const atualizar = () => { setOnline(navigator.onLine); setPendentes(lerFila().length); setErros(recusados()); };
    const enviar = async () => {
      atualizar();
      if (!navigator.onLine || !lerFila().length) return;
      const token = (await createClient().auth.getSession()).data.session?.access_token;
      if (token) await enviarFila(token, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!);
      atualizar();
    };
    const visivel = () => { if (document.visibilityState === "visible") enviar(); };
    enviar();
    window.addEventListener("online", enviar);
    window.addEventListener("offline", atualizar);
    window.addEventListener("fila", atualizar);
    document.addEventListener("visibilitychange", visivel);
    const t = setInterval(enviar, 30000);
    return () => {
      window.removeEventListener("online", enviar);
      window.removeEventListener("offline", atualizar);
      window.removeEventListener("fila", atualizar);
      document.removeEventListener("visibilitychange", visivel);
      clearInterval(t);
    };
  }, []);

  if (online && !pendentes && !erros) return null;
  return (
    <div className="offline" role="status">
      {!online && <b>Sem conexão · </b>}
      {pendentes > 0
        ? `${pendentes} ${pendentes === 1 ? "registro aguardando" : "registros aguardando"} internet para salvar`
        : !online && "mostrando os dados guardados no aparelho"}
      {erros > 0 && (
        <button onClick={() => { limparRecusados(); setErros(0); }}>
          {erros} {erros === 1 ? "registro recusado" : "registros recusados"} pelo servidor · ok
        </button>
      )}
    </div>
  );
}
