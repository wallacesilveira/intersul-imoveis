/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Fotos dos imóveis: arquivo no Supabase Storage + linha em property_photos.
 * Caminho: {agency_id}/{property_id}/{uuid}.webp (o banco só aceita envio de quem pode editar o imóvel).
 * A capa é a foto de posição 0.
 */
import { supabase } from '../../shared/supabase-client.js';
import { storagePublicUrl } from '../../shared/supabase-rest.js';

const BUCKET = 'property-photos';
const MAX_SIDE = 1920;
const QUALITY = 0.82;
const unwrap = ({ data, error }) => { if (error) throw error; return data; };

export class PhotoError extends Error {}

export const photoUrl = (photo) => photo.external_url || storagePublicUrl(photo.storage_path);

/** Reduz a foto para no máximo 1920px no maior lado e converte para WebP (JPEG se o navegador não gerar WebP). */
async function resize(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new PhotoError(`"${file.name}" não pôde ser lida. Envie fotos em JPG, PNG ou WebP.`);
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d').drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const toBlob = (type) => new Promise((resolve) => canvas.toBlob(resolve, type, QUALITY));
  let blob = await toBlob('image/webp');
  if (!blob || blob.type !== 'image/webp') blob = await toBlob('image/jpeg');
  return blob;
}

export const photosRepository = {
  async list(propertyId) {
    return unwrap(await supabase
      .from('property_photos')
      .select('id, storage_path, external_url, position, created_at')
      .eq('property_id', propertyId)
      .order('position')
      .order('created_at'));
  },

  async upload(agencyId, propertyId, file, position) {
    const blob = await resize(file);
    const extension = blob.type === 'image/webp' ? 'webp' : 'jpg';
    const path = `${agencyId}/${propertyId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, blob, { contentType: blob.type, cacheControl: '31536000', upsert: false });
    if (uploadError) throw uploadError;
    const { error } = await supabase.from('property_photos').insert({ agency_id: agencyId, property_id: propertyId, storage_path: path, position });
    if (error) {
      await supabase.storage.from(BUCKET).remove([path]);
      throw error;
    }
    return { originalSize: file.size, finalSize: blob.size };
  },

  /** Grava a ordem atual (índice na lista = posição). Só atualiza as fotos que mudaram de lugar. */
  async saveOrder(photos) {
    const changes = photos.map((photo, index) => ({ photo, index })).filter(({ photo, index }) => photo.position !== index);
    const results = await Promise.all(changes.map(({ photo, index }) => supabase.from('property_photos').update({ position: index }).eq('id', photo.id).select('id')));
    for (const result of results) {
      if (result.error) throw result.error;
      if (!result.data.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
    }
  },

  async remove(photo) {
    const rows = unwrap(await supabase.from('property_photos').delete().eq('id', photo.id).select('id'));
    if (!rows.length) throw Object.assign(new Error('forbidden'), { code: '42501' });
    // O arquivo é apagado depois do registro; se falhar, sobra só um arquivo sem uso, sem afetar o site.
    if (photo.storage_path) {
      const { error } = await supabase.storage.from(BUCKET).remove([photo.storage_path]);
      if (error) console.warn('Arquivo não removido do storage', error);
    }
  },
};
