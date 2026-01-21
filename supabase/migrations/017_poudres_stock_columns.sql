-- Migration 017 : Ajout des colonnes de stock sur poudres
-- Appliquée via MCP le 2026-01-21

ALTER TABLE public.poudres
  ADD COLUMN IF NOT EXISTS stock_theorique_kg DECIMAL(10, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stock_reel_kg DECIMAL(10, 2) DEFAULT 0;
