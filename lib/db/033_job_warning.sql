-- A job that may have dropped recalls says so: the AI hit the per-job draft cap, or drafts failed validation.
ALTER TABLE studio_jobs ADD COLUMN warning text;
