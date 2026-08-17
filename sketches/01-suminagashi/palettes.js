/**
 * palettes.js — six ink boxes.
 *
 * Colours are borrowed from the traditional Japanese names (和色) that suit
 * this technique: sumi black on unbleached paper is the classic, the rest are
 * the dyes a marbler would plausibly have had on the shelf next to it.
 *
 * `clear` is the ring made by touching the water with a surfactant-loaded
 * brush instead of ink: it carries no pigment, so it reads as the paper
 * itself. It is given a faint tint of its own because in practice the water
 * never leaves the sheet perfectly clean.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'sumi',
      name: '墨',
      roman: 'SUMI',
      note: 'lampblack on unbleached paper',
      paper: '#EDE6D6',
      clear: '#E8E0CE',
      inks: ['#16130F', '#241F19', '#332B22'],
      accent: '#7E6A4B',
      accentChance: 0.10,
    },
    {
      id: 'ai',
      name: '藍',
      roman: 'AI',
      note: 'indigo, three dips',
      paper: '#EAE7DA',
      clear: '#E2E0D4',
      inks: ['#12253C', '#1B4B6B', '#2E7391'],
      accent: '#111417',
      accentChance: 0.16,
    },
    {
      id: 'koubai',
      name: '紅梅',
      roman: 'KŌBAI',
      note: 'safflower red, plum season',
      paper: '#F1E9DC',
      clear: '#EDE3D3',
      inks: ['#8C2A2C', '#B33F3A', '#5E1F26'],
      accent: '#1A1512',
      accentChance: 0.18,
    },
    {
      id: 'kokeshimizu',
      name: '苔清水',
      roman: 'KOKE-SHIMIZU',
      note: 'moss and clear water',
      paper: '#E9E7D6',
      clear: '#E1E1CE',
      inks: ['#3E4A2B', '#5E6B34', '#26301F'],
      accent: '#8A6E3A',
      accentChance: 0.14,
    },
    {
      id: 'sabiasagi',
      name: '錆浅葱',
      roman: 'SABI-ASAGI',
      note: 'rusted pale blue',
      paper: '#EBE6DA',
      clear: '#E3DFD1',
      inks: ['#2F5D5E', '#457C77', '#1E3A3C'],
      accent: '#94483C',
      accentChance: 0.17,
    },
    {
      id: 'kindei',
      name: '金泥',
      roman: 'KINDEI',
      note: 'gold pigment on dyed paper',
      paper: '#1A1D22',
      clear: '#232830',
      inks: ['#C9A45B', '#E3CB92', '#8E703A'],
      accent: '#E8E2D2',
      accentChance: 0.12,
      dark: true,
    },
  ];

  const byId = {};
  for (const p of PALETTES) byId[p.id] = p;

  global.PALETTES = PALETTES;
  global.PALETTE_BY_ID = byId;
})(window);
