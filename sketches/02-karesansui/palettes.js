/**
 * palettes.js — four gardens, four lights.
 *
 * The gravel is the largest area on the sheet and the one the eye calibrates
 * to, so it is kept close to the paper: what makes each of these read as a
 * different hour is the pair of colours in the furrow, not the ground itself.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'hakusa',
      name: '白砂',
      roman: 'HAKUSA',
      note: 'white gravel, midday',
      paper: '#E2DCCB',
      ground: '#E8E3D4',
      furrowDark: '#958C76',
      furrowLight: '#F6F2E6',
      stones: ['#5C5B5C', '#4C4845', '#65605A', '#55575C'],
      stoneLight: '#A7A29A',
      moss: ['#5C6446', '#4C5439', '#6C7156'],
      ink: '#2A2620',
    },
    {
      id: 'kokeniwa',
      name: '苔庭',
      roman: 'KOKENIWA',
      note: 'moss has taken the edges',
      paper: '#DFDDCA',
      ground: '#E2E1CE',
      furrowDark: '#83886B',
      furrowLight: '#F1F1E2',
      stones: ['#55584F', '#464A42', '#5F6154'],
      stoneLight: '#9AA08C',
      moss: ['#4E5E36', '#3E4E2B', '#63703F'],
      mossy: 1.9,
      ink: '#26301F',
    },
    {
      id: 'shigure',
      name: '時雨',
      roman: 'SHIGURE',
      note: 'after rain, the gravel darkened',
      paper: '#DEDACE',
      ground: '#C4C1B4',
      furrowDark: '#6E6A61',
      furrowLight: '#E4E1D6',
      stones: ['#484B4E', '#3B3D3C', '#53544F'],
      stoneLight: '#8D9091',
      moss: ['#4A583A', '#3B472E'],
      ink: '#242522',
    },
    {
      id: 'tsukiyo',
      name: '月夜',
      roman: 'TSUKIYO',
      note: 'raked by moonlight',
      paper: '#1B1E24',
      ground: '#252A33',
      furrowDark: '#12151A',
      furrowLight: '#6C7A8E',
      stones: ['#171A20', '#1D2027', '#12141A'],
      stoneLight: '#606C80',
      moss: ['#1E2A22', '#18241D'],
      ink: '#C9CEDA',
      dark: true,
    },
  ];

  global.PALETTES = PALETTES;
})(window);
