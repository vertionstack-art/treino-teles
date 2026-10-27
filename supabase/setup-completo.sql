-- ===== supabase/migrations/0001_fundacao.sql =====
-- Fase 1: Fundação. Tabelas da especificação (seção 5) com RLS por dono.
-- Toda linha pertence a um usuário (user_id = auth.uid()). Só o dono lê e escreve.

-- Perfil -------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text,
  altura_cm numeric(5,1),
  data_nasc date,
  objetivo text,
  created_at timestamptz not null default now()
);

-- Cria o perfil automaticamente no cadastro
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;
revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Treinos (musculação, corrida, pilates, muay thai) --------------------------
create table public.workout_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  tipo text not null check (tipo in ('musculacao','corrida','pilates','muaythai','outro')),
  plano_dia text,
  local text,
  duracao_s integer,
  kcal integer,
  fc_media integer,
  strava_activity_id bigint,
  notas text,
  created_at timestamptz not null default now()
);
create index on public.workout_sessions (user_id, data desc);
create unique index on public.workout_sessions (user_id, strava_activity_id) where strava_activity_id is not null;

create table public.workout_sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  exercicio text not null,
  ordem integer not null,
  serie integer not null,
  carga_kg numeric(6,2),
  reps integer,
  ok boolean not null default false
);
create index on public.workout_sets (session_id);
create index on public.workout_sets (user_id, exercicio);

-- Corrida ---------------------------------------------------------------------
create table public.run_plan (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  tipo text not null,
  distancia_km numeric(5,2),
  pace_alvo text,
  descricao text,
  status text not null default 'planejado'
);
create index on public.run_plan (user_id, data);

create table public.run_feedback (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  session_id uuid not null references public.workout_sessions (id) on delete cascade,
  dor_0a10 smallint check (dor_0a10 between 0 and 10),
  local_dor text,
  notas text,
  created_at timestamptz not null default now()
);
create index on public.run_feedback (session_id);

-- Nutrição --------------------------------------------------------------------
create table public.foods_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data_hora timestamptz not null default now(),
  refeicao text,
  descricao text not null,
  quantidade_g numeric(7,1),
  kcal numeric(7,1),
  prot_g numeric(6,1),
  carb_g numeric(6,1),
  gord_g numeric(6,1),
  origem text not null default 'manual' check (origem in ('foto_tabela','foto_prato','manual')),
  foto_path text,
  confianca text
);
create index on public.foods_log (user_id, data_hora desc);

create table public.nutrition_targets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  vigencia_inicio date not null,
  kcal_dia integer not null,
  prot_g integer,
  carb_g integer,
  gord_g integer
);
create index on public.nutrition_targets (user_id, vigencia_inicio desc);

-- Bioimpedância ---------------------------------------------------------------
create table public.bioimpedance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  peso numeric(5,1),
  gordura_kg numeric(5,1),
  pgc numeric(4,1),
  mme numeric(5,1),
  mlg numeric(5,1),
  imc numeric(4,1),
  tmb integer,
  agua_l numeric(5,1),
  proteina_kg numeric(5,2),
  minerais_kg numeric(5,2),
  rcq numeric(4,2),
  pdf_path text,
  unique (user_id, data)
);

-- Protocolo (registro apenas, sem sugestão de dose) ---------------------------
create table public.protocol_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  receita_data date not null,
  horario text not null,
  item text not null,
  dose text,
  doses_total integer,
  inicio_uso date,
  ativo boolean not null default true
);
create index on public.protocol_items (user_id, ativo);

-- Strava: só o servidor (service role) acessa. RLS ligado e sem políticas.
create table public.strava_tokens (
  user_id uuid primary key references auth.users (id) on delete cascade,
  access_token text not null,
  refresh_token text not null,
  expires_at timestamptz not null
);

-- RLS -------------------------------------------------------------------------
alter table public.profiles          enable row level security;
alter table public.workout_sessions  enable row level security;
alter table public.workout_sets      enable row level security;
alter table public.run_plan          enable row level security;
alter table public.run_feedback      enable row level security;
alter table public.foods_log         enable row level security;
alter table public.nutrition_targets enable row level security;
alter table public.bioimpedance      enable row level security;
alter table public.protocol_items    enable row level security;
alter table public.strava_tokens     enable row level security;

create policy "dono" on public.profiles for all to authenticated
  using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

do $$
declare t text;
begin
  foreach t in array array['workout_sessions','workout_sets','run_plan','run_feedback',
                           'foods_log','nutrition_targets','bioimpedance','protocol_items']
  loop
    execute format(
      'create policy "dono" on public.%I for all to authenticated
         using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', t);
  end loop;
end $$;

-- Sets e feedback só podem apontar para sessões do próprio dono
create policy "sessao do dono" on public.workout_sets as restrictive for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));
create policy "sessao do dono" on public.run_feedback as restrictive for all to authenticated
  using (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())))
  with check (exists (select 1 from public.workout_sessions s where s.id = session_id and s.user_id = (select auth.uid())));

-- ===== supabase/migrations/0002_modulos.sql =====
-- Fases 2 a 7: colunas extras, ajustes por dia, receitas, arquivos.

-- Perfil: modo retorno de lesão da corrida
alter table public.profiles
  add column retorno_lesao boolean not null default true,
  add column retorno_nivel smallint not null default 1 check (retorno_nivel between 1 and 6);

-- Sessões: detalhes vindos do app e do Strava
alter table public.workout_sessions
  add column fonte text not null default 'app' check (fonte in ('app','strava','manual')),
  add column inicio timestamptz,
  add column distancia_m numeric(9,1),
  add column elevacao_m numeric(7,1),
  add column fc_max integer,
  add column intensidade text check (intensidade in ('leve','moderada','forte')),
  add column series integer,
  add column volume_kg integer,
  add column strava_tipo text,
  add column nome text;

-- Ajuste do plano de um dia específico (trocar ou remover atividades)
create table public.day_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  atividades jsonb not null default '[]',
  unique (user_id, data)
);

-- Receitas do protocolo (arquivo + data). Itens apontam para a receita.
create table public.prescriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  data date not null,
  medico text,
  file_path text,
  notas text,
  created_at timestamptz not null default now()
);
alter table public.protocol_items
  add column prescription_id uuid references public.prescriptions (id) on delete set null,
  add column dias_por_dose smallint not null default 1;

-- Strava: id do atleta (o webhook só informa o owner_id)
alter table public.strava_tokens
  add column athlete_id bigint unique,
  add column scope text,
  add column updated_at timestamptz not null default now();

alter table public.day_plans     enable row level security;
alter table public.prescriptions enable row level security;
create policy "dono" on public.day_plans for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "dono" on public.prescriptions for all to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

-- Arquivos privados: fotos de comida, laudos e receitas. Pasta = id do dono.
insert into storage.buckets (id, name, public)
values ('fotos','fotos',false), ('laudos','laudos',false), ('receitas','receitas',false)
on conflict (id) do nothing;

create policy "arquivos do dono" on storage.objects for all to authenticated
  using (bucket_id in ('fotos','laudos','receitas') and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('fotos','laudos','receitas') and (storage.foldername(name))[1] = (select auth.uid())::text);

-- ===== supabase/migrations/0003_origem_taco.sql =====
-- Registro de alimento pela busca na TACO
alter table public.foods_log drop constraint if exists foods_log_origem_check;
alter table public.foods_log add constraint foods_log_origem_check
  check (origem in ('foto_tabela','foto_prato','manual','taco'));

