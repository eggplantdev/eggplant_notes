-- Cluster roles for disaster recovery — the one layer the read-only backup_ro
-- role CANNOT dump itself (pg_dumpall --roles-only needs SET ROLE postgres, which
-- backup_ro is denied). So this is committed as a near-static baseline and bundled
-- with every backup (scripts/db-dump.sh + .github/workflows/db-backup.yml).
--
-- Regenerate ONLY if cluster roles change, from a machine whose Supabase CLI is
-- logged in (the role dump needs the privileged --linked path):
--   supabase db dump --linked -f supabase/roles.sql --role-only
-- The pre-push hook (db-push-safe.sh) also captures a fresh roles.sql into
-- backups/<ts>/ before every prod migration, so drift is bounded.

SET default_transaction_read_only = off;

SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;

CREATE ROLE "backup_ro";
ALTER ROLE "backup_ro" WITH INHERIT NOCREATEROLE NOCREATEDB LOGIN BYPASSRLS;

ALTER ROLE "anon" SET "statement_timeout" TO '3s';

ALTER ROLE "authenticated" SET "statement_timeout" TO '8s';

ALTER ROLE "authenticator" SET "statement_timeout" TO '8s';

ALTER ROLE "supabase_admin" SET "statement_timeout" TO '0';

GRANT "pg_read_all_data" TO "backup_ro" WITH INHERIT TRUE GRANTED BY "postgres";

RESET ALL;
