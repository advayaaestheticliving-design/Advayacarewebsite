alter table public.membership_recommendation_runs
  alter column model_provider set default 'gemini',
  alter column model_name set default 'gemini-2.0-flash';
