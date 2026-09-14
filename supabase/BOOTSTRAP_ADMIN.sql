-- 1) Primeiro crie o usuário em Authentication > Users.
-- 2) Troque o e-mail abaixo e execute este SQL.
insert into public.admin_users (user_id)
select id
from auth.users
where email = 'SEU-EMAIL-DE-ADMIN@EMAIL.COM'
on conflict (user_id) do nothing;
