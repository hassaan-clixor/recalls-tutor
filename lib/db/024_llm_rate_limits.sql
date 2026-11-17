CREATE TABLE llm_model_rate_limits (
 model_name text PRIMARY KEY,
 window_started_at timestamptz NOT NULL,
 request_count integer NOT NULL CHECK(request_count>0)
);
