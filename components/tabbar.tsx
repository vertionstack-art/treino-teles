"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Hoje", ic: "H" },
  { href: "/musculacao", label: "Treino", ic: "M" },
  { href: "/esteira", label: "Esteira", ic: "E" },
  { href: "/nutricao", label: "Nutrição", ic: "N" },
  { href: "/mais", label: "Mais", ic: "+" },
];
const MAIS = ["/mais", "/corpo", "/protocolo", "/atividades", "/perfil"];

export default function Tabbar() {
  const path = usePathname();
  const ativo = (href: string) =>
    href === "/" ? path === "/" : href === "/mais" ? MAIS.some((p) => path.startsWith(p)) : path.startsWith(href);
  return (
    <nav className="tabbar" aria-label="Seções">
      <ul>
        {TABS.map((t) => (
          <li key={t.href}>
            <Link href={t.href} aria-current={ativo(t.href) ? "page" : undefined}>
              <i>{t.ic}</i>
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
