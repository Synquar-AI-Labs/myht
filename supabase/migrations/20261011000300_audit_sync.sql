-- Only the per-household ticker is published; no medical rows or raw deletes.
-- Defer the ticker lock until after data writes to avoid BP/feed lock inversion.
CREATE FUNCTION app_private.audit_and_bump() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE row_data jsonb; hid uuid; key text;
BEGIN
 row_data:=CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 hid:=CASE WHEN TG_TABLE_NAME='households' THEN (row_data->>'id')::uuid ELSE (row_data->>'household_id')::uuid END;
 key:=CASE WHEN TG_TABLE_NAME='household_members' THEN (row_data->>'household_id')||':'||(row_data->>'user_id') ELSE row_data->>'id' END;
 INSERT INTO public.audit_log(household_id,actor_user_id,table_name,row_key,action,old_row,new_row)
 VALUES(hid,auth.uid(),TG_TABLE_NAME,key,lower(TG_OP),CASE WHEN TG_OP<>'INSERT' THEN to_jsonb(OLD) END,CASE WHEN TG_OP<>'DELETE' THEN to_jsonb(NEW) END);
 INSERT INTO public.household_sync(household_id,table_name,seq,at) VALUES(hid,TG_TABLE_NAME,1,now())
 ON CONFLICT(household_id) DO UPDATE SET table_name=EXCLUDED.table_name,seq=public.household_sync.seq+1,at=now();
 RETURN NULL;
END $$;
CREATE FUNCTION app_private.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path='' AS $$
 BEGIN NEW.updated_at:=now(); RETURN NEW; END $$;
REVOKE ALL ON FUNCTION app_private.audit_and_bump(),app_private.set_updated_at() FROM PUBLIC,anon,authenticated;
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.health_records DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.medicines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.medicine_logs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.appointments DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.hospital_stays DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.custom_actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.custom_action_logs DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.bp_readings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.written_notes DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.audio_transcripts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.households DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.household_members DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.caregivers DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE CONSTRAINT TRIGGER audit_change AFTER INSERT OR UPDATE OR DELETE ON public.household_invites DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION app_private.audit_and_bump();
CREATE TRIGGER health_updated BEFORE UPDATE ON public.health_records FOR EACH ROW EXECUTE FUNCTION app_private.set_updated_at();
-- Replace any local default publication contents, rather than adding to them.
DO $$
DECLARE item record;
BEGIN
 FOR item IN SELECT schemaname,tablename FROM pg_catalog.pg_publication_tables WHERE pubname='supabase_realtime' LOOP
  EXECUTE format('ALTER PUBLICATION supabase_realtime DROP TABLE %I.%I',item.schemaname,item.tablename);
 END LOOP;
END $$;
ALTER PUBLICATION supabase_realtime ADD TABLE public.household_sync;
-- The ticker never needs old values; DEFAULT also avoids tenant metadata in deletes.
ALTER TABLE public.household_sync REPLICA IDENTITY DEFAULT;

