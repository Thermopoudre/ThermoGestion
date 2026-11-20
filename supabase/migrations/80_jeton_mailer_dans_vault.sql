-- 80 · Rotation du jeton du relais tg-mailer.php (20/11/2026, accord d'Alexis)
--
-- L'ancien jeton était écrit en clair dans process_notifications() et dans la migration 53, publiée
-- sur le dépôt GitHub public. Il est désormais refusé par le relais. Le nouveau a été généré DANS
-- la base (il n'a jamais transité ailleurs) :
--   select vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'), 'tg_mailer_token', '…');
-- Le relais ne connaît que son empreinte SHA-256. Pour changer à nouveau de jeton : vault.update_secret,
-- puis reporter la nouvelle empreinte dans EMPREINTE_JETON de public_html/tg-mailer.php.
do $$
declare v_def text; v_ancien text;
begin
  v_def := pg_get_functiondef('public.process_notifications'::regproc);
  v_ancien := substring(v_def from '''token'', ''([0-9a-f]{48})''');
  if v_ancien is null then raise exception 'JETON_LITTERAL_INTROUVABLE'; end if;
  v_def := replace(v_def, '''' || v_ancien || '''', '(select decrypted_secret from vault.decrypted_secrets where name = ''tg_mailer_token'')');
  execute v_def;
end $$;
