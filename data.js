/* Repository boundary: replace this adapter with the official IMOBZI integration later. */
const propertyRepository = {
  source: 'mock-demo',
  async search(filters = {}) {
    const items = demoProperties.filter((property) => {
      const purposeMatches = !filters.purpose || property.purpose === filters.purpose;
      const location = [property.id, property.code, property.title, property.condominium, property.neighborhood, property.city].filter(Boolean).join(' ').toLowerCase();
      const locationMatches = !filters.location || location.includes(filters.location.toLowerCase());
      const typeMatches = !filters.type || property.type.toLowerCase().includes(filters.type.toLowerCase());
      return purposeMatches && locationMatches && typeMatches;
    });
    return { items, total: items.length, page: 1, pageSize: items.length, hasNextPage: false };
  },
  async getById(id) { return demoProperties.find((property) => property.id === id); }
};

const demoProperties = [
  { id: 'demo-01', title: 'Casa contemporânea junto ao verde de Interlagos', type: 'Casa', purpose: 'venda', city: 'São Paulo', neighborhood: 'Interlagos', price: 'R$ 2.800.000', bedrooms: 4, suites: 2, parking: 4, area: '471 m²', image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-02', title: 'Casa térrea com jardim em Veleiros', type: 'Casa térrea', purpose: 'venda', city: 'São Paulo', neighborhood: 'Veleiros', price: 'R$ 1.200.000', bedrooms: 3, suites: 1, parking: 3, area: '125 m²', image: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-03', title: 'Apartamento iluminado no eixo de Santo Amaro', type: 'Apartamento', purpose: 'aluguel', city: 'São Paulo', neighborhood: 'Santo Amaro', price: 'R$ 4.200 / mês', bedrooms: 2, suites: 1, parking: 2, area: '92 m²', image: 'https://images.unsplash.com/photo-1600607688969-a5bfcd646154?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-04', title: 'Terreno para projeto em Interlagos', type: 'Terreno', purpose: 'venda', city: 'São Paulo', neighborhood: 'Interlagos', price: 'R$ 8.500.000', bedrooms: null, suites: null, parking: null, area: '2.072 m²', image: 'https://images.unsplash.com/photo-1500382017468-9049fed747ef?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-05', title: 'Sobrado contemporâneo no Bolsão', type: 'Sobrado', purpose: 'venda', city: 'São Paulo', neighborhood: 'Bolsão de Interlagos', price: 'R$ 2.450.000', bedrooms: 3, suites: 2, parking: 3, area: '310 m²', image: 'https://images.unsplash.com/photo-1600566753086-00f18fb6b3ea?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-06', title: 'Apartamento com varanda em Marajoara', type: 'Apartamento', purpose: 'aluguel', city: 'São Paulo', neighborhood: 'Marajoara', price: 'R$ 3.800 / mês', bedrooms: 2, suites: 1, parking: 1, area: '88 m²', image: 'https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-07', title: 'Sala comercial próxima a Santo Amaro', type: 'Sala comercial', purpose: 'aluguel', city: 'São Paulo', neighborhood: 'Santo Amaro', price: 'R$ 2.900 / mês', bedrooms: null, suites: null, parking: 2, area: '64 m²', image: 'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-08', title: 'Casa com quintal no Jardim Suzana', type: 'Casa', purpose: 'venda', city: 'São Paulo', neighborhood: 'Jardim Suzana', price: 'R$ 1.780.000', bedrooms: 3, suites: 1, parking: 3, area: '210 m²', image: 'https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1200&q=80' },
  { id: 'demo-09', title: 'Loja para locação em Socorro', type: 'Loja', purpose: 'aluguel', city: 'São Paulo', neighborhood: 'Socorro', price: 'R$ 7.000 / mês', bedrooms: null, suites: null, parking: 4, area: '140 m²', image: 'https://images.unsplash.com/photo-1497366811353-6870744d04b2?auto=format&fit=crop&w=1200&q=80' }
];
