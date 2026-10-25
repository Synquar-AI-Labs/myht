-- Add places without changing contacts' family policy, grants or audit behaviour.
ALTER TABLE public.contacts
 DROP CONSTRAINT contacts_kind_check,
 ADD CONSTRAINT contacts_kind_check CHECK (kind IN ('emergency','doctor','caretaker','hospital','other'));
