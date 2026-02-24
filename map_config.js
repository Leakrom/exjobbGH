// Map configurations: 4 predefined maps generated with specific seeds
// Each map uses the original island-generation algorithm with a fixed seed

const MAP_SEEDS = [12345, 54321, 99999, 11111]; // Different seed for each map

const MAP_CONFIGS = [
  {
    name: 'Karta 1',
    seed: MAP_SEEDS[0],
    cells: [],
    blueStartPositions: [
      { q: 1, r: 2 }, { q: 1, r: 5 }, { q: 2, r: 8 },
      { q: 3, r: 6 }, { q: 2, r: 3 }, { q: 1, r: 10 },
      { q: 2, r: 12 }, { q: 3, r: 4 }, { q: 1, r: 14 },
      { q: 4, r: 2 }, { q: 2, r: 16 }
    ],
    redStartPositions: [
      { q: 18, r: 2 }, { q: 18, r: 5 }, { q: 17, r: 8 },
      { q: 16, r: 6 }, { q: 17, r: 3 }, { q: 18, r: 10 },
      { q: 17, r: 12 }, { q: 16, r: 4 }, { q: 18, r: 14 },
      { q: 15, r: 2 }, { q: 17, r: 16 }
    ]
  },
  {
    name: 'Karta 2',
    seed: MAP_SEEDS[1],
    cells: [],
    blueStartPositions: [
      { q: 2, r: 1 }, { q: 3, r: 3 }, { q: 1, r: 7 },
      { q: 4, r: 5 }, { q: 2, r: 9 }, { q: 1, r: 12 },
      { q: 3, r: 11 }, { q: 2, r: 15 }, { q: 4, r: 13 },
      { q: 1, r: 17 }, { q: 3, r: 18 }
    ],
    redStartPositions: [
      { q: 17, r: 1 }, { q: 16, r: 3 }, { q: 18, r: 7 },
      { q: 15, r: 5 }, { q: 17, r: 9 }, { q: 18, r: 12 },
      { q: 16, r: 11 }, { q: 17, r: 15 }, { q: 15, r: 13 },
      { q: 18, r: 17 }, { q: 16, r: 18 }
    ]
  },
  {
    name: 'Karta 3',
    seed: MAP_SEEDS[2],
    cells: [],
    blueStartPositions: [
      { q: 1, r: 1 }, { q: 2, r: 4 }, { q: 3, r: 7 },
      { q: 1, r: 9 }, { q: 2, r: 12 }, { q: 4, r: 10 },
      { q: 1, r: 15 }, { q: 3, r: 17 }, { q: 2, r: 19 },
      { q: 4, r: 14 }, { q: 3, r: 2 }
    ],
    redStartPositions: [
      { q: 18, r: 1 }, { q: 17, r: 4 }, { q: 16, r: 7 },
      { q: 18, r: 9 }, { q: 17, r: 12 }, { q: 15, r: 10 },
      { q: 18, r: 15 }, { q: 16, r: 17 }, { q: 17, r: 19 },
      { q: 15, r: 14 }, { q: 16, r: 2 }
    ]
  },
  {
    name: 'Karta 4',
    seed: MAP_SEEDS[3],
    cells: [],
    blueStartPositions: [
      { q: 2, r: 2 }, { q: 1, r: 4 }, { q: 3, r: 6 },
      { q: 2, r: 8 }, { q: 4, r: 7 }, { q: 1, r: 11 },
      { q: 3, r: 13 }, { q: 2, r: 15 }, { q: 4, r: 16 },
      { q: 1, r: 18 }, { q: 3, r: 10 }
    ],
    redStartPositions: [
      { q: 17, r: 2 }, { q: 18, r: 4 }, { q: 16, r: 6 },
      { q: 17, r: 8 }, { q: 15, r: 7 }, { q: 18, r: 11 },
      { q: 16, r: 13 }, { q: 17, r: 15 }, { q: 15, r: 16 },
      { q: 18, r: 18 }, { q: 16, r: 10 }
    ]
  }
];

// PRNG function (Mulberry32)
function mulberry32(a) {
  return function () {
    let t = (a += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
  };
}

// Hex distance helper
function hexDistance(a, b) {
  const dq = a.q - b.q;
  const dr = a.r - b.r;
  const ds = (a.q + a.r) - (b.q + b.r);
  return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
}

// Hex rounding helper
function hexRound(q, r) {
  let x = q;
  let z = r;
  let y = -x - z;

  let rx = Math.round(x);
  let ry = Math.round(y);
  let rz = Math.round(z);

  const xDiff = Math.abs(rx - x);
  const yDiff = Math.abs(ry - y);
  const zDiff = Math.abs(rz - z);

  if (xDiff > yDiff && xDiff > zDiff) {
    rx = -ry - rz;
  } else if (yDiff > zDiff) {
    ry = -rx - rz;
  } else {
    rz = -rx - ry;
  }

  return { q: rx, r: rz };
}

// Key helper
function keyOf(q, r) {
  return `${q},${r}`;
}

// Generate map using the original island-based algorithm
function generateMapWithSeed(seed, GRID_W, GRID_H) {
  console.log('        [generateMapWithSeed] START - seed:', seed, 'GRID:', GRID_W, 'x', GRID_H);
  
  const rand = mulberry32(seed | 0);
  const map = [];

  // Generate islands
  console.log('        [generateMapWithSeed] Generating islands...');
  const islands = [];
  const islandCount = 10 + Math.floor(rand() * 6);
  console.log('        [generateMapWithSeed] Island count:', islandCount);
  for (let i = 0; i < islandCount; i++) {
    islands.push({
      q: Math.floor(rand() * GRID_W),
      r: Math.floor(rand() * GRID_H),
      radius: 1.2 + rand() * 2.8,
    });
  }
  console.log('        [generateMapWithSeed] Islands created');

  // Create cells based on islands
  console.log('        [generateMapWithSeed] Creating cells...');
  for (let r = 0; r < GRID_H; r++) {
    for (let q = 0; q < GRID_W; q++) {
      let score = -0.2;
      for (const isl of islands) {
        const d = hexDistance({ q, r }, isl);
        score += Math.max(0, isl.radius - d) * 0.55;
      }
      score += (rand() - 0.5) * 0.25;
      const edge = Math.min(q, r, GRID_W - 1 - q, GRID_H - 1 - r);
      score += edge < 2 ? 0.25 : 0;
      const land = score > 0.65;
      map.push({ q, r, land, depth: 0, depthNormalized: 0 });
    }
  }
  console.log('        [generateMapWithSeed] Cells created:', map.length);

  // Safety zones must be water
  console.log('        [generateMapWithSeed] Setting safety zones...');
  const safe = [
    { q: 1, r: 2 },
    { q: 1, r: 5 },
    { q: 2, r: 8 },
    { q: 3, r: 6 },
    { q: 2, r: 3 },
    { q: GRID_W - 2, r: 2 },
    { q: GRID_W - 2, r: 5 },
    { q: GRID_W - 3, r: 8 },
    { q: GRID_W - 4, r: 6 },
    { q: GRID_W - 3, r: 3 },
  ];
  for (const h of safe) {
    if (h.q >= 0 && h.q < GRID_W && h.r >= 0 && h.r < GRID_H) {
      map[h.r * GRID_W + h.q].land = false;
    }
  }
  console.log('        [generateMapWithSeed] Safety zones set');

  // Create a strait through the middle
  console.log('        [generateMapWithSeed] Creating strait...');
  for (let r = 0; r < GRID_H; r++) {
    const q = Math.floor((GRID_W - 1) * (r / (GRID_H - 1)));
    for (let dq = -1; dq <= 1; dq++) {
      const qq = q + dq;
      if (qq >= 0 && qq < GRID_W) {
        map[r * GRID_W + qq].land = false;
      }
    }
  }
  console.log('        [generateMapWithSeed] Strait created');

  // Calculate water depths
  console.log('        [generateMapWithSeed] Calculating depths...');
  const landCells = map.filter((c) => c.land);
  let maxDist = 0;
  const SHALLOW_ZONE = 2;

  // Calculate base depth from distance to land
  for (const cell of map) {
    if (cell.land) {
      cell.depth = 0;
      continue;
    }
    let minD = Infinity;
    for (const l of landCells) {
      const d = hexDistance({ q: cell.q, r: cell.r }, { q: l.q, r: l.r });
      if (d < minD) {
        minD = d;
      }
    }
    if (!isFinite(minD)) {
      minD = Math.max(GRID_W, GRID_H);
    }
    cell.baseDistance = minD;
    cell.depth = Math.min(minD, SHALLOW_ZONE);
    if (minD > maxDist) {
      maxDist = minD;
    }
  }
  console.log('        [generateMapWithSeed] depth loop done');

  // Add pseudo-random variations to deep water
  console.log('        [generateMapWithSeed] Adding depth variations...');
  const depthRand = mulberry32(seed | 0);
  for (const cell of map) {
    if (!cell.land) {
      if (cell.baseDistance > SHALLOW_ZONE) {
        const variation = (depthRand() - 0.5) * 1.5 * cell.depth;
        cell.depth = Math.max(SHALLOW_ZONE + 0.1, cell.depth + variation);
      } else {
        depthRand(); // Keep RNG in sync
      }
    }
  }
  console.log('        [generateMapWithSeed] Depth variations added');

  // Normalize depth
  console.log('        [generateMapWithSeed] Normalizing depths...');
  maxDist = Math.max(...map.filter((c) => !c.land).map((c) => c.depth));
  for (const cell of map) {
    cell.depthNormalized = cell.land ? 0 : maxDist ? cell.depth / maxDist : 0;
  }
  console.log('        [generateMapWithSeed] Depths normalized');

  // Identify skerries (small isolated land groups 1-2 hexagons)
  console.log('        [generateMapWithSeed] Identifying skerries...');
  const HEX_DIRS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  function inBounds(h) {
    return h.q >= 0 && h.q < GRID_W && h.r >= 0 && h.r < GRID_H;
  }

  const visitedLand = new Set();
  for (const cell of map) {
    if (!cell.land) continue;
    const key = keyOf(cell.q, cell.r);
    if (visitedLand.has(key)) continue;

    // Flood fill to find all connected land cells
    const group = [];
    const queue = [cell];
    while (queue.length) {
      const curr = queue.shift();
      const currKey = keyOf(curr.q, curr.r);
      if (visitedLand.has(currKey)) continue;
      visitedLand.add(currKey);
      group.push(curr);
      for (const dir of HEX_DIRS) {
        const nh = { q: curr.q + dir.q, r: curr.r + dir.r };
        if (!inBounds(nh)) continue;
        const nCell = map[nh.r * GRID_W + nh.q];
        if (!nCell.land) continue;
        const nKey = keyOf(nh.q, nh.r);
        if (!visitedLand.has(nKey)) {
          queue.push(nCell);
        }
      }
    }

    // Mark small groups (1-2 hexagons) as skerries
    if (group.length <= 2) {
      for (const gCell of group) {
        gCell.isSkerry = true;
      }
    }
  }
  console.log('        [generateMapWithSeed] Skerries identified');
  console.log('        [generateMapWithSeed] COMPLETE - returning', map.length, 'cells');

  return map;
}

// Generate all map cells with their seeds
// This will be called from script.js after GRID_W/GRID_H are available
function initializeMapConfigs(GRID_W, GRID_H) {
  for (let i = 0; i < MAP_CONFIGS.length; i++) {
    MAP_CONFIGS[i].cells = generateMapWithSeed(MAP_CONFIGS[i].seed, GRID_W, GRID_H);
  }
}
