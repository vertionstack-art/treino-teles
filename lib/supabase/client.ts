import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { offlineFetch } from "@/lib/offline";

let cliente: SupabaseClient | null = null;

export function createClient() {
  if (cliente) return cliente;
  const c = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    { global: { fetch: offlineFetch } },
  );
  if (typeof window === "undefined") return c;

  // Sem internet, renovar o login vencido trava cada consulta por até 30 s.
  // Se a renovação não responde logo, segue com o login guardado: a leitura vem do cache
  // e a escrita vai para a fila, que sobe depois com um login renovado.
  type Auth = {
    getSession: SupabaseClient["auth"]["getSession"];
    storage: { getItem(k: string): string | null | Promise<string | null> };
    storageKey: string;
  };
  const auth = c.auth as unknown as Auth;
  const original = auth.getSession.bind(c.auth);
  auth.getSession = async () => {
    const pedido = original();
    const guardada = new Promise((ok) => setTimeout(ok, navigator.onLine ? 4000 : 0)).then(async () => {
      try {
        const s = JSON.parse((await auth.storage.getItem(auth.storageKey)) || "null");
        return s?.access_token ? ({ data: { session: s }, error: null } as Awaited<typeof pedido>) : null;
      } catch { return null; }
    });
    return (await Promise.race([pedido, guardada])) ?? pedido;
  };
  cliente = c;
  return c;
}
