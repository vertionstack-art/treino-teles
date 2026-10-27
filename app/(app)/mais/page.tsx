import Link from "next/link";
import { signOut } from "../../actions";

export default function Mais() {
  return (
    <main className="wrap">
      <header>
        <h1>Mais</h1>
      </header>
      <section className="card links">
        <Link href="/corpo">Peso <span>Meta e evolução</span></Link>
        <Link href="/protocolo">Protocolo <span>Suplementos e receitas</span></Link>
        <Link href="/atividades">Atividades <span>Jiu-jitsu e histórico</span></Link>
      </section>
      <form action={signOut}>
        <button className="btn ghost" type="submit">Sair</button>
      </form>
    </main>
  );
}
