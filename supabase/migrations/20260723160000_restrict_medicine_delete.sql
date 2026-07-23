-- ============================================================================
-- Sequence 0 data-loss containment: deleting a medicine must never destroy
-- its dose history.
-- ============================================================================
-- medicine_logs.medicine_id was created with ON DELETE CASCADE, so deleting a
-- medicine silently erased every dose ever logged for it — an unrecoverable
-- loss of the patient's medical record. Replace with ON DELETE RESTRICT.
--
-- The app's medicine-delete action is removed in the same release, so this
-- constraint is a backstop (e.g. against raw API calls), not a UI error path.
-- Proper archiving ("hide from schedule, keep all history") arrives with the
-- regimen-version model; until then medicines can be edited but not deleted.
DO $$
DECLARE
  con text;
BEGIN
  SELECT conname INTO con
  FROM pg_constraint
  WHERE conrelid = 'public.medicine_logs'::regclass
    AND confrelid = 'public.medicines'::regclass
    AND contype = 'f';
  IF con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.medicine_logs DROP CONSTRAINT %I', con);
  END IF;
  EXECUTE 'ALTER TABLE public.medicine_logs
             ADD CONSTRAINT medicine_logs_medicine_id_fkey
             FOREIGN KEY (medicine_id) REFERENCES public.medicines(id)
             ON DELETE RESTRICT';
END $$;
