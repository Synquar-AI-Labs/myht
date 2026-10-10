-- Hosted default privileges grant anon EXECUTE directly; revoking PUBLIC
-- alone does not remove that grant on this SECURITY DEFINER function.
REVOKE EXECUTE ON FUNCTION public.is_allowed_user() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_allowed_user() TO authenticated;
