import LoginForm from "./login-form";

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { erro } = await searchParams;
  return (
    <main className="wrap" style={{ paddingTop: "calc(48px + env(safe-area-inset-top, 0px))" }}>
      <header>
        <h1>Treino e Saúde</h1>
        <p className="sub">Entre para ver seus treinos, nutrição e evolução.</p>
      </header>
      <LoginForm
        initialError={
          erro === "nao-autorizado"
            ? "Esta conta não tem acesso ao app."
            : erro === "link"
              ? "O link de confirmação expirou ou já foi usado. Tente entrar com e-mail e senha."
              : null
        }
      />
    </main>
  );
}
