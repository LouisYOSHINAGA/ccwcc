/**
 * palettes.js — five ways of looking at snow.
 *
 * Two of these are how snow is actually seen — pale crystal against a dark
 * field, under a lens — and two are how it was recorded before photography:
 * as black ink on paper, in a woodblock plate. `ground` is the field the
 * specimens sit on, which is not always the colour of the sheet around it.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'konshi',
      name: '紺紙',
      roman: 'KONSHI',
      note: 'indigo ground, as under a lens',
      paper: '#20242E',
      ground: '#161A24',
      crystalDark: '#5E7593',
      crystalLight: '#EDF2F8',
      glow: '#7E9CC0',
      ink: '#C6CEDC',
      dark: true,
    },
    {
      id: 'zusetsu',
      name: '図説',
      roman: 'ZUSETSU',
      note: 'after Doi Toshitsura, 1832',
      paper: '#E9E1CC',
      ground: '#EDE6D3',
      crystalDark: '#4A4436',
      crystalLight: '#191612',
      ink: '#221E17',
    },
    {
      id: 'hari',
      name: '玻璃',
      roman: 'HARI',
      note: 'clear ice, almost no colour',
      paper: '#12151A',
      ground: '#0C0E13',
      crystalDark: '#38556A',
      crystalLight: '#DFF4FA',
      glow: '#5FA6C4',
      ink: '#BCCBD6',
      dark: true,
    },
    {
      id: 'ginnezu',
      name: '銀鼠',
      roman: 'GINNEZU',
      note: 'silver grey, overcast',
      paper: '#D6D5CE',
      ground: '#C3C4C0',
      crystalDark: '#7C8285',
      crystalLight: '#FBFBF8',
      ink: '#2E3134',
    },
    {
      id: 'akatsuki',
      name: '暁',
      roman: 'AKATSUKI',
      note: 'first light on new snow',
      paper: '#E4D8CA',
      ground: '#DCCDBB',
      crystalDark: '#8F7E7A',
      crystalLight: '#FFF6EA',
      ink: '#3A2E28',
    },
  ];

  global.PALETTES = PALETTES;
})(window);
