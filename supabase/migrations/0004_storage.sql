/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */

-- 0004 · Fotos dos imóveis no Supabase Storage.
--
-- Caminho dos arquivos: {agency_id}/{property_id}/{nome-do-arquivo}
-- Leitura pública (fotos de imóveis são exibidas no site); envio, troca e exclusão
-- somente por quem pode editar o imóvel.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('property-photos', 'property-photos', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create function app.can_edit_property_path(p_name text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_folders text[] := storage.foldername(p_name);
  v_uuid constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
begin
  if coalesce(array_length(v_folders, 1), 0) <> 2 or v_folders[1] !~ v_uuid or v_folders[2] !~ v_uuid then
    return false;
  end if;
  return exists (select 1 from public.properties p
                  where p.id = v_folders[2]::uuid and p.agency_id = v_folders[1]::uuid)
     and app.can_edit_property(v_folders[2]::uuid);
end $$;

revoke all on function app.can_edit_property_path(text) from public, anon;
grant execute on function app.can_edit_property_path(text) to authenticated;

create policy "property photos: upload" on storage.objects for insert to authenticated
  with check (bucket_id = 'property-photos' and app.can_edit_property_path(name));

create policy "property photos: update" on storage.objects for update to authenticated
  using (bucket_id = 'property-photos' and app.can_edit_property_path(name))
  with check (bucket_id = 'property-photos' and app.can_edit_property_path(name));

create policy "property photos: delete" on storage.objects for delete to authenticated
  using (bucket_id = 'property-photos' and app.can_edit_property_path(name));
