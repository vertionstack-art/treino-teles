-- Adaptação para o Lucas: jiu-jitsu e esteira no lugar de corrida, pilates e muay thai; meta de peso no perfil.
alter table public.workout_sessions drop constraint if exists workout_sessions_tipo_check;
alter table public.workout_sessions add constraint workout_sessions_tipo_check
  check (tipo in ('musculacao','corrida','pilates','muaythai','jiujitsu','esteira','outro'));

alter table public.profiles add column if not exists peso_meta numeric(5,1);
