/**
 * palettes.js — six glazes and three metals.
 *
 * The glaze decides everything about how the repair reads. Gold on a black
 * tenmoku is the picture everyone has of kintsugi; gold on a pale shino is
 * almost invisible until you look, which is closer to what the technique is
 * actually for. `ground` is the field the vessel sits on and is chosen against
 * the glaze, not with it, so the silhouette always holds.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'tenmoku', name: '天目', roman: 'TENMOKU', note: 'iron glaze, fired to black',
      paper: '#CFC7B6', ground: '#B9B1A0',
      glaze: ['#241A14', '#2E211A', '#1B1310'],
      glazeLight: '#7A5630', glazeDark: '#0D0A08',
      crackle: '#5A4028', ink: '#241E17',
    },
    {
      id: 'shino', name: '志野', roman: 'SHINO', note: 'feldspar white, scorched pink',
      paper: '#43413C', ground: '#35342F',
      glaze: ['#E9DDCB', '#E1D1BA', '#F0E7D9'],
      glazeLight: '#FFF8EC', glazeDark: '#B99A82',
      crackle: '#A98D74', ink: '#DED6C6', dark: true,
    },
    {
      id: 'oribe', name: '織部', roman: 'ORIBE', note: 'copper green, running thick',
      paper: '#D3CCBB', ground: '#BEB7A4',
      glaze: ['#3B5838', '#2E4A30', '#4B6A42'],
      glazeLight: '#7E9C63', glazeDark: '#1B2C1D',
      crackle: '#23391F', ink: '#26301F',
    },
    {
      id: 'seiji', name: '青磁', roman: 'SEIJI', note: 'celadon, crazed all over',
      paper: '#3C4442', ground: '#2E3634',
      glaze: ['#A2BCB5', '#90ABA6', '#B3C9C0'],
      glazeLight: '#D6E4DC', glazeDark: '#5F7A76',
      crackle: '#5E7671', ink: '#D2DEDA', dark: true,
    },
    {
      id: 'kuroraku', name: '黒楽', roman: 'KURORAKU', note: 'hand-formed, matte black',
      paper: '#C6BFB2', ground: '#ADA697',
      glaze: ['#1D1C1B', '#252423', '#141313'],
      glazeLight: '#565250', glazeDark: '#0A0909',
      crackle: '#3A3735', ink: '#211D19',
    },
    {
      id: 'kohiki', name: '粉引', roman: 'KOHIKI', note: 'white slip over dark clay',
      paper: '#4A463E', ground: '#3B3830',
      glaze: ['#DCD4C4', '#D2C9B6', '#E4DDD0'],
      glazeLight: '#F4EFE4', glazeDark: '#A79C87',
      crackle: '#9A8E79', ink: '#E0D9CB', dark: true,
    },
  ];

  /** 金継ぎ proper is gold; silver and plain red lacquer are the same repair. */
  const METALS = [
    { id: 'kin', ja: '金', roman: 'KIN', weight: 5,
      dark: '#7E5A1C', mid: '#C39A3E', bright: '#F5E1A4' },
    { id: 'gin', ja: '銀', roman: 'GIN', weight: 2,
      dark: '#5E6166', mid: '#A3A8AE', bright: '#EDF1F4' },
    { id: 'bengara', ja: '弁柄', roman: 'BENGARA', weight: 2,
      dark: '#5E241A', mid: '#94402A', bright: '#C8724A' },
  ];

  global.PALETTES = PALETTES;
  global.METALS = METALS;
})(window);
