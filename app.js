/*!
 * Intersul Imóveis — Plataforma
 * Desenvolvido por Wallace Silveira · linkedin.com/in/wallacesilveira
 * © 2026 Wallace Silveira. Todos os direitos reservados.
 */
import { config } from './config.js';
import { escapeHtml as esc, formatPhone, onlyDigits } from './shared/format.js';
import { areaLabel, priceLabel, priceRangeOptions } from './shared/property-model.js';
import { LeadError, leadRepository } from './shared/repositories/lead-repository.js';
import { propertyRepository } from './shared/repositories/property-repository.js';

const main = document.querySelector('#main-content');
const menuToggle = document.querySelector('.menu-toggle');
const mobileNav = document.querySelector('.mobile-nav');

const regionPrimary = ['Interlagos', 'Bolsão de Interlagos', 'Marajoara', 'Socorro', 'Veleiros', 'Jardim Suzana', 'Jardim Sabará', 'Miguel Yunes', 'Santo Amaro'];
const regionSecondary = ['Campo Grande', 'Jurubatuba', 'Cidade Dutra', 'Jardim Prudência', 'Vila Andrade', 'Chácara Flora', 'Alto da Boa Vista', 'Granja Julieta', 'Chácara Santo Amaro', 'Jardim dos Lagos', 'Jardim Ipanema', 'Vila São Paulo', 'Vila Castelo', 'Jardim Umuarama', 'Jardim Taquaral'];

const typeOptions = ['Casa', 'Apartamento', 'Terreno', 'Sala', 'Loja'];
// Rotas de busca → finalidade (null = venda e locação).
const searchRoutes = { '/comprar': 'sale', '/alugar': 'rent', '/imoveis': null };

const whatsappUrl = (text) => `https://wa.me/${config.contact.whatsapp}?text=${encodeURIComponent(text)}`;
const consentField = (id) => `<label class="consent" for="${id}"><input type="checkbox" id="${id}" name="consent" required><span>Autorizo a Intersul Imóveis a usar estes dados para entrar em contato sobre esta solicitação.</span></label>`;
// Campo-armadilha: invisível para pessoas; robôs costumam preenchê-lo e o envio é descartado.
const honeypotField = '<div class="hp-field" aria-hidden="true"><label>Não preencha este campo<input name="website" tabindex="-1" autocomplete="off"></label></div>';
const propertyUrl = (property) => `#/imovel/${encodeURIComponent(property.code)}`;
/** Faixas de preço da finalidade; sem finalidade, venda e locação em grupos separados. */
const priceOptions = (purpose, selected = '') => purpose ? selectOptions(priceRangeOptions(purpose), selected) : `<optgroup label="Venda">${selectOptions(priceRangeOptions('sale'), selected)}</optgroup><optgroup label="Locação">${selectOptions(priceRangeOptions('rent'), selected)}</optgroup>`;
const selectOptions = (options, selected = '') => options.map((option) => { const [value, label] = Array.isArray(option) ? option : [option, option]; return `<option${Array.isArray(option) ? ` value="${esc(value)}"` : ''}${value === selected ? ' selected' : ''}>${esc(label)}</option>`; }).join('');

function propertyCard(property, context = 'featured') {
  return `<article class="property-card"><a href="${propertyUrl(property)}"><img src="${esc(property.coverUrl)}" alt="${esc(property.title)}" loading="lazy"><div class="property-info"><div class="property-meta">${esc(property.typeLabel)} · ${esc(property.neighborhood)}</div><h3>${esc(property.title)}</h3><div class="property-meta">${property.bedrooms ? `${esc(property.bedrooms)} dormitórios · ` : ''}${property.parking ? `${esc(property.parking)} vagas · ` : ''}${esc(areaLabel(property))}</div><p class="property-price">${esc(priceLabel(property, context))}</p><span class="text-link">Ver imóvel</span></div></a></article>`;
}

function resultsMarkup(result, context) {
  return result.items.length ? result.items.map((property) => propertyCard(property, context)).join('') : '<p class="empty">Nenhum imóvel encontrado com estes filtros.</p>';
}

const searchPageText = {
  sale: { eyebrow: 'Compra', title: 'Imóveis para comprar', formPurpose: 'venda', cta: 'Tem um imóvel para vender?' },
  rent: { eyebrow: 'Locação', title: 'Imóveis para alugar', formPurpose: 'aluguel', cta: 'Tem um imóvel para alugar?' },
  all: { eyebrow: 'Compra e locação', title: 'Todos os imóveis', formPurpose: 'todos', cta: 'Tem um imóvel para vender ou alugar?' },
};

function propertySearchPage(purpose, params, result) {
  const text = searchPageText[purpose || 'all'];
  return `<section class="page-hero"><p class="eyebrow">${text.eyebrow} · Zona Sul de São Paulo</p><h1>${text.title}</h1><p>Uma seleção de imóveis para você encontrar o próximo endereço com clareza e tranquilidade.</p></section><section class="search-results"><form class="filter-bar" data-search-form data-purpose="${text.formPurpose}"><input name="location" placeholder="Código, bairro, cidade ou condomínio" aria-label="Código, bairro, cidade ou condomínio" value="${esc(params.get('location') || '')}"><select name="type" aria-label="Tipo de imóvel"><option value="">Todos os tipos</option>${selectOptions(typeOptions, params.get('type') || '')}</select><select name="price" aria-label="Faixa de preço"><option value="">Qualquer valor</option>${priceOptions(purpose, params.get('price') || '')}</select><button class="button button-dark" type="submit">Buscar</button></form><div class="property-grid" data-results>${resultsMarkup(result, purpose || 'featured')}</div><div class="search-cta"><p>${text.cta}</p><a class="text-link" href="#/cadastre-seu-imovel">Anuncie seu imóvel</a></div></section>`;
}

function formPage(kind) {
  const isSell = kind === 'sell';
  const title = isSell ? 'Quer anunciar seu imóvel?' : 'Cadastre seu imóvel';
  const intro = isSell ? 'Converse com a Intersul sobre o seu imóvel. Nossa atuação na Zona Sul começa com uma escuta cuidadosa do seu objetivo.' : 'Venda, alugue ou coloque seu imóvel sob administração da Intersul.';
  return `<section class="page-hero"><p class="eyebrow">Proprietários</p><h1>${title}</h1><p>${intro}</p></section><section class="form-layout"><div><h2>${isSell ? 'Uma conversa começa aqui.' : 'Seu imóvel, o próximo capítulo.'}</h2><p>Preencha os dados iniciais para que a equipe entenda como podemos ajudar.</p></div><form class="form-panel lead-form" data-lead-kind="owner_listing"><div class="form-grid"><div class="field"><label for="name">Nome</label><input id="name" name="name" required></div><div class="field"><label for="phone">Telefone</label><input id="phone" name="phone" required type="tel" inputmode="tel" maxlength="15" autocomplete="tel" placeholder="(11) 99999-9999"></div><div class="field"><label for="email">E-mail</label><input id="email" name="email" type="email"></div><div class="field"><label for="purpose">Objetivo</label><select id="purpose" name="purpose"><option>Quero vender</option><option>Quero alugar</option><option>Quero administrar</option><option>Ainda não tenho certeza</option></select></div><div class="field"><label for="type">Tipo do imóvel</label><input id="type" name="type" placeholder="Casa, apartamento, terreno..."></div><div class="field"><label for="city">Cidade</label><input id="city" name="city" placeholder="Cidade"></div><div class="field"><label for="address">Endereço</label><input id="address" name="address" placeholder="Nome da rua ou CEP" autocomplete="street-address" data-address-autocomplete></div><div class="field"><label for="number">Número</label><input id="number" name="number" placeholder="Número do imóvel" inputmode="numeric" autocomplete="address-line2"></div><div class="field field-full"><label for="complement">Complemento</label><input id="complement" name="complement" placeholder="Nº Apto - Bloco - Condomínio"></div><div class="field field-full"><label for="message">Mensagem</label><textarea id="message" name="message"></textarea></div>${consentField('consent')}</div>${honeypotField}<button class="button button-dark" type="submit">Enviar cadastro</button><p class="form-status" aria-live="polite"></p></form></section>`;
}

function featuredMarkup(items) {
  const [main, ...rest] = items;
  return `<div class="featured-layout"><div class="featured-main">${propertyCard(main)}</div><div class="featured-side">${rest.slice(0, 2).map((property) => propertyCard(property)).join('')}</div></div><div class="featured-mini-grid">${rest.slice(2, 8).map((property) => propertyCard(property)).join('')}</div>`;
}

function homeSearchPanel() {
  return `<section class="search-panel" aria-label="Busca de imóveis"><form class="search-panel-inner" data-home-search><div class="search-panel-heading"><p>Encontre seu próximo endereço</p><strong>Buscar imóveis</strong><div class="search-tabs"><button class="active" type="button" data-purpose="venda">Comprar</button><button type="button" data-purpose="aluguel">Alugar</button></div></div><div class="search-field"><label for="home-location">Localização</label><input id="home-location" name="location" placeholder="Código, bairro, cidade ou condomínio" aria-label="Código, bairro, cidade ou condomínio"></div><div class="search-field"><label for="home-type">Tipo de imóvel</label><select id="home-type" name="type"><option value="">Todos os tipos</option>${selectOptions(typeOptions)}</select></div><div class="search-field"><label for="home-price">Faixa de preço</label><select id="home-price" name="price"><option value="">Qualquer valor</option>${priceOptions('sale')}</select></div><button class="button button-dark" type="submit">Buscar</button></form></section>`;
}

function homePage(featured) {
  const featuredSection = featured.length ? `<section class="section featured-home"><div class="section-intro"><div><p class="eyebrow">Seleção Intersul</p><h2>Imóveis em destaque</h2></div><a class="text-link" href="#/imoveis">Ver todos os imóveis</a></div>${featuredMarkup(featured)}</section>` : '';
  return `<section class="hero"><div><p class="eyebrow">Desde 2005 · Zona Sul de São Paulo</p><h1>Um mundo de imóveis<br>para você.</h1><p class="hero-copy">Vinte anos de tradição em Interlagos e na Zona Sul, com uma nova forma de encontrar o seu próximo endereço.</p></div><div class="hero-visual"><img src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=88" alt="Casa contemporânea com fachada iluminada"><span class="hero-caption">Arquitetura · patrimônio · proximidade</span></div></section>${homeSearchPanel()}<section class="section"><div class="section-intro"><div><p class="eyebrow">Quatro caminhos</p><h2>O próximo passo começa por uma intenção.</h2></div><p>Escolha o caminho que faz sentido para você. A experiência foi desenhada para não misturar quem procura um imóvel com quem cuida de um patrimônio.</p></div><div class="path-grid"><div class="path"><span class="path-number">01</span><h3>Comprar</h3><p>Encontre imóveis na região que você conhece ou quer descobrir.</p><a class="text-link" href="#/comprar">Explorar imóveis</a></div><div class="path"><span class="path-number">02</span><h3>Alugar</h3><p>Uma busca mais clara para encontrar seu próximo endereço.</p><a class="text-link" href="#/alugar">Ver locações</a></div><div class="path"><span class="path-number">03</span><h3>Vender</h3><p>Converse com uma equipe que conhece o território.</p><a class="text-link" href="#/vender">Quero vender</a></div><div class="path"><span class="path-number">04</span><h3>Administrar</h3><p>Seu patrimônio em boas mãos, com um atendimento próximo.</p><a class="text-link" href="#/administracao-de-imoveis">Conhecer serviço</a></div></div></section>${featuredSection}<section class="section section-dark"><div class="territory"><div><p class="eyebrow">Território de marca</p><h2>Especialistas em Interlagos e região.</h2><p>Conhecemos a Zona Sul de São Paulo e a personalidade de cada território onde atuamos.</p></div><div class="territory-list">${regionPrimary.map((region) => `<a href="#/comprar?location=${encodeURIComponent(region)}">${region}</a>`).join('')}</div></div></section><section class="section"><div class="owner-band"><div><p class="eyebrow">Para proprietários</p><h2>Seu imóvel pode estar no próximo capítulo da Intersul.</h2></div><div class="owner-aside"><p>Venda, alugue ou coloque seu imóvel sob administração da Intersul.</p><a class="button button-dark" href="#/cadastre-seu-imovel">Anuncie seu imóvel</a></div></div><div class="stats"><div class="stat"><strong>2005</strong><span>ano de fundação</span></div><div class="stat"><strong>+1.300</strong><span>imóveis no inventário institucional</span></div><div class="stat"><strong>19.777-J</strong><span>CRECI</span></div></div></section>`;
}

function aboutPage() { return `<section class="page-hero"><p class="eyebrow">A Intersul</p><h1>Experiência local para decisões importantes.</h1><p>A Intersul Imóveis atua em São Paulo desde 2005, com forte presença em Interlagos e na Zona Sul.</p></section><section class="section"><div class="territory"><div><p class="eyebrow">Conhecimento e proximidade</p><h2>Um atendimento imobiliário próximo.</h2></div><div><p>Compra, venda, locação e administração de imóveis fazem parte da atuação da Intersul.</p><p class="notice">CRECI 19.777-J · Av. Atlântica, 1893 - Interlagos, São Paulo - SP</p></div></div></section>`; }

function administrationPage() { return `<section class="page-hero"><p class="eyebrow">Administração de imóveis</p><h1>Seu patrimônio em boas mãos.</h1><p>A Intersul conversa com proprietários que desejam contar com uma imobiliária experiente para a administração de seus imóveis.</p><div class="hero-actions"><a class="button button-dark" href="#/cadastre-seu-imovel">Quero administrar meu imóvel</a><a class="button button-outline" href="#/cadastre-seu-imovel">Anuncie seu imóvel</a></div></section><section class="section"><div class="territory"><div><p class="eyebrow">Um atendimento próximo</p><h2>Mais tranquilidade para quem possui um imóvel.</h2></div><div><p>A administração começa por entender o imóvel, o momento do proprietário e o tipo de acompanhamento necessário. A equipe da Intersul orientará os próximos passos em uma conversa direta.</p><div class="notice">[DETALHAR SERVIÇOS DE ADMINISTRAÇÃO]</div></div></div></section><section class="section section-dark"><div class="owner-band"><div><p class="eyebrow">Vamos conversar</p><h2>Conte à Intersul sobre o seu patrimônio.</h2></div><div class="owner-aside"><p>O cadastro inicial foi preparado para receber o fluxo oficial de atendimento.</p><a class="button button-outline" style="border-color:white;color:white" href="#/cadastre-seu-imovel">Anuncie seu imóvel</a></div></div></section>`; }

function detailPage(property) {
  if (!property) return `<section class="page-hero"><p class="eyebrow">Imóvel</p><h1>Imóvel não encontrado.</h1><p>Este imóvel pode ter sido vendido, alugado ou retirado do site.</p><div class="hero-actions"><a class="button button-dark" href="#/comprar">Ver imóveis à venda</a><a class="button button-outline" href="#/alugar">Ver imóveis para alugar</a></div></section>`;
  const offers = [property.forSale && 'À venda', property.forRent && 'Para locação'].filter(Boolean).join(' · ');
  const rentAlsoLine = property.forSale && property.forRent ? `<p>Locação: ${esc(priceLabel(property, 'rent'))}</p>` : '';
  const description = property.description.split(/\n{2,}/).filter((paragraph) => paragraph.trim()).map((paragraph, index) => `<p${index === 0 ? ' style="margin-top:30px"' : ''}>${esc(paragraph.trim()).replace(/\n/g, '<br>')}</p>`).join('');
  return `<section class="page-hero"><p class="eyebrow">${esc(property.typeLabel)} · ${esc(property.neighborhood)}</p><h1>${esc(property.title)}</h1><p>${esc(property.city)} · Código ${esc(property.code)}</p></section><section class="detail-grid"><img class="detail-image" src="${esc(property.coverUrl)}" alt="${esc(property.title)}"><div class="detail-content"><div><p class="eyebrow">${offers}</p><h2>${esc(priceLabel(property))}</h2>${rentAlsoLine}<div class="details-list"><span>${esc(property.bedrooms || 'A confirmar')} dormitórios</span><span>${esc(property.suites || 'A confirmar')} suítes</span><span>${esc(property.parking || 'A confirmar')} vagas</span><span>${esc(areaLabel(property))}</span></div>${description}</div><aside class="detail-sidebar"><h3>Tenho interesse</h3><p>Fale com a equipe da Intersul sobre este imóvel.</p>${interestForm(property)}</aside></div></section>`;
}

function interestForm(property) {
  return `<form class="interest-form lead-form" data-lead-kind="property_interest" data-property-code="${esc(property.code)}" data-property-title="${esc(property.title)}"><div class="field"><label for="interest-name">Nome</label><input id="interest-name" name="name" autocomplete="name" required></div><div class="field"><label for="interest-phone">Telefone / WhatsApp</label><input id="interest-phone" name="phone" type="tel" inputmode="tel" maxlength="15" autocomplete="tel" placeholder="(11) 99999-9999" required></div><div class="field"><label for="interest-email">E-mail (opcional)</label><input id="interest-email" name="email" type="email" autocomplete="email"></div><div class="field"><label for="interest-message">Mensagem</label><textarea id="interest-message" name="message">Olá! Tenho interesse no imóvel ${esc(property.code)}.</textarea></div>${consentField('interest-consent')}${honeypotField}<button class="button button-dark" type="submit">Enviar interesse</button><p class="form-status" aria-live="polite"></p></form>`;
}

function interestSuccess(form, name) {
  const { propertyCode, propertyTitle } = form.dataset;
  const text = `Olá! Meu nome é ${name}. Tenho interesse no imóvel ${propertyCode} (${propertyTitle}).`;
  return `<div class="interest-success"><p class="form-status" role="status">Recebemos seu interesse. A equipe da Intersul entrará em contato em breve.</p><a class="button button-whatsapp" href="${esc(whatsappUrl(text))}" target="_blank" rel="noreferrer">Continuar no WhatsApp</a></div>`;
}

function ownerListingDetails(data) {
  return { purpose: data.purpose, property_type: data.type, city: data.city, address: data.address, address_number: data.number, address_complement: data.complement };
}

async function submitLead(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const status = form.querySelector('.form-status');
  const button = form.querySelector('button[type="submit"]');
  const data = Object.fromEntries(new FormData(form));
  const kind = form.dataset.leadKind;
  const showError = (message) => { status.textContent = message; status.classList.add('is-error'); };
  status.textContent = '';
  status.classList.remove('is-error');
  if (onlyDigits(data.phone).length < 10) { showError('Informe um telefone com DDD.'); form.elements.phone.focus(); return; }
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Enviando...';
  try {
    await leadRepository.submit({ kind, name: data.name, phone: data.phone, email: data.email, message: data.message, propertyCode: form.dataset.propertyCode, details: kind === 'owner_listing' ? ownerListingDetails(data) : undefined, consent: data.consent === 'on', website: data.website });
    if (kind === 'property_interest') { form.outerHTML = interestSuccess(form, data.name.trim()); return; }
    form.reset();
    status.textContent = 'Recebemos seus dados. A equipe da Intersul entrará em contato.';
  } catch (error) {
    showError(error instanceof LeadError ? error.message : 'Não foi possível enviar agora. Tente novamente ou fale com a Intersul pelo WhatsApp.');
  } finally {
    button.disabled = false;
    button.textContent = label;
  }
}

function errorPage() { return `<section class="page-hero"><p class="eyebrow">Imóveis</p><h1>Não foi possível carregar os imóveis.</h1><p>Tente novamente em instantes ou fale com a Intersul pelo telefone (11) 5521-7444.</p></section>`; }

async function pageFor(path, params) {
  if (path in searchRoutes) {
    const purpose = searchRoutes[path];
    const result = await propertyRepository.search({ purpose: purpose || undefined, text: params.get('location') || '', type: params.get('type') || '', priceRange: params.get('price') || '' });
    return propertySearchPage(purpose, params, result);
  }
  if (path === '/vender') return formPage('sell');
  if (path === '/cadastre-seu-imovel') return formPage('register');
  if (path === '/administracao-de-imoveis') return administrationPage();
  if (path === '/sobre-a-intersul') return aboutPage();
  if (path.startsWith('/imovel/')) return detailPage(await propertyRepository.getByCode(decodeURIComponent(path.split('/')[2] || '')));
  return homePage(await propertyRepository.listFeatured(9));
}

let renderToken = 0;
async function render() {
  const token = ++renderToken;
  const [path, query] = window.location.hash.replace(/^#/, '').split('?');
  let html;
  try { html = await pageFor(path || '/', new URLSearchParams(query)); } catch (error) { console.error(error); html = errorPage(); }
  if (token !== renderToken) return; // o usuário já navegou para outra página
  main.innerHTML = html;
  bindInteractions();
  enhanceOwnerForm();
  window.scrollTo(0, 0);
}

function bindInteractions() { document.querySelectorAll('.lead-form').forEach((form) => form.addEventListener('submit', submitLead)); document.querySelectorAll('[data-search-form]').forEach((form) => form.addEventListener('submit', (event) => { event.preventDefault(); const params = new URLSearchParams(new FormData(form)); window.location.hash = `${window.location.hash.split('?')[0]}?${params.toString()}`; })); const homeSearch = document.querySelector('[data-home-search]'); if (homeSearch) { homeSearch.querySelectorAll('[data-purpose]').forEach((tab) => tab.addEventListener('click', () => { homeSearch.dataset.purpose = tab.dataset.purpose; homeSearch.querySelectorAll('[data-purpose]').forEach((item) => item.classList.toggle('active', item === tab)); homeSearch.price.innerHTML = `<option value="">Qualquer valor</option>${priceOptions(tab.dataset.purpose === 'aluguel' ? 'rent' : 'sale')}`; })); homeSearch.addEventListener('submit', (event) => { event.preventDefault(); const params = new URLSearchParams(new FormData(homeSearch)); window.location.hash = `/${homeSearch.dataset.purpose === 'aluguel' ? 'alugar' : 'comprar'}?${params.toString()}`; }); } }
function initializeGoogleAddressAutocomplete(address) { if (!address || address.dataset.googleAutocomplete || !window.google?.maps?.places?.Autocomplete) return; new window.google.maps.places.Autocomplete(address, { types: ['address'], componentRestrictions: { country: 'br' } }); address.dataset.googleAutocomplete = 'true'; }
function initializeAddressSuggestions(address) { if (!address || address.dataset.suggestionsReady || window.google?.maps?.places?.Autocomplete) return; const listId = 'address-suggestions'; let datalist = document.getElementById(listId); if (!datalist) { datalist = document.createElement('datalist'); datalist.id = listId; document.body.appendChild(datalist); } address.setAttribute('list', listId); address.dataset.suggestionsReady = 'true'; let timer; address.addEventListener('input', () => { clearTimeout(timer); const query = address.value.trim(); if (query.length < 3) { datalist.replaceChildren(); return; } timer = setTimeout(async () => { try { const response = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&countrycodes=br&limit=6&addressdetails=1&q=${encodeURIComponent(query)}`); if (!response.ok) return; const results = await response.json(); datalist.replaceChildren(...results.map((result) => { const option = document.createElement('option'); option.value = result.display_name; return option; })); } catch (error) { datalist.replaceChildren(); } }, 300); }); }
function initializeCepLookup(address, city) { if (!address || !city || address.dataset.cepLookup) return; address.dataset.cepLookup = 'true'; address.addEventListener('input', async () => { const cep = address.value.replace(/\D/g, ''); if (cep.length !== 8) return; try { const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`); if (!response.ok) return; const result = await response.json(); if (result.erro) return; address.value = result.logradouro || ''; city.value = result.localidade || ''; address.dispatchEvent(new Event('change', { bubbles: true })); city.dispatchEvent(new Event('change', { bubbles: true })); } catch (error) { /* Keeps manual address entry available when the lookup is unavailable. */ } }); }
function enhanceOwnerForm() { document.querySelectorAll('input[type="tel"]').forEach((phone) => phone.addEventListener('input', () => { phone.value = formatPhone(phone.value); })); const address = document.querySelector('#address'); const city = document.querySelector('#city'); if (!address || !city) return; initializeGoogleAddressAutocomplete(address); initializeAddressSuggestions(address); initializeCepLookup(address, city); }
menuToggle.addEventListener('click', () => { const open = mobileNav.classList.toggle('is-open'); menuToggle.setAttribute('aria-expanded', String(open)); });
window.addEventListener('hashchange', render); render();
