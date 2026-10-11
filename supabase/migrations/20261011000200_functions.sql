-- Atomic onboarding, invite lifecycle and readings.
CREATE FUNCTION public.create_household(p_care_recipient_name text,p_display_name text,p_timezone text DEFAULT 'America/Toronto') RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hid uuid;
BEGIN
 IF app_private.verified_email() IS NULL THEN RAISE EXCEPTION 'email_not_verified'; END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_catalog.pg_timezone_names WHERE name=p_timezone) THEN RAISE EXCEPTION 'invalid_timezone'; END IF;
 INSERT INTO public.households(care_recipient_name,timezone,created_by) VALUES(btrim(p_care_recipient_name),p_timezone,auth.uid()) RETURNING id INTO hid;
 INSERT INTO public.household_members VALUES(hid,auth.uid(),'admin',now());
 INSERT INTO public.caregivers(household_id,display_name,user_id) VALUES(hid,btrim(p_display_name),auth.uid());
 INSERT INTO public.household_sync(household_id,table_name) VALUES(hid,'households') ON CONFLICT(household_id) DO NOTHING;
 RETURN hid;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'already_in_household';
END $$;

CREATE FUNCTION public.pending_invite() RETURNS TABLE(invite_id uuid,care_recipient_name text,inviter_display_name text)
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
BEGIN
 IF app_private.verified_email() IS NULL THEN RAISE EXCEPTION 'email_not_verified'; END IF;
 RETURN QUERY SELECT i.id,h.care_recipient_name,c.display_name FROM public.household_invites i JOIN public.households h ON h.id=i.household_id LEFT JOIN public.caregivers c ON c.household_id=i.household_id AND c.user_id=i.invited_by
 WHERE i.email=app_private.verified_email() AND i.expires_at>now() AND i.accepted_at IS NULL AND i.revoked_at IS NULL ORDER BY i.created_at,i.id LIMIT 1;
END $$;

CREATE FUNCTION public.invite_member(p_email text,p_caregiver_id uuid DEFAULT NULL) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hid uuid; iid uuid; target_email text:=lower(btrim(p_email));
BEGIN
 SELECT household_id INTO hid FROM public.household_members WHERE user_id=auth.uid() AND role='admin';
 IF hid IS NULL THEN RAISE EXCEPTION 'admin_required'; END IF;
 IF target_email='' OR position('@' in target_email)=0 THEN RAISE EXCEPTION 'invalid_email'; END IF;
 IF EXISTS(SELECT 1 FROM public.household_members m JOIN auth.users u ON u.id=m.user_id WHERE m.household_id=hid AND lower(btrim(u.email))=target_email) THEN RAISE EXCEPTION 'already_member'; END IF;
 IF p_caregiver_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM public.caregivers WHERE id=p_caregiver_id AND household_id=hid AND is_active AND user_id IS NULL) THEN RAISE EXCEPTION 'invalid_caregiver'; END IF;
 INSERT INTO public.household_invites(household_id,email,caregiver_id,invited_by)
 VALUES(hid,target_email,p_caregiver_id,auth.uid())
 ON CONFLICT(household_id,email) WHERE accepted_at IS NULL AND revoked_at IS NULL
 DO UPDATE SET expires_at=now()+interval '14 days',caregiver_id=EXCLUDED.caregiver_id
 RETURNING id INTO iid;
 RETURN iid;
END $$;

CREATE FUNCTION public.accept_invite(p_invite_id uuid,p_display_name text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv public.household_invites; cid uuid;
BEGIN
 IF app_private.verified_email() IS NULL THEN RAISE EXCEPTION 'email_not_verified'; END IF;
 SELECT * INTO inv FROM public.household_invites WHERE id=p_invite_id FOR UPDATE;
 IF NOT FOUND OR inv.email<>app_private.verified_email() OR inv.expires_at<=now() OR inv.accepted_at IS NOT NULL OR inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_unavailable'; END IF;
 BEGIN
  INSERT INTO public.household_members VALUES(inv.household_id,auth.uid(),inv.role,now());
 EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'already_in_household'; END;
 IF inv.caregiver_id IS NOT NULL THEN
  SELECT id INTO cid FROM public.caregivers WHERE id=inv.caregiver_id AND household_id=inv.household_id AND is_active AND user_id IS NULL FOR UPDATE;
 END IF;
 IF cid IS NOT NULL THEN
  UPDATE public.caregivers SET user_id=auth.uid() WHERE id=cid;
 ELSE
  SELECT id INTO cid FROM public.caregivers WHERE household_id=inv.household_id AND user_id=auth.uid() FOR UPDATE;
  IF cid IS NOT NULL THEN UPDATE public.caregivers SET is_active=true,display_name=btrim(p_display_name) WHERE id=cid;
  ELSE INSERT INTO public.caregivers(household_id,display_name,user_id) VALUES(inv.household_id,btrim(p_display_name),auth.uid()); END IF;
 END IF;
 UPDATE public.household_invites SET accepted_at=now(),accepted_by=auth.uid() WHERE id=inv.id;
 RETURN inv.household_id;
EXCEPTION WHEN unique_violation THEN RAISE EXCEPTION 'name_taken';
END $$;

CREATE FUNCTION public.revoke_invite(p_invite_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE inv public.household_invites;
BEGIN
 SELECT * INTO inv FROM public.household_invites WHERE id=p_invite_id FOR UPDATE;
 IF NOT FOUND OR NOT app_private.is_admin(inv.household_id) THEN RAISE EXCEPTION 'admin_required'; END IF;
 IF inv.accepted_at IS NOT NULL THEN RAISE EXCEPTION 'invite_already_accepted'; END IF;
 UPDATE public.household_invites SET revoked_at=now() WHERE id=inv.id;
END $$;

CREATE FUNCTION public.remove_member(p_user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path='' AS $$
DECLARE hid uuid;
BEGIN
 SELECT household_id INTO hid FROM public.household_members WHERE user_id=auth.uid() AND role='admin';
 IF hid IS NULL THEN RAISE EXCEPTION 'admin_required'; END IF;
 IF p_user_id=auth.uid() THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;
 IF NOT EXISTS(SELECT 1 FROM public.household_members WHERE household_id=hid AND user_id=p_user_id) THEN RAISE EXCEPTION 'member_not_found'; END IF;
 DELETE FROM public.household_members WHERE household_id=hid AND user_id=p_user_id;
 UPDATE public.caregivers SET is_active=false WHERE household_id=hid AND user_id=p_user_id;
END $$;

CREATE FUNCTION public.household_people() RETURNS TABLE(caregiver_id uuid,display_name text,is_active boolean,user_id uuid,role text,email text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path='' AS $$
 SELECT c.id,c.display_name,c.is_active,c.user_id,m.role,u.email::text
 FROM public.caregivers c JOIN public.household_members me ON me.household_id=c.household_id AND me.user_id=auth.uid()
 LEFT JOIN public.household_members m ON m.household_id=c.household_id AND m.user_id=c.user_id
 LEFT JOIN auth.users u ON u.id=m.user_id
$$;

CREATE FUNCTION public.log_reading(p_household_id uuid,p_date date,p_feed_bags integer DEFAULT 0,p_bile_bags integer DEFAULT 0,p_stool_count integer DEFAULT 0,p_vomit_count integer DEFAULT 0,p_urine_count integer DEFAULT 0,p_flush_ml integer DEFAULT 0,p_flush_count integer DEFAULT 0,p_weight numeric DEFAULT NULL,p_caregiver_id uuid DEFAULT NULL,p_recorded_by text DEFAULT '') RETURNS public.health_records
LANGUAGE sql SECURITY INVOKER SET search_path='' AS $$
 INSERT INTO public.health_records(household_id,date,feed_bags,bile_bags,stool_count,vomit_count,urine_count,flush_ml,flush_count,weight,caregiver_id,recorded_by,stool_passed,vomiting)
 VALUES(p_household_id,p_date,greatest(0,coalesce(p_feed_bags,0)),greatest(0,coalesce(p_bile_bags,0)),greatest(0,coalesce(p_stool_count,0)),greatest(0,coalesce(p_vomit_count,0)),greatest(0,coalesce(p_urine_count,0)),greatest(0,coalesce(p_flush_ml,0)),greatest(0,coalesce(p_flush_count,0)),coalesce(p_weight,0),p_caregiver_id,p_recorded_by,coalesce(p_stool_count,0)>0,coalesce(p_vomit_count,0)>0)
 ON CONFLICT(household_id,date) DO UPDATE SET
 feed_bags=greatest(0,public.health_records.feed_bags+coalesce(p_feed_bags,0)),
 bile_bags=greatest(0,public.health_records.bile_bags+coalesce(p_bile_bags,0)),
 stool_count=greatest(0,public.health_records.stool_count+coalesce(p_stool_count,0)),
 vomit_count=greatest(0,public.health_records.vomit_count+coalesce(p_vomit_count,0)),
 urine_count=greatest(0,public.health_records.urine_count+coalesce(p_urine_count,0)),
 flush_ml=greatest(0,public.health_records.flush_ml+coalesce(p_flush_ml,0)),
 flush_count=greatest(0,public.health_records.flush_count+coalesce(p_flush_count,0)),
 weight=coalesce(p_weight,public.health_records.weight),
 stool_passed=CASE WHEN coalesce(p_stool_count,0)<>0 THEN greatest(0,public.health_records.stool_count+coalesce(p_stool_count,0))>0 ELSE public.health_records.stool_passed END,
 vomiting=CASE WHEN coalesce(p_vomit_count,0)<>0 THEN greatest(0,public.health_records.vomit_count+coalesce(p_vomit_count,0))>0 ELSE public.health_records.vomiting END,
 caregiver_id=p_caregiver_id,recorded_by=p_recorded_by
 RETURNING *
$$;
CREATE FUNCTION public.log_bp_reading(p_household_id uuid,p_date date,p_systolic integer,p_diastolic integer,p_caregiver_id uuid,p_recorded_by text) RETURNS public.bp_readings
LANGUAGE plpgsql SECURITY INVOKER SET search_path='' AS $$
DECLARE reading public.bp_readings; sys integer; dia integer;
BEGIN
 IF NOT app_private.is_member(p_household_id) THEN RAISE EXCEPTION 'household_access_denied'; END IF;
 PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(p_household_id::text||':'||p_date::text,0));
 INSERT INTO public.bp_readings(household_id,date,systolic,diastolic,caregiver_id,recorded_by)
 VALUES(p_household_id,p_date,p_systolic,p_diastolic,p_caregiver_id,p_recorded_by) RETURNING * INTO reading;
 SELECT round(avg(systolic))::integer,round(avg(diastolic))::integer INTO sys,dia FROM public.bp_readings WHERE household_id=p_household_id AND date=p_date;
 INSERT INTO public.health_records(household_id,date,bp_systolic,bp_diastolic,caregiver_id,recorded_by)
 VALUES(p_household_id,p_date,sys,dia,p_caregiver_id,p_recorded_by)
 ON CONFLICT(household_id,date) DO UPDATE SET bp_systolic=EXCLUDED.bp_systolic,bp_diastolic=EXCLUDED.bp_diastolic,caregiver_id=EXCLUDED.caregiver_id,recorded_by=EXCLUDED.recorded_by;
 RETURN reading;
END $$;
-- Default hosted privileges must not reopen these RPCs.
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.create_household(text,text,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pending_invite() TO authenticated;
GRANT EXECUTE ON FUNCTION public.invite_member(text,uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.revoke_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.household_people() TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_reading(uuid,date,integer,integer,integer,integer,integer,integer,integer,numeric,uuid,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_bp_reading(uuid,date,integer,integer,uuid,text) TO authenticated;

