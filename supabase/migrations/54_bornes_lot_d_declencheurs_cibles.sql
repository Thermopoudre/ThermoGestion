-- =================================================================================================
-- 54 — Restreint les déclencheurs posés en 53 aux colonnes qu'ils vérifient réellement
--
-- POURQUOI. `before insert or update` sans liste de colonnes revalidait la remise et les lignes à
-- CHAQUE écriture sur devis/factures/bons_livraison — y compris un simple changement de statut
-- (signature, numérotation, passage « livré »). Aucune donnée en base ne viole ces règles
-- aujourd'hui (vérifié), mais un futur cas limite qui y échapperait bloquerait alors des écritures
-- sans rapport avec la remise ou les lignes. Restreindre aux colonnes concernées, comme le fait
-- déjà `une_grille_par_defaut` (migration 51) sur `is_default`.
-- =================================================================================================

drop trigger if exists borner_remise on public.devis;
create trigger borner_remise
  before insert or update of remise, items on public.devis
  for each row execute function public.trg_borner_remise('items');

drop trigger if exists borner_remise on public.factures;
create trigger borner_remise
  before insert or update of remise, items on public.factures
  for each row execute function public.trg_borner_remise('items');

drop trigger if exists borner_remise on public.bons_livraison;
create trigger borner_remise
  before insert or update of remise, lignes on public.bons_livraison
  for each row execute function public.trg_borner_remise('lignes');

drop trigger if exists lignes_qte_positive on public.devis;
create trigger lignes_qte_positive
  before insert or update of items on public.devis
  for each row execute function public.trg_lignes_qte_positive('items');

drop trigger if exists lignes_qte_positive on public.factures;
create trigger lignes_qte_positive
  before insert or update of items on public.factures
  for each row execute function public.trg_lignes_qte_positive('items');

drop trigger if exists lignes_qte_positive on public.bons_livraison;
create trigger lignes_qte_positive
  before insert or update of lignes on public.bons_livraison
  for each row execute function public.trg_lignes_qte_positive('lignes');

drop trigger if exists borner_paiement on public.paiements;
create trigger borner_paiement
  before insert or update of montant, facture_id on public.paiements
  for each row execute function public.trg_borner_paiement();
