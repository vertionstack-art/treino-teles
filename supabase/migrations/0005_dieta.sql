-- Alimentos escolhidos para a dieta gerada (as quantidades são recalculadas a partir da meta).
alter table public.profiles add column if not exists dieta jsonb;
