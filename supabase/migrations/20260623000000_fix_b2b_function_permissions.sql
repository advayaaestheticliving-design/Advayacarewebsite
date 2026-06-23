-- Fix permissions for B2B functions
grant usage on schema private to service_role;
grant execute on all functions in schema private to service_role;
