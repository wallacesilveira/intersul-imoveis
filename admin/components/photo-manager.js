/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/*
 * Gerenciador de fotos do imóvel: envio (vários arquivos, arrastar e soltar), ordem, capa e remoção.
 * Atualiza apenas a própria seção, para não descartar edições ainda não salvas no formulário do imóvel.
 */
import { alertBox, bindConfirmButton, errorMessage, esc } from '../lib/ui.js';
import { PhotoError, photoUrl, photosRepository } from '../repositories/photos.js';

const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp'];
const formatSize = (bytes) => (bytes >= 1048576 ? `${(bytes / 1048576).toFixed(1).replace('.', ',')} MB` : `${Math.round(bytes / 1024)} KB`);

export async function mountPhotoManager(container, { ctx, propertyId, canEdit }) {
  let photos = await photosRepository.list(propertyId);
  let busy = false;

  function render(message = '', kind = 'error') {
    const items = photos.map((photo, index) => `<li class="photo-item" data-index="${index}">
      <img src="${esc(photoUrl(photo))}" alt="Foto ${index + 1}" loading="lazy">
      <span class="photo-position">${index === 0 ? 'Capa' : index + 1}</span>
      ${canEdit ? `<div class="photo-actions">
        <button type="button" class="icon-button" data-move="-1" aria-label="Mover para a esquerda"${index === 0 ? ' disabled' : ''}>←</button>
        <button type="button" class="icon-button" data-move="1" aria-label="Mover para a direita"${index === photos.length - 1 ? ' disabled' : ''}>→</button>
        ${index > 0 ? '<button type="button" class="link-button" data-cover>Definir como capa</button>' : ''}
        <button type="button" class="link-button link-danger" data-remove>Remover</button>
      </div>` : ''}
    </li>`).join('');
    container.innerHTML = `<section class="card"><div class="section-head"><h2>Fotos <span class="muted">(${photos.length})</span></h2>${canEdit ? '<label class="btn btn-secondary"><input type="file" accept="image/jpeg,image/png,image/webp" multiple hidden data-file-input>Adicionar fotos</label>' : ''}</div>
      ${alertBox(message, kind)}
      ${photos.length ? `<ul class="photo-grid">${items}</ul>` : '<p class="muted">Nenhuma foto. Enquanto não houver fotos, o site mostra a imagem "Fotos em breve".</p>'}
      ${canEdit ? '<div class="drop-zone" data-drop>Arraste fotos para cá ou use "Adicionar fotos". JPG, PNG ou WebP — elas são otimizadas automaticamente.</div><p class="muted form-note">A primeira foto é a capa, usada nos cards e no topo da página do imóvel.</p>' : ''}
      <div class="upload-progress" data-progress hidden></div></section>`;
    if (canEdit) bind();
  }

  /** Executa uma ação (que devolve a mensagem de sucesso), recarrega as fotos e redesenha a seção. */
  async function run(action) {
    if (busy) return;
    busy = true;
    container.querySelectorAll('button, input').forEach((element) => { element.disabled = true; });
    try {
      const message = await action();
      photos = await photosRepository.list(propertyId);
      render(message || '', 'success');
    } catch (error) {
      photos = await photosRepository.list(propertyId).catch(() => photos);
      render(error instanceof PhotoError ? error.message : errorMessage(error));
    } finally {
      busy = false;
    }
  }

  async function upload(files) {
    const valid = [...files].filter((file) => ACCEPTED.includes(file.type));
    const skipped = files.length - valid.length;
    if (!valid.length) { render('Nenhum arquivo aceito. Envie fotos em JPG, PNG ou WebP.'); return; }
    await run(async () => {
      const progress = container.querySelector('[data-progress]');
      progress.hidden = false;
      let original = 0;
      let final = 0;
      const failures = [];
      for (const [index, file] of valid.entries()) {
        progress.innerHTML = `<div class="progress-bar"><span style="width:${Math.round((index / valid.length) * 100)}%"></span></div><p class="muted">Enviando ${index + 1} de ${valid.length}: ${esc(file.name)}</p>`;
        try {
          const sizes = await photosRepository.upload(ctx.agency.id, propertyId, file, photos.length + index);
          original += sizes.originalSize;
          final += sizes.finalSize;
        } catch (error) {
          failures.push(`${file.name}: ${error instanceof PhotoError ? error.message : errorMessage(error)}`);
        }
      }
      if (failures.length) throw new PhotoError(`Algumas fotos não foram enviadas. ${failures.join(' · ')}`);
      if (skipped) throw new PhotoError(`${valid.length} foto(s) enviada(s). ${skipped} arquivo(s) ignorado(s) por não serem JPG, PNG ou WebP.`);
      return `${valid.length} foto(s) enviada(s). Tamanho otimizado de ${formatSize(original)} para ${formatSize(final)}.`;
    });
  }

  function reorder(from, to) {
    const next = [...photos];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return run(async () => { await photosRepository.saveOrder(next); return to === 0 ? 'Capa atualizada.' : ''; });
  }

  function bind() {
    const input = container.querySelector('[data-file-input]');
    input.addEventListener('change', () => { if (input.files.length) upload(input.files); });
    const drop = container.querySelector('[data-drop]');
    drop.addEventListener('dragover', (event) => { event.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', (event) => { event.preventDefault(); drop.classList.remove('is-over'); if (event.dataTransfer.files.length) upload(event.dataTransfer.files); });
    container.querySelectorAll('.photo-item').forEach((item) => {
      const index = Number(item.dataset.index);
      item.querySelectorAll('[data-move]').forEach((button) => button.addEventListener('click', () => reorder(index, index + Number(button.dataset.move))));
      item.querySelector('[data-cover]')?.addEventListener('click', () => reorder(index, 0));
      bindConfirmButton(item.querySelector('[data-remove]'), () => run(async () => {
        await photosRepository.remove(photos[index]);
        const remaining = photos.filter((_, position) => position !== index);
        await photosRepository.saveOrder(remaining);
        return 'Foto removida.';
      }));
    });
  }

  render();
}
