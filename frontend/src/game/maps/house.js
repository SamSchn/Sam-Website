// Sam's house — interior. Each piece of furniture opens a different part of
// the site (About, Projects, Resume, Contact, News, Bulletin board).
import { T, objectList } from './builder';

function buildHouse() {
  const terrain = [
    '                ',
    ' WWWWWWWWWWWWWW ',
    ' WWWWWWWWWWWWWW ',
    ' WWWWWWWWWWWWWW ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    ' ffffffffffffff ',
    '      ff        ',
    '                ',
  ];

  const { list: objects, add } = objectList();
  const WALL_BASE = 4 * T; // y where the back wall meets the floor
  // Wall-mounted items are interacted with from the floor, so their hit
  // area extends down to the wall base.
  const wallHit = (w, h, top) => ({ x: -2, y: 0, w: w + 4, h: WALL_BASE - top + 6 });

  // ---------------------------------------------------------------- back wall
  add('window', 60, 20, {
    id: 'window_left',
    interact: { type: 'dialog', label: 'Window', lines: ['You can see the village square from here.', 'The fountain is sparkling in the light.'] },
    hit: wallHit(14, 20, 20),
  });
  add('window', 104, 20, { id: 'window_right' });
  add('portrait', 136, 24, {
    id: 'portrait',
    interact: { type: 'panel', panel: 'about', label: 'Portrait' },
    hit: wallHit(16, 18, 24),
  });
  add('fireplace', 160, 16, {
    id: 'fireplace',
    interact: { type: 'dialog', label: 'Fireplace', lines: ['The fire crackles warmly.', 'This is the coziest spot in the whole valley.'] },
  });
  add('bulletin_board', 202, 22, {
    id: 'bulletin_board',
    interact: { type: 'panel', panel: 'board', label: 'Bulletin board' },
    hit: wallHit(32, 26, 22),
  });

  // ---------------------------------------------------------------- along the wall
  add('bookshelf', 18, 36, {
    id: 'bookshelf',
    interact: { type: 'panel', panel: 'projects', label: 'Bookshelf' },
  });
  add('tv', 56, 46, {
    id: 'tv',
    interact: { type: 'panel', panel: 'news', label: 'TV' },
  });
  add('plant_leafy', 84, 52);
  add('plant_small', 222, 46);

  // ---------------------------------------------------------------- desk (resume)
  add('table', 34, 100, {
    id: 'desk',
    interact: { type: 'panel', panel: 'resume', label: 'Desk' },
  });
  add('papers', 42, 104, { id: 'resume_papers' });
  add('candle', 52, 98);
  add('chair_back', 42, 116);

  // ---------------------------------------------------------------- living area
  add('rug', 96, 112);
  add('table_round', 104, 80);
  add('book_open', 112, 84);

  // ---------------------------------------------------------------- bedroom corner
  add('bed', 210, 134, {
    id: 'bed',
    interact: { type: 'dialog', label: 'Bed', lines: ["It's not bedtime yet.", 'Plenty of village left to explore!'] },
  });
  add('lamp', 192, 136);
  add('chest', 186, 158);

  // ---------------------------------------------------------------- by the door
  add('drawers', 136, 154, {
    id: 'drawers',
    interact: { type: 'panel', panel: 'contact', label: 'Letters' },
  });
  add('letters', 144, 146);
  add('plant_tree', 18, 144);
  add('doormat', 96, 168);

  return {
    id: 'house',
    name: "Sam's House",
    route: '/house',
    outdoor: false,
    width: terrain[0].length,
    height: terrain.length,
    terrain,
    objects,
    // window light beams (decorative)
    beams: [{ x: 60, y: 20, w: 14 }, { x: 104, y: 20, w: 14 }],
    warps: [
      { id: 'exit', x: 6 * T, y: 11 * T + 10, w: 2 * T, h: 6, to: 'village' },
    ],
    spawns: {
      default: { x: 7 * T, y: 10 * T + 8, facing: 'up' },
      village: { x: 7 * T, y: 11 * T + 2, facing: 'up' },
    },
  };
}

export default buildHouse();
