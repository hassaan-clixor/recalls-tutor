ALTER TABLE webhook_events ADD COLUMN claim_token uuid;
ALTER TABLE webhook_events ADD COLUMN claim_until timestamptz;
