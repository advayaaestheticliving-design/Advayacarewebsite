do $$
declare
  v_deleted_count integer := 0;
begin
  delete from public.member_comments;

  get diagnostics v_deleted_count = row_count;

  raise notice 'Cleared % member comment rows.', v_deleted_count;
end $$;