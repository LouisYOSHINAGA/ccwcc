/**
 * palettes.js — five boards and the pigments on them.
 *
 * A sangaku is a painted wooden tablet hung outdoors at a shrine, so the
 * colours are ground mineral pigments on bare timber and both have usually
 * had a century of weather. The pigments are the traditional ones: 群青 from
 * azurite, 緑青 from malachite, 朱 from cinnabar, 胡粉 from burnt shell.
 *
 * `ink` is for the caption on the mount; `boardInk` is for the brushwork on
 * the tablet itself, and defaults to the same. They differ whenever the board
 * is darker or lighter than the paper it is presented on.
 */
(function (global) {
  'use strict';

  const PALETTES = [
    {
      id: 'sugiita', name: '杉板', roman: 'SUGIITA', note: 'cedar board, newly hung',
      paper: '#D9CFB8', board: '#C6A878', boardDark: '#9A7E52', grain: '#8A6C42',
      pigments: ['#38578A', '#B93B2C', '#57866E', '#B4813F', '#EDE6D4'],
      ink: '#2B2118',
    },
    {
      id: 'koshoku', name: '古色', roman: 'KOSHOKU', note: 'a century of weather',
      paper: '#CFC6B2', board: '#A08B6E', boardDark: '#6E5C44', grain: '#5F4E38',
      pigments: ['#4A6076', '#96513F', '#68806B', '#9A8250', '#D9D2C0'],
      ink: '#2A241C',
    },
    {
      id: 'hinoki', name: '桧', roman: 'HINOKI', note: 'pale cypress, close grained',
      paper: '#CDC4B0', board: '#DCC49B', boardDark: '#B49A6E', grain: '#A98A5E',
      pigments: ['#2F4E86', '#C03A2A', '#4E8368', '#C08A3C', '#F2ECDC'],
      ink: '#241D15',
    },
    {
      id: 'susutake', name: '煤竹', roman: 'SUSUTAKE', note: 'smoke-darkened, from a hearth',
      paper: '#C4BAA6', board: '#4E3B2A', boardDark: '#33241A', grain: '#2A1D14',
      pigments: ['#6E8CB4', '#C9564A', '#7FA88C', '#D2A45E', '#E8E0CC'],
      // The board is dark but the mount around it is not, so the brushwork on
      // the board and the caption on the paper cannot be the same colour.
      ink: '#2A2018', boardInk: '#E3D8C2',
    },
    {
      id: 'shiraki', name: '白木', roman: 'SHIRAKI', note: 'plain timber, ink only',
      paper: '#CFC8B6', board: '#E0D6BE', boardDark: '#BCAF92', grain: '#A2947A',
      pigments: ['#2A241C', '#4A4238', '#B93B2C', '#6B6255', '#EFE9DA'],
      ink: '#221C14', austere: true,
    },
  ];

  const ERAS = ['寛政', '享和', '文化', '文政', '天保', '弘化', '嘉永', '安政', '万延', '文久', '元治', '慶応'];
  const YEARS = ['元', '二', '三', '四', '五', '六', '七', '八', '九', '十',
    '十一', '十二', '十三', '十四'];

  global.PALETTES = PALETTES;
  global.ERAS = ERAS;
  global.YEARS = YEARS;
})(window);
