-- A retry invalidates the previous worker so it cannot publish stale draft results.
ALTER TABLE studio_jobs ADD COLUMN worker_token uuid;
