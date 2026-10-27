# Treino e Saúde

App pessoal (PWA para iPhone) de musculação, corrida, nutrição, bioimpedância e protocolo.
Especificação em [docs/especificacao.md](docs/especificacao.md); app original em [docs/treino.html](docs/treino.html);
ajustes do treinador em [docs/ajustes-treinador-2026-10-13.md](docs/ajustes-treinador-2026-10-13.md).

## Telas

| Aba | O que faz |
|---|---|
| Hoje | Atividades do dia, calorias (consumo, meta ajustada, gasto das atividades), saldo da semana. Toque num dia da semana para ver detalhes ou ajustar só aquela data. |
| Treino | Musculação Superior/Inferior em fila (Superior 1 → Inferior → Superior 2). Séries com carga e reps, timer com bipe, wake lock, "última vez", vídeo. |
| Corrida | Plano da semana (normal ou retorno de lesão por nível), dor 0–10 pós-corrida, redução da próxima sessão, corridas registradas. |
| Nutrição | Registro pela busca na TACO ou manual, meta diária e semanal com redistribuição (máx. 15%/dia). |
| Mais → Corpo | Bioimpedância: tabela, gráficos, alerta quando a massa magra cai mais que a gordura, laudo anexado (sem leitura automática). |
| Mais → Protocolo | Suplementos e manipulados (registro apenas), aviso de recompra, receitas. |
| Mais → Atividades | Muay thai (MET × peso), presença no pilates, histórico. |

## Stack

- Next.js 16 (App Router, `proxy.ts`) na Vercel — projeto `treino-teles`
- Supabase — projeto `treino-teles` (`kfcgwcdxfnfkiodrffcp`), RLS por dono em todas as tabelas, buckets privados `fotos`, `laudos`, `receitas`
- Migrations em `supabase/migrations/`; dados iniciais em `supabase/seed/`

## Variáveis de ambiente

Públicas ficam em `.env.production` (versionado). Segredos vão **só** no painel da Vercel (Settings → Environment Variables):

| Variável | Onde pegar |
|---|---|
| `ALLOWED_EMAILS` (opcional) | e-mails que podem entrar, separados por vírgula |

Depois de cadastrar, faça um novo deploy (Deployments → Redeploy).

## Rodar local

```bash
npm install
npm run dev
```
