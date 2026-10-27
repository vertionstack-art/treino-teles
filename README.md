# Treino e Saúde

App pessoal do Lucas (PWA para iPhone): musculação ABCDE, jiu-jitsu, cardio na esteira, nutrição, peso/bioimpedância e protocolo.
Meta: sair de 104 kg para 80 kg ganhando massa e força.

## Telas

| Aba | O que faz |
|---|---|
| Hoje | Atividades do dia (musculação, jiu-jitsu com os horários para marcar, esteira), calorias (consumo, meta ajustada, gasto das atividades), saldo da semana. Toque num dia para ver detalhes ou ajustar só aquela data. |
| Treino | Musculação A (peito), B (costas), C (bíceps e tríceps), D (perna), E (ombro) em fila. Séries com carga e reps, timer com bipe, wake lock, "última vez", vídeo. |
| Esteira | Registro do cardio (minutos, velocidade, inclinação, kcal do painel ou estimada por MET × peso), resumo da semana. |
| Nutrição | Registro pela busca na TACO ou manual, meta diária e semanal com redistribuição (máx. 15%/dia). |
| Mais → Corpo | Peso e bioimpedância: meta de peso, tabela, gráficos, alerta quando a massa magra cai mais que a gordura, laudo anexado. |
| Mais → Protocolo | Suplementos e manipulados (registro apenas), aviso de recompra, receitas. |
| Mais → Atividades | Presença no jiu-jitsu por horário (seg/qua 10h, 19h, 21h; sex 10h, 20h30) e histórico. |

## Semana padrão

Seg, qua e sex: musculação + jiu-jitsu. Ter e qui: musculação + esteira. Sáb e dom: descanso.

## Stack

- Next.js 16 (App Router, `proxy.ts`) na Vercel — projeto `treino-teles`
- Supabase — projeto `treino-teles` (`kfcgwcdxfnfkiodrffcp`), RLS por dono em todas as tabelas (setup inteiro em `supabase/setup-completo.sql`), buckets privados `fotos`, `laudos`, `receitas`
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
