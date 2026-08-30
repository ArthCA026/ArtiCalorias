-- =====================================================================
-- Data repair: 2026-08-28  Fix food entries materialized from templates
--                          with per-unit macros instead of totals
--
-- Bug: template macros are stored PER 1 PORTION, but the backend paths
-- that turn a template into a food entry (new-day auto-add and routine
-- quick-add) copied the macro fields verbatim while setting Quantity to
-- the template's DefaultQuantity. An auto-added "4 eggs" therefore held
-- one egg's calories. The code fix multiplies by DefaultQuantity
-- (FoodTemplateMath.ToEntry); this script repairs the rows already
-- written with the bug.
--
-- Scope: only entries that still EXACTLY carry their template's current
-- per-unit macros while Quantity = DefaultQuantity <> 1 — the bug's
-- unambiguous fingerprint. Entries the user has since edited (macros no
-- longer match) and entries created before the template was last edited
-- (they match neither fingerprint) are deliberately left untouched:
-- there is no safe way to reconstruct intent for those.
--
-- Day totals: intentionally NOT recomputed here. The dashboard endpoint
-- self-heals any drift between stored day totals and the entries by
-- rerunning the full recalculation pipeline (incl. weekly numbers) the
-- next time each affected day is viewed.
--
-- Idempotent: after the update the macros equal per-unit x quantity, so
-- the fingerprint no longer matches (unless every macro is 0, in which
-- case the update is a no-op anyway).
-- =====================================================================

SET XACT_ABORT ON;
BEGIN TRANSACTION;

-- Preview the rows about to be repaired (kept in the output for audit).
SELECT
    e.FoodEntryId,
    e.FoodName,
    e.Quantity,
    e.CaloriesKcal      AS OldCaloriesKcal,
    ROUND(t.CaloriesKcal * t.DefaultQuantity, 2) AS NewCaloriesKcal,
    dl.LogDate
FROM app.FoodEntry e
JOIN app.FoodTemplate t ON t.FoodTemplateId = e.FoodTemplateId
JOIN app.DailyLog dl    ON dl.DailyLogId = e.DailyLogId
WHERE t.DefaultQuantity > 0
  AND t.DefaultQuantity <> 1
  AND e.Quantity = t.DefaultQuantity
  AND e.CaloriesKcal = t.CaloriesKcal
  AND e.ProteinGrams = t.ProteinGrams
  AND e.FatGrams = t.FatGrams
  AND e.CarbsGrams = t.CarbsGrams
  AND e.AlcoholGrams = t.AlcoholGrams
  AND (e.SugarGrams = t.SugarGrams OR (e.SugarGrams IS NULL AND t.SugarGrams IS NULL))
  AND (e.WaterMl = t.WaterMl OR (e.WaterMl IS NULL AND t.WaterMl IS NULL))
  -- All-zero macros: multiplying changes nothing; skip to keep the run clean.
  AND (t.CaloriesKcal <> 0 OR t.ProteinGrams <> 0 OR t.FatGrams <> 0
       OR t.CarbsGrams <> 0 OR t.AlcoholGrams <> 0);

UPDATE e
SET e.CaloriesKcal = ROUND(t.CaloriesKcal * t.DefaultQuantity, 2),
    e.ProteinGrams = ROUND(t.ProteinGrams * t.DefaultQuantity, 2),
    e.FatGrams     = ROUND(t.FatGrams     * t.DefaultQuantity, 2),
    e.CarbsGrams   = ROUND(t.CarbsGrams   * t.DefaultQuantity, 2),
    e.AlcoholGrams = ROUND(t.AlcoholGrams * t.DefaultQuantity, 2),
    e.SugarGrams   = ROUND(t.SugarGrams   * t.DefaultQuantity, 2),  -- NULL stays NULL
    e.WaterMl      = ROUND(t.WaterMl      * t.DefaultQuantity, 2),  -- NULL stays NULL
    e.UpdatedAtUtc = SYSUTCDATETIME()
FROM app.FoodEntry e
JOIN app.FoodTemplate t ON t.FoodTemplateId = e.FoodTemplateId
WHERE t.DefaultQuantity > 0
  AND t.DefaultQuantity <> 1
  AND e.Quantity = t.DefaultQuantity
  AND e.CaloriesKcal = t.CaloriesKcal
  AND e.ProteinGrams = t.ProteinGrams
  AND e.FatGrams = t.FatGrams
  AND e.CarbsGrams = t.CarbsGrams
  AND e.AlcoholGrams = t.AlcoholGrams
  AND (e.SugarGrams = t.SugarGrams OR (e.SugarGrams IS NULL AND t.SugarGrams IS NULL))
  AND (e.WaterMl = t.WaterMl OR (e.WaterMl IS NULL AND t.WaterMl IS NULL))
  AND (t.CaloriesKcal <> 0 OR t.ProteinGrams <> 0 OR t.FatGrams <> 0
       OR t.CarbsGrams <> 0 OR t.AlcoholGrams <> 0);

PRINT CONCAT('Repaired food entries: ', @@ROWCOUNT);

COMMIT TRANSACTION;
