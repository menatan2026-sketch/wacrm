-- Insert-only guard for financial, audit and snapshot tables (DATABASE.md §1 "Immutability").
CREATE OR REPLACE FUNCTION mfg_forbid_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'table % is insert-only', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['quote_snapshots','audit_events','payment_transactions','order_status_history','routing_decisions']
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION mfg_forbid_mutation()', t || '_insert_only', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Ledger entries are insert-only, except attaching an entry to a payout statement exactly once.
CREATE OR REPLACE FUNCTION mfg_ledger_guard() RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'payout_ledger_entries is insert-only' USING ERRCODE = 'restrict_violation';
  END IF;
  IF OLD.statement_id IS NOT NULL
     OR (to_jsonb(NEW) - 'statement_id') <> (to_jsonb(OLD) - 'statement_id') THEN
    RAISE EXCEPTION 'payout_ledger_entries is insert-only' USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER payout_ledger_entries_guard BEFORE UPDATE OR DELETE ON payout_ledger_entries
  FOR EACH ROW EXECUTE FUNCTION mfg_ledger_guard();
--> statement-breakpoint
-- Keep updated_at honest regardless of which code path writes the row.
CREATE OR REPLACE FUNCTION mfg_touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT table_name FROM information_schema.columns
           WHERE table_schema = 'public' AND column_name = 'updated_at'
  LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION mfg_touch_updated_at()', t || '_touch', t);
  END LOOP;
END $$;
--> statement-breakpoint
-- Human-facing order numbers (MF-YY-NNNNNN) are never reused.
CREATE SEQUENCE IF NOT EXISTS order_number_seq START WITH 1001;
--> statement-breakpoint
CREATE SEQUENCE IF NOT EXISTS invoice_number_seq START WITH 10001;
