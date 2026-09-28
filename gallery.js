/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
/* Galeria da página do imóvel: foto principal, setas, miniaturas e ampliação em tela cheia. */
import { escapeHtml as esc } from './shared/format.js';

let galleryPhotos = [];
let galleryTitle = '';

/** Imóvel com uma foto (ou nenhuma) mantém a imagem simples; com várias, ganha navegação e miniaturas. */
export function galleryMarkup(property, placeholder) {
  galleryPhotos = property.photos;
  galleryTitle = property.title;
  const photos = property.photos.length ? property.photos : [placeholder];
  const main = `<img class="detail-image" src="${esc(photos[0])}" alt="${esc(property.title)}"${property.photos.length ? ' data-gallery-open tabindex="0"' : ''}>`;
  if (photos.length === 1) return main;
  const thumbs = photos.map((url, index) => `<button type="button" class="gallery-thumb${index === 0 ? ' active' : ''}" data-gallery-index="${index}" aria-label="Ver foto ${index + 1}"><img src="${esc(url)}" alt="" loading="lazy"></button>`).join('');
  return `<div class="gallery"><div class="gallery-main">${main}<button class="gallery-nav gallery-prev" type="button" data-gallery-step="-1" aria-label="Foto anterior">‹</button><button class="gallery-nav gallery-next" type="button" data-gallery-step="1" aria-label="Próxima foto">›</button><span class="gallery-count" data-gallery-count>1 / ${photos.length}</span></div><div class="gallery-thumbs">${thumbs}</div></div>`;
}

export function bindGallery() {
  const main = document.querySelector('[data-gallery-open]');
  if (!main || !galleryPhotos.length) return;
  const total = galleryPhotos.length;
  let current = 0;
  const show = (index) => {
    current = (index + total) % total;
    main.src = galleryPhotos[current];
    const counter = document.querySelector('[data-gallery-count]');
    if (counter) counter.textContent = `${current + 1} / ${total}`;
    document.querySelectorAll('[data-gallery-index]').forEach((thumb) => thumb.classList.toggle('active', Number(thumb.dataset.galleryIndex) === current));
  };
  document.querySelectorAll('[data-gallery-step]').forEach((button) => button.addEventListener('click', () => show(current + Number(button.dataset.galleryStep))));
  document.querySelectorAll('[data-gallery-index]').forEach((thumb) => thumb.addEventListener('click', () => show(Number(thumb.dataset.galleryIndex))));
  const open = () => openLightbox(current, show, main);
  main.addEventListener('click', open);
  main.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); open(); } });
}

function openLightbox(start, onChange, returnFocus) {
  const total = galleryPhotos.length;
  let current = start;
  const box = document.createElement('div');
  box.className = 'lightbox';
  box.setAttribute('role', 'dialog');
  box.setAttribute('aria-modal', 'true');
  box.setAttribute('aria-label', `Fotos: ${galleryTitle}`);
  const navigation = total > 1 ? '<button class="lightbox-nav lightbox-prev" type="button" aria-label="Foto anterior">‹</button><button class="lightbox-nav lightbox-next" type="button" aria-label="Próxima foto">›</button>' : '';
  box.innerHTML = `<button class="lightbox-close" type="button" aria-label="Fechar">×</button>${navigation}<figure><img alt="${esc(galleryTitle)}"><figcaption></figcaption></figure>`;
  const image = box.querySelector('img');
  const caption = box.querySelector('figcaption');
  const show = (index) => {
    current = (index + total) % total;
    image.src = galleryPhotos[current];
    caption.textContent = total > 1 ? `${current + 1} / ${total}` : '';
    onChange(current);
  };
  const onKey = (event) => {
    if (event.key === 'Escape') close();
    if (event.key === 'ArrowLeft') show(current - 1);
    if (event.key === 'ArrowRight') show(current + 1);
  };
  function close() {
    box.remove();
    document.body.style.overflow = '';
    document.removeEventListener('keydown', onKey);
    window.removeEventListener('hashchange', close);
    returnFocus?.focus();
  }
  box.querySelector('.lightbox-close').addEventListener('click', close);
  box.querySelector('.lightbox-prev')?.addEventListener('click', () => show(current - 1));
  box.querySelector('.lightbox-next')?.addEventListener('click', () => show(current + 1));
  box.addEventListener('click', (event) => { if (event.target === box || event.target.tagName === 'FIGURE') close(); });
  // deslizar para os lados no celular
  let touchX = null;
  box.addEventListener('touchstart', (event) => { touchX = event.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', (event) => {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 50) show(current + (delta < 0 ? 1 : -1));
    touchX = null;
  });
  document.addEventListener('keydown', onKey);
  window.addEventListener('hashchange', close);
  document.body.append(box);
  document.body.style.overflow = 'hidden';
  show(start);
  box.querySelector('.lightbox-close').focus();
}
