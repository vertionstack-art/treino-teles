-- Dados iniciais do Lucas. Rodar depois de criar a conta no app (usa o primeiro usuário cadastrado).
do $$
declare
  uid uuid := (select id from auth.users order by created_at limit 1);
begin
  update public.profiles
  set nome = 'Lucas Teles', altura_cm = 176, peso_meta = 80,
      objetivo = 'Emagrecer de 104 para 80 kg ganhando massa e força: definido e forte'
  where id = uid;

  -- Peso de partida (sem bioimpedância ainda: só o peso)
  insert into public.bioimpedance (user_id, data, peso, imc)
  values (uid, current_date, 104, round(104 / (1.76 * 1.76), 1))
  on conflict (user_id, data) do nothing;
end $$;
