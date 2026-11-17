-- Legacy attempts remain unverified; the app records confirmed blueprints for new complete papers.
ALTER TABLE practice_attempts ADD COLUMN blueprint_snapshot jsonb;
