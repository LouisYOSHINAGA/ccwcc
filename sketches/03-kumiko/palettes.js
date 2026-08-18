/**
 * palettes.js — five lattices, seen in different light.
 *
 * A kumiko panel is read one of two ways: from the lit side, where the strips
 * are pale cypress against shadow, or from the dark side of a lit room, where
 * the paper glows and every strip is a silhouette. `backlit` chooses which,
 * and it changes the whole logic of the drawing — a silhouette has no
 * highlight, only a soft bleed where the light wraps past the wood.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'shoji',
      name: '障子',
      roman: 'SHŌJI',
      note: 'seen against the paper, at dusk',
      paper: '#DCD4C0',
      glow: '#F2EADA',
      glowEdge: '#D9CEB4',
      wood: '#3B2F23',
      woodDark: '#241B13',
      backlit: true,
      ink: '#2A2118',
    },
    {
      id: 'andon',
      name: '行灯',
      roman: 'ANDON',
      note: 'lamplight behind the lattice',
      paper: '#D8CBA9',
      glow: '#F3E2B4',
      glowEdge: '#D6BC85',
      wood: '#38291A',
      woodDark: '#1F150C',
      backlit: true,
      ink: '#33261A',
    },
    {
      id: 'ruri',
      name: '瑠璃',
      roman: 'RURI',
      note: 'blue glass set behind the frame',
      paper: '#C9C7C0',
      glow: '#8FA8BE',
      glowEdge: '#4E6A88',
      wood: '#241F1E',
      woodDark: '#100D0D',
      backlit: true,
      ink: '#20262E',
    },
    {
      id: 'hinoki',
      name: '檜',
      roman: 'HINOKI',
      note: 'new cypress, lit from the front',
      paper: '#1E1A16',
      glow: '#221D18',
      glowEdge: '#141110',
      wood: '#D8BE93',
      woodDark: '#8A6F49',
      backlit: false,
      dark: true,
      ink: '#E0D3BC',
    },
    {
      id: 'tagayasan',
      name: '鉄刀木',
      roman: 'TAGAYASAN',
      note: 'ironwood, almost black',
      paper: '#DED6C4',
      glow: '#E9E2D2',
      glowEdge: '#C9BFA9',
      wood: '#4A3A2C',
      woodDark: '#2A1F16',
      backlit: false,
      ink: '#2E241B',
    },
  ];

  global.PALETTES = PALETTES;
})(window);
