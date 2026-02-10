(() => {
  // =====================================================
  // KONFIGURATION
  // =====================================================
  const GRID_W = 20;
  const GRID_H = 20;
  const HEX_SIZE = 34;
  const ACTIONS_PER_TURN = 3;

  const UnitType = {
    FRIGATE: 'Fregatt',
    STEALTH_CORVETTE: 'Stealth-korvett',
    SUBMARINE: 'Ubåt',
    UAV: 'UAV',
    USV: 'USV',
    UUV: 'UUV',
    SUBMARINE_HUNTER: 'Ubåtsjakthelikopter',
    CONVENTIONAL_CORVETTE: 'Konventionell korvett',
    UNCONTROL_MINE: 'Okontrollerbar mina',
    CONTROL_MINE: 'Kontrollerbar mina',
  };

  // Unit stats: hp, move (in hexes), range, mines (mines this unit can lay)
  const UNIT_STATS = {
    [UnitType.FRIGATE]: { hp: 4, move: 2, range: 3, mines: 0 },
    [UnitType.STEALTH_CORVETTE]: { hp: 2, move: 3, range: 2, mines: 0 },
    [UnitType.SUBMARINE]: { hp: 3, move: 3, range: 1, mines: 0 },
    [UnitType.UAV]: { hp: 1, move: 4, range: 1, mines: 0 },
    [UnitType.USV]: { hp: 2, move: 2, range: 1, mines: 0 },
    [UnitType.UUV]: { hp: 1, move: 2, range: 2, mines: 0 },
    [UnitType.SUBMARINE_HUNTER]: { hp: 2, move: 3, range: 3, mines: 0 },
    [UnitType.CONVENTIONAL_CORVETTE]: { hp: 4, move: 2, range: 2, mines: 0 },
    [UnitType.UNCONTROL_MINE]: { hp: 1, move: 0, range: 0, mines: 0 },
    [UnitType.CONTROL_MINE]: { hp: 1, move: 0, range: 0, mines: 0 },
  };

  const Side = { BLUE: 'Blå', RED: 'Röd' };

  // Sensor types: RADAR (surface) or SONAR (underwater)
  const SensorType = { RADAR: 'Radar', SONAR: 'Sonar' };

  // Determine if a unit type is underwater capable
  const SUBMARINE_TYPES = new Set([
    UnitType.SUBMARINE,
    UnitType.UUV,
    UnitType.SUBMARINE_HUNTER,
  ]);

  // Sensor system configuration
  const SENSOR_CONFIG = {
    [UnitType.FRIGATE]: { type: SensorType.RADAR, passiveRange: 4, activeRange: 6 },
    [UnitType.STEALTH_CORVETTE]: { type: SensorType.RADAR, passiveRange: 3, activeRange: 5 },
    [UnitType.SUBMARINE]: { type: SensorType.SONAR, passiveRange: 3, activeRange: 5 },
    [UnitType.UAV]: { type: SensorType.RADAR, passiveRange: 5, activeRange: 8 },
    [UnitType.USV]: { type: SensorType.RADAR, passiveRange: 2, activeRange: 4 },
    [UnitType.UUV]: { type: SensorType.SONAR, passiveRange: 2, activeRange: 4 },
    [UnitType.SUBMARINE_HUNTER]: { type: SensorType.SONAR, passiveRange: 4, activeRange: 6 },
    [UnitType.CONVENTIONAL_CORVETTE]: { type: SensorType.RADAR, passiveRange: 3, activeRange: 5 },
    [UnitType.UNCONTROL_MINE]: { type: null, passiveRange: 0, activeRange: 0 },
    [UnitType.CONTROL_MINE]: { type: null, passiveRange: 0, activeRange: 0 },
  };

  // Max depths: 0 = surface, 1-3 = various depths
  const MAX_DEPTH = 3;

  // =====================================================
  // Canvas och rendering setup
  // =====================================================
  const canvas = document.getElementById('c');
  const ctx = canvas.getContext('2d');
  const stageWrap = document.getElementById('stageWrap');

  function resize() {
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    const rect = stageWrap.getBoundingClientRect();
    canvas.width = Math.floor(rect.width * dpr);
    canvas.height = Math.floor(rect.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw();
  }

  window.addEventListener('resize', resize);

  // =====================================================
  // Hex-hjälpfunktioner (axiella koordinater)
  // =====================================================
  const SQRT3 = Math.sqrt(3);

  function hexToPixel(q, r) {
    // pointy-top with odd-r offset so the grid looks more square on screen.
    // We offset every other row horizontally by 0.5 hex-width.
    // This only affects rendering; internal coordinates remain axial (q, r).
    const x = HEX_SIZE * (SQRT3 * (q + (r % 2) * 0.5));
    const y = HEX_SIZE * (3 / 2 * r);
    return { x, y };
  }

  function pixelToHex(x, y) {
    // Parity-aware inverse for the odd-r offset rendering used in hexToPixel.
    // We first compute a floating row (rFloat). To determine the horizontal
    // offset used when rendering we pick the nearest integer row parity
    // (0 or 1) and subtract its 0.5 offset from the x coordinate before
    // converting to axial q. Finally we round to the nearest hex.
    const rFloat = (2 / 3 * y) / HEX_SIZE;
    const rParity = Math.round(rFloat) % 2;
    const qFloat = x / (HEX_SIZE * SQRT3) - rParity * 0.5;
    return hexRound(qFloat, rFloat);
  }

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

  const HEX_DIRS = [
    { q: 1, r: 0 },
    { q: 1, r: -1 },
    { q: 0, r: -1 },
    { q: -1, r: 0 },
    { q: -1, r: 1 },
    { q: 0, r: 1 },
  ];

  function hexAdd(a, b) {
    return { q: a.q + b.q, r: a.r + b.r };
  }

  function hexEq(a, b) {
    return a.q === b.q && a.r === b.r;
  }

  function hexDistance(a, b) {
    const dq = a.q - b.q;
    const dr = a.r - b.r;
    const ds = (a.q + a.r) - (b.q + b.r);
    return Math.max(Math.abs(dq), Math.abs(dr), Math.abs(ds));
  }

  function inBounds(h) {
    return h.q >= 0 && h.q < GRID_W && h.r >= 0 && h.r < GRID_H;
  }

  function hexPolygon(x, y) {
    const pts = [];
    for (let i = 0; i < 6; i++) {
      const ang = (Math.PI / 180) * (60 * i - 30);
      pts.push({
        x: x + HEX_SIZE * Math.cos(ang),
        y: y + HEX_SIZE * Math.sin(ang),
      });
    }
    return pts;
  }

  function drawHex(x, y, fill, stroke, lw = 1) {
    const pts = hexPolygon(x, y);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.closePath();
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
  }

  // =====================================================
  // Spelstatus
  // =====================================================
  let map = []; // [{q, r, land: boolean, depthNormalized: 0..1}]
  let mines = new Map(); // key -> {side}
  let units = [];

  let turn = 1;
  let activeSide = Side.BLUE;
  let actionsLeft = ACTIONS_PER_TURN;

  let selectedId = null;
  let mode = 'order'; // 'order' | 'attack' | 'mine'

  // =====================================================
  // UI-element-referenser
  // =====================================================
  const elTurnPill = document.getElementById('turnPill');
  const elPhasePill = document.getElementById('phasePill');
  const elHintPill = document.getElementById('hintPill');

  const elSelType = document.getElementById('selType');
  const elSelSide = document.getElementById('selSide');
  const elSelHP = document.getElementById('selHP');
  const elSelMove = document.getElementById('selMove');
  const elSelRange = document.getElementById('selRange');
  const elSelDepth = document.getElementById('selDepth');
  const elSelMines = document.getElementById('selMines');

  const elActivePlayer = document.getElementById('activePlayer');
  const elActionsLeft = document.getElementById('actionsLeft');

  const btnEndTurn = document.getElementById('btnEndTurn');
  const btnReset = document.getElementById('btnReset');
  const btnHelp = document.getElementById('btnHelp');
  const btnAttack = document.getElementById('btnAttack');
  const btnMine = document.getElementById('btnMine');
  const btnDepthUp = document.getElementById('btnDepthUp');
  const btnDepthDown = document.getElementById('btnDepthDown');
  const btnToggleSensor = document.getElementById('btnToggleSensor');

  const elRedMove1 = document.getElementById('redMove1');
  const elRedMove2 = document.getElementById('redMove2');
  const elRedMove3 = document.getElementById('redMove3');

  const toast = document.getElementById('toast');
  let toastTimer = null;

  function showToast(title, msg) {
    toast.style.display = 'block';
    toast.innerHTML = `<b>${escapeHtml(title)}</b><small>${escapeHtml(msg)}</small>`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.style.display = 'none';
    }, 4500);
  }

  // Red moves history (most recent first)
  let redMoves = [];
  let redMovesLastRedTurn = 0;
  function pushRedMove(txt) {
    // If a new Red turn, clear moves
    if (activeSide === Side.RED && turn !== redMovesLastRedTurn) {
      redMoves = [];
      redMovesLastRedTurn = turn;
    }
    redMoves.push(txt);
    updateRedMovesUI();
  }
  function updateRedMovesUI() {
    const rows = [
      document.getElementById('redMoveRow1'),
      document.getElementById('redMoveRow2'),
      document.getElementById('redMoveRow3')
    ];
    const texts = [elRedMove1, elRedMove2, elRedMove3];
    // Show only moves from this round, first move at top
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const txt = redMoves[i];
      if (!row) continue;
      if (txt) {
        row.style.display = 'flex';
        texts[i].textContent = txt;
        row.querySelector('.redDot').style.visibility = 'visible';
      } else {
        row.style.display = 'none';
        texts[i].textContent = '';
        row.querySelector('.redDot').style.visibility = 'hidden';
      }
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }[m]));
  }

  // =====================================================
  // Hjälpfunktioner för karta och enheter
  // =====================================================
  function keyOf(q, r) {
    return `${q},${r}`;
  }

  function getCell(q, r) {
    return map[r * GRID_W + q];
  }

  function unitAt(q, r) {
    return units.find((u) => u.q === q && u.r === r);
  }

  function getUnit(id) {
    return units.find((u) => u.id === id) || null;
  }

  function updateUI() {
    elTurnPill.textContent = `Tur ${turn} • ${activeSide}`;
    elPhasePill.textContent = `Fas: ${
      mode === 'order' ? 'Order' : mode === 'attack' ? 'Attack' : 'Minering'
    }`;

    elActivePlayer.textContent = activeSide;
    elActionsLeft.textContent = String(actionsLeft);

    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel) {
      elSelType.textContent = '–';
      elSelSide.textContent = '–';
      elSelHP.textContent = '–';
      elSelMove.textContent = '–';
      elSelRange.textContent = '–';
      elSelDepth.textContent = '–';
      elSelMines.textContent = '–';
      btnAttack.disabled = true;
      btnMine.disabled = true;
      btnDepthUp.disabled = true;
      btnDepthDown.disabled = true;
      btnToggleSensor.disabled = true;
      return;
    }

    const st = UNIT_STATS[sel.type];
    elSelType.textContent = sel.type;
    elSelSide.textContent = sel.side;
    elSelHP.textContent = `${sel.hp}/${st.hp}`;
    elSelMove.textContent = String(st.move);
    elSelRange.textContent = String(st.range);
    elSelDepth.textContent = `${sel.depth}/${MAX_DEPTH}`;
    elSelMines.textContent = String(sel.minesLeft);

    const isOwn = sel.side === activeSide;
    btnAttack.disabled = !isOwn || actionsLeft <= 0;
    btnMine.disabled = !isOwn || actionsLeft <= 0 || sel.minesLeft <= 0;
    // Depth buttons only for submarines and if own unit
    const cell = sel.q !== undefined ? getCell(sel.q, sel.r) : null;
    const maxDepthAtHex = cell ? Math.ceil(cell.depthNormalized * MAX_DEPTH) : MAX_DEPTH;
    btnDepthUp.disabled = !isOwn || actionsLeft <= 0 || !SUBMARINE_TYPES.has(sel.type) || sel.depth >= maxDepthAtHex;
    btnDepthDown.disabled = !isOwn || actionsLeft <= 0 || !SUBMARINE_TYPES.has(sel.type) || sel.depth <= 0;
    // Sensor toggle only for blue units with sensors
    btnToggleSensor.disabled = !isOwn || !SENSOR_CONFIG[sel.type] || !SENSOR_CONFIG[sel.type].type;
    if (!btnToggleSensor.disabled) {
      btnToggleSensor.textContent = sel.sensorActive ? 'Växla sensor (Aktiv)' : 'Växla sensor (Passiv)';
    }

    if (mode === 'order') {
      elHintPill.textContent = 'Klicka en hex i räckvidd för att flytta';
    }
    if (mode === 'attack') {
      elHintPill.textContent = 'Klicka en fiende inom räckvidd för att attackera';
    }
    if (mode === 'mine') {
      elHintPill.textContent = 'Klicka en vattenhex intill för att lägga mina';
    }
  }

  // =====================================================
  // Kartgenerering: skärgårdskänsla (öar + sund)
  // =====================================================
  function generateMap(seed = Math.random() * 1e9) {
    const rand = mulberry32(seed | 0);

    map = [];
    mines = new Map();

    // Generera öar
    const islands = [];
    const islandCount = 10 + Math.floor(rand() * 6);
    for (let i = 0; i < islandCount; i++) {
      islands.push({
        q: Math.floor(rand() * GRID_W),
        r: Math.floor(rand() * GRID_H),
        radius: 1.2 + rand() * 2.8,
      });
    }

    // Skapa cellerna baserat på öarna
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

    // Säkerställ startzoner är vatten
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
      if (inBounds(h)) {
        getCell(h.q, h.r).land = false;
      }
    }

    // Skapa ett sund genom mitten
    for (let r = 0; r < GRID_H; r++) {
      const q = Math.floor((GRID_W - 1) * (r / (GRID_H - 1)));
      for (let dq = -1; dq <= 1; dq++) {
        const qq = q + dq;
        if (qq >= 0 && qq < GRID_W) {
          getCell(qq, r).land = false;
        }
      }
    }

    // Beräkna 'djup' för vattenrutor
    const landCells = map.filter((c) => c.land);
    let maxDist = 0;
    const SHALLOW_ZONE = 2; // Direkt nära land = alltid grunt

    // Först: beräkna basdjup från avstånd till land
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

    // Lägg till pseudo-random variationer på djupare vatten
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

    // Normalisera depthNormalized
    maxDist = Math.max(...map.filter((c) => !c.land).map((c) => c.depth));
    for (const cell of map) {
      cell.depthNormalized = cell.land ? 0 : maxDist ? cell.depth / maxDist : 0;
    }

    // Identifiera kobbar (små isolerade landöar med 1-2 hexagoner)
    const visitedLand = new Set();
    for (const cell of map) {
      if (!cell.land) continue;
      const key = keyOf(cell.q, cell.r);
      if (visitedLand.has(key)) continue;

      // Flood fill för att hitta alla anslutna landceller
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
          const nCell = getCell(nh.q, nh.r);
          if (!nCell.land) continue;
          const nKey = keyOf(nh.q, nh.r);
          if (!visitedLand.has(nKey)) {
            queue.push(nCell);
          }
        }
      }

      // Markera små grupper (1-2 hexagoner) som kobbar
      if (group.length <= 2) {
        for (const gCell of group) {
          gCell.isSkerry = true;
        }
      }
    }
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
    };
  }

  // =====================================================
  // Enhetsspawning och spelregler
  // =====================================================
  let nextId = 1;

  function spawn(side, type, q, r) {
    const st = UNIT_STATS[type];
    // Submarines start at random depth, but cannot exceed water depth at this hex
    let depth = 0;
    if (SUBMARINE_TYPES.has(type)) {
      const cell = getCell(q, r);
      const maxDepth = Math.ceil(cell.depthNormalized * MAX_DEPTH);
      depth = Math.floor(Math.random() * (maxDepth + 1));
    }
    const unit = {
      id: nextId++,
      side,
      type,
      q,
      r,
      depth,
      hp: st.hp,
      minesLeft: st.mines,
    };
    // Blue units: add sensor mode (false = passive, true = active)
    if (side === Side.BLUE) {
      unit.sensorActive = false;
    }
    // Red units: add detection state (false until detected, then identified may be true/false)
    if (side === Side.RED) {
      unit.detected = false;
      unit.identified = false;
    }
    units.push(unit);
  }

  // Find a suitable water hex for spawning a unit for the given side.
  // We prefer the left half for Blue and the right half for Red so
  // starting positions are reasonably separated. The function ensures
  // the chosen hex is in-bounds, not land and not already occupied.
  function findStartHex(side) {
    const mid = Math.floor(GRID_W / 2);
    const minQ = side === Side.BLUE ? 0 : mid;
    const maxQ = side === Side.BLUE ? Math.max(0, mid - 1) : GRID_W - 1;
    const attempts = 500;
    for (let i = 0; i < attempts; i++) {
      const q = Math.floor(Math.random() * (maxQ - minQ + 1)) + minQ;
      const r = Math.floor(Math.random() * GRID_H);
      if (!inBounds({ q, r })) continue;
      const cell = getCell(q, r);
      if (!cell || cell.land) continue;
      if (unitAt(q, r)) continue;
      return { q, r };
    }

    // Fallback: scan for any free water hex in the preferred half
    for (let r = 0; r < GRID_H; r++) {
      for (let q = minQ; q <= maxQ; q++) {
        if (!inBounds({ q, r })) continue;
        const cell = getCell(q, r);
        if (!cell || cell.land) continue;
        if (unitAt(q, r)) continue;
        return { q, r };
      }
    }

    // Final fallback: any free water hex on the map
    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        const cell = getCell(q, r);
        if (!cell || cell.land) continue;
        if (unitAt(q, r)) continue;
        return { q, r };
      }
    }

    // If everything fails (very unlikely), return a safe default
    return { q: 0, r: 0 };
  }

  function resetGame() {
    nextId = 1;
    turn = 1;
    activeSide = Side.BLUE;
    actionsLeft = ACTIONS_PER_TURN;
    selectedId = null;
    mode = 'order';
    generateMap();
    units = [];
    // Randomize start positions per side but ensure no unit spawns on land
    // Blue: 1 Fregatt, 2 Stealth-korvett, 1 Ubåt, 2 UAV, 2 USV, 2 UUV, 1 Ubåtsjakthelikopter
    const blueUnits = [
      UnitType.FRIGATE,
      UnitType.STEALTH_CORVETTE, UnitType.STEALTH_CORVETTE,
      UnitType.SUBMARINE,
      UnitType.UAV, UnitType.UAV,
      UnitType.USV, UnitType.USV,
      UnitType.UUV, UnitType.UUV,
      UnitType.SUBMARINE_HUNTER,
    ];
    for (const t of blueUnits) {
      const h = findStartHex(Side.BLUE);
      spawn(Side.BLUE, t, h.q, h.r);
    }

    // Red: 2 Konventionell korvett, 1 Ubåt, 2 Okontrollerbar mina, 2 Kontrollerbar mina
    const redUnits = [
      UnitType.CONVENTIONAL_CORVETTE, UnitType.CONVENTIONAL_CORVETTE,
      UnitType.SUBMARINE,
      UnitType.UNCONTROL_MINE, UnitType.UNCONTROL_MINE,
      UnitType.CONTROL_MINE, UnitType.CONTROL_MINE,
    ];
    for (const t of redUnits) {
      const h = findStartHex(Side.RED);
      spawn(Side.RED, t, h.q, h.r);
    }

    showToast('Nytt slag', 'Skärgården är genererad. Blå börjar.');
    updateUI();
    draw();
  }

  // =====================================================
  // Regler och hjälpfunktioner
  // =====================================================
  function isWater(q, r) {
    if (!inBounds({ q, r })) return false;
    return !getCell(q, r).land;
  }

  function canSelect(u) {
    return u.side === activeSide;
  }

  function legalMoves(u) {
    const st = UNIT_STATS[u.type];
    const origin = { q: u.q, r: u.r };
    const res = [];
    const visited = new Set([keyOf(origin.q, origin.r)]);
    const queue = [{ h: origin, d: 0 }];

    while (queue.length) {
      const { h, d } = queue.shift();
      for (const dir of HEX_DIRS) {
        const nh = { q: h.q + dir.q, r: h.r + dir.r };
        if (!inBounds(nh)) continue;

        const k = keyOf(nh.q, nh.r);
        if (visited.has(k)) continue;
        if (!isWater(nh.q, nh.r)) continue;
        if (unitAt(nh.q, nh.r)) continue;

        const nd = d + 1;
        if (nd <= st.move) {
          visited.add(k);
          res.push(nh);
          queue.push({ h: nh, d: nd });
        }
      }
    }
    return res;
  }

  function enemiesInRange(u) {
    const st = UNIT_STATS[u.type];
    return units.filter(
      (o) =>
        o.side !== u.side &&
        hexDistance({ q: u.q, r: u.r }, { q: o.q, r: o.r }) <= st.range
    );
  }

  function adjacentWaterHexes(u) {
    const res = [];
    for (const dir of HEX_DIRS) {
      const h = { q: u.q + dir.q, r: u.r + dir.r };
      if (!inBounds(h)) continue;
      if (!isWater(h.q, h.r)) continue;
      if (unitAt(h.q, h.r)) continue;
      res.push(h);
    }
    return res;
  }

  function applyMineTrigger(q, r, enteringSide) {
    const m = mines.get(keyOf(q, r));
    if (!m) return false;
    if (m.side === enteringSide) return false;

    mines.delete(keyOf(q, r));
    const u = unitAt(q, r);
    if (u) {
      u.hp -= 2;
      showToast('Mina!', `${u.type} tar 2 skada.`);
      if (u.hp <= 0) {
        showToast('Sänkt!', `${u.type} sjunker.`);
        units = units.filter((x) => x.id !== u.id);
        if (selectedId === u.id) selectedId = null;
      }
    }
    return true;
  }

  function checkWin() {
    const blue = units.some((u) => u.side === Side.BLUE);
    const red = units.some((u) => u.side === Side.RED);
    if (!blue || !red) {
      const winner = blue ? Side.BLUE : Side.RED;
      showToast(
        'Spelet är slut',
        `${winner} vinner! Tryck "Nytt slag" för att spela igen.`
      );
      return true;
    }
    return false;
  }

  // Line-of-sight check: can see from h1 to h2?
  // Land blocks all sight. Skerries only block sonar (underwater sensors).
  function hasLineOfSight(h1, h2, isSonar = false) {
    const dist = hexDistance(h1, h2);
    if (dist === 0) return true;

    // Bresenham-like hex line tracing
    const steps = [];
    for (let i = 0; i <= dist; i++) {
      const t = i / dist;
      const q = h1.q + (h2.q - h1.q) * t;
      const r = h1.r + (h2.r - h1.r) * t;
      const h = hexRound(q, r);
      if (!inBounds(h)) return false;
      const cell = getCell(h.q, h.r);
      if (cell.land) return false; // Land blocks all sight
      if (isSonar && cell.isSkerry) return false; // Skerries only block sonar
    }
    return true;
  }

  // Attempt to detect a red unit for blue unit with sensors
  function updateDetection() {
    // For each blue unit, check what red units it can detect
    for (const blue of units.filter((u) => u.side === Side.BLUE)) {
      const sensor = SENSOR_CONFIG[blue.type];
      if (!sensor || !sensor.type) continue; // No sensor

      const range = blue.sensorActive ? sensor.activeRange : sensor.passiveRange;

      for (const red of units.filter((u) => u.side === Side.RED)) {
        // Skip if already known
        if (red.detected && red.identified) continue;

        // Check line of sight
        const isSonar = sensor.type === SensorType.SONAR;
        if (!hasLineOfSight({ q: blue.q, r: blue.r }, { q: red.q, r: red.r }, isSonar)) {
          continue;
        }

        // For sonar, must be same depth to detect underwater units
        if (isSonar && SUBMARINE_TYPES.has(red.type)) {
          if (blue.depth !== red.depth) continue;
        }

        // For radar, cannot detect underwater units
        if (sensor.type === SensorType.RADAR && SUBMARINE_TYPES.has(red.type)) {
          continue;
        }

        // Check distance and randomness
        const dist = hexDistance({ q: blue.q, r: blue.r }, { q: red.q, r: red.r });
        const randFactor = Math.floor(Math.random() * 10) + 1;
        if (dist + randFactor > range) continue;

        // Detected!
        red.detected = true;

        // Check identification: randFactor - 5 > 0
        const identRand = Math.floor(Math.random() * 10) + 1;
        if (identRand - 5 > 0) {
          red.identified = true;
        }
      }
    }
  }


  function canvasToWorld(ev) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: ev.clientX - rect.left,
      y: ev.clientY - rect.top,
    };
  }

  function worldToHex(ev) {
    const p = canvasToWorld(ev);
    const origin = getMapOrigin();
    const wx = p.x - origin.x;
    const wy = p.y - origin.y;
    return pixelToHex(wx, wy);
  }

  function tryAttack(attacker, target) {
    if (actionsLeft <= 0) {
      showToast('Inga åtgärder kvar', 'Avsluta tur för att fortsätta.');
      return;
    }
    const st = UNIT_STATS[attacker.type];
    const d = hexDistance(
      { q: attacker.q, r: attacker.r },
      { q: target.q, r: target.r }
    );
    if (d > st.range) {
      showToast('För långt bort', 'Målet är utanför räckvidd.');
      return;
    }

    let dmg = 1;
    if (attacker.type === UnitType.SUBMARINE && d === 1) dmg = 2;

    target.hp -= dmg;
    actionsLeft -= 1;
    showToast('Träff', `${attacker.type} träffar ${target.type} för ${dmg} skada.`);

    if (attacker.side === Side.RED && target.side === Side.BLUE) {
      if (target.hp <= 0) {
        pushRedMove(`Röd enhet sänkte ${target.type}`);
      } else {
        pushRedMove(`Röd enhet attackerade ${target.type}`);
      }
    }

    if (target.hp <= 0) {
      units = units.filter((u) => u.id !== target.id);
      if (selectedId === target.id) selectedId = null;
      showToast('Sänkt!', `${target.type} sjunker.`);
    }

    mode = 'order';
    updateUI();
    draw();
    checkWin();
  }

  // =====================================================
  // Knappar
  // =====================================================
  btnEndTurn.addEventListener('click', () => {
    endTurn();
  });

  function endTurn() {
    selectedId = null;
    mode = 'order';
    activeSide = activeSide === Side.BLUE ? Side.RED : Side.BLUE;
    if (activeSide === Side.BLUE) turn += 1;
    actionsLeft = ACTIONS_PER_TURN;

    // Clear redMoves only at the start of Red's next turn
    if (activeSide === Side.RED && turn !== redMovesLastRedTurn) {
      redMoves = [];
      redMovesLastRedTurn = turn;
      updateRedMovesUI();
    }

    showToast('Ny tur', `${activeSide} är aktiv.`);
    updateUI();
    draw();

    if (activeSide === Side.RED) runSimpleAI();
  }

  btnReset.addEventListener('click', () => {
    resetGame();
  });

  btnHelp.addEventListener('click', () => {
    showToast(
      'Hjälp',
      'Välj en enhet, flytta/attackera/minera. Prototyp: inga sensorer, ingen siktlinje.'
    );
  });

  btnAttack.addEventListener('click', () => {
    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel || sel.side !== activeSide) return;
    mode = 'attack';
    updateUI();
    draw();
  });

  btnMine.addEventListener('click', () => {
    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel || sel.side !== activeSide) return;
    if (sel.minesLeft <= 0) return;
    mode = 'mine';
    updateUI();
    draw();
  });

  btnDepthUp.addEventListener('click', () => {
    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel || sel.side !== activeSide) return;
    if (!SUBMARINE_TYPES.has(sel.type)) return;
    if (actionsLeft <= 0) return;
    // Cannot go deeper than water depth at this hex
    const cell = getCell(sel.q, sel.r);
    const maxDepth = Math.ceil(cell.depthNormalized * MAX_DEPTH);
    if (sel.depth >= maxDepth) return;
    sel.depth += 1;
    actionsLeft -= 1;
    updateUI();
    draw();
  });

  btnDepthDown.addEventListener('click', () => {
    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel || sel.side !== activeSide) return;
    if (!SUBMARINE_TYPES.has(sel.type)) return;
    if (sel.depth <= 0) return;
    if (actionsLeft <= 0) return;
    sel.depth -= 1;
    actionsLeft -= 1;
    updateUI();
    draw();
  });

  btnToggleSensor.addEventListener('click', () => {
    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel || sel.side !== activeSide) return;
    if (!SENSOR_CONFIG[sel.type] || !SENSOR_CONFIG[sel.type].type) return;
    sel.sensorActive = !sel.sensorActive;
    updateUI();
    draw();
  });

  // =====================================================
  // Enkel AI för röd spelare
  // =====================================================
  function runSimpleAI() {
    let steps = 0;

    function tick() {
      if (activeSide !== Side.RED) return;
      if (actionsLeft <= 0) {
        endTurn();
        return;
      }
      if (checkWin()) return;

      const reds = units.filter((u) => u.side === Side.RED);
      const blues = units.filter((u) => u.side === Side.BLUE);
      if (!reds.length || !blues.length) return;

      // Attackera om möjligt
      for (const u of reds) {
        const inR = enemiesInRange(u);
        if (inR.length) {
          inR.sort((a, b) => a.hp - b.hp);
          selectedId = u.id;
          mode = 'attack';
          updateUI();
          draw();
          tryAttack(u, inR[0]);
          steps++;
          if (steps >= ACTIONS_PER_TURN) {
            endTurn();
          } else {
            setTimeout(tick, 350);
          }
          return;
        }
      }

      // Flytta mot närmaste fiende
      const mover = reds[Math.floor(Math.random() * reds.length)];
      const target = blues.reduce(
        (best, b) => {
          const d = hexDistance({ q: mover.q, r: mover.r }, { q: b.q, r: b.r });
          return !best || d < best.d ? { b, d } : best;
        },
        null
      ).b;

      const moves = legalMoves(mover);
      if (!moves.length) {
        steps++;
        setTimeout(tick, 250);
        return;
      }

      moves.sort(
        (a, b) =>
          hexDistance(a, { q: target.q, r: target.r }) -
          hexDistance(b, { q: target.q, r: target.r })
      );

      const dest = moves[0];
      selectedId = mover.id;
      mode = 'order';
      mover.q = dest.q;
      mover.r = dest.r;
      actionsLeft -= 1;
      if (mines.has(keyOf(dest.q, dest.r))) {
        applyMineTrigger(dest.q, dest.r, mover.side);
      }
      updateUI();
      draw();
      steps++;
      if (steps >= ACTIONS_PER_TURN) {
        endTurn();
      } else {
        setTimeout(tick, 350);
      }
    }

    setTimeout(tick, 450);
  }

  // =====================================================
  // Färger och ritning
  // =====================================================
  const LEGEND_COLORS = (() => {
    const root = getComputedStyle(document.documentElement);
    return {
      waterShallow: (root.getPropertyValue('--water-shallow') || '#1a3a7a').trim(),
      waterMid: (root.getPropertyValue('--water-mid') || '#164e8a').trim(),
      waterDeep: (root.getPropertyValue('--water-deep') || '#103863').trim(),
      land: (root.getPropertyValue('--land') || '#2e5d2c').trim(),
      skerry: (root.getPropertyValue('--skerry') || '#888888').trim(),
      unitBlue: (root.getPropertyValue('--unit-blue') || '#3a7aff').trim(),
      unitRed: (root.getPropertyValue('--unit-red') || '#ff3a5c').trim(),
      mine: (root.getPropertyValue('--mine') || '#ffd54a').trim(),
      range: (root.getPropertyValue('--range') || 'rgba(255,255,255,.18)').trim(),
    };
  })();

  function waterColor(norm) {
    const t = Math.min(1, Math.max(0, norm));
    if (t < 0.33) return LEGEND_COLORS.waterShallow;
    if (t < 0.66) return LEGEND_COLORS.waterMid;
    return LEGEND_COLORS.waterDeep;
  }

  // =====================================================
  // Rendering
  // =====================================================
  function getMapOrigin() {
    const tl = hexToPixel(0, 0);
    const br = hexToPixel(GRID_W - 1, GRID_H - 1);
    const mapW = br.x - tl.x + HEX_SIZE * 2;
    const mapH = br.y - tl.y + HEX_SIZE * 2;
    const rect = canvas.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    return {
      x: cx - mapW / 2 + HEX_SIZE,
      y: cy - mapH / 2 + HEX_SIZE,
    };
  }

  function draw() {
    if (!canvas.width || !canvas.height) return;
    const rect = canvas.getBoundingClientRect();
    ctx.clearRect(0, 0, rect.width, rect.height);

    // Update detection before rendering
    if (activeSide === Side.BLUE) {
      updateDetection();
    }

    const origin = getMapOrigin();
    const sel = selectedId ? getUnit(selectedId) : null;
    const moveSet =
      sel && sel.side === activeSide && mode === 'order' ? legalMoves(sel) : [];
    const attackSet =
      sel && sel.side === activeSide && mode === 'attack'
        ? enemiesInRange(sel).map((u) => ({ q: u.q, r: u.r }))
        : [];
    const mineSet =
      sel && sel.side === activeSide && mode === 'mine'
        ? adjacentWaterHexes(sel)
        : [];

    // Rita hexrutor
    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        const c = getCell(q, r);
        const p = hexToPixel(q, r);
        const x = origin.x + p.x;
        const y = origin.y + p.y;
        const fill = c.isSkerry ? LEGEND_COLORS.skerry : c.land ? LEGEND_COLORS.land : waterColor(c.depthNormalized);
        drawHex(x, y, fill, 'rgba(255,255,255,.08)', 1);

        // Draw coordinate label
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.85;
        ctx.fillText(`${q},${r}`, x, y - HEX_SIZE * 0.45);
        ctx.restore();

        if (sel && sel.q === q && sel.r === r) {
          drawHex(x, y, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.45)', 2);
        }
        if (moveSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.18)', 2);
        }
        if (attackSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(255,58,92,.10)', 'rgba(255,58,92,.40)', 2);
        }
        if (mineSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(255,213,74,.08)', 'rgba(255,213,74,.40)', 2);
        }

        const m = mines.get(keyOf(q, r));
        if (m) {
          ctx.beginPath();
          ctx.arc(x, y, 5.5, 0, Math.PI * 2);
          ctx.fillStyle = LEGEND_COLORS.mine;
          ctx.fill();
          ctx.strokeStyle = 'rgba(0,0,0,.35)';
          ctx.lineWidth = 2;
          ctx.stroke();
        }
      }
    }

    // Rita enheter
    for (const u of units) {
      // Hide red units unless detected (or if we're the red player)
      if (u.side === Side.RED && !u.detected && activeSide !== Side.RED) {
        continue; // Skip rendering
      }

      const p = hexToPixel(u.q, u.r);
      const x = origin.x + p.x;
      const y = origin.y + p.y;
      const col = u.side === Side.BLUE ? LEGEND_COLORS.unitBlue : LEGEND_COLORS.unitRed;

      // Unit circle (dimmer if not identified)
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = col;
      if (u.side === Side.RED && u.detected && !u.identified) {
        // Detected but not identified: dimmer
        ctx.globalAlpha = 0.5;
      }
      ctx.fill();
      ctx.globalAlpha = 1.0;
      ctx.strokeStyle = 'rgba(255,255,255,.35)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Type glyph or question mark
      ctx.fillStyle = '#0b1220';
      ctx.font = 'bold 10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (u.side === Side.RED && u.detected && !u.identified) {
        ctx.fillText('?', x, y); // Question mark for detected but not identified
      } else {
        ctx.fillText(typeGlyph(u.type), x, y);
      }

      // HP-bar (only show if identified or our own unit)
      if (u.side === Side.BLUE || u.identified) {
        const maxHP = UNIT_STATS[u.type].hp;
        const w = 26;
        const h = 5;
        const hpw = Math.max(0, Math.min(1, u.hp / maxHP)) * w;
        ctx.fillStyle = 'rgba(0,0,0,.45)';
        ctx.fillRect(x - w / 2, y + 16, w, h);
        ctx.fillStyle = 'rgba(255,255,255,.75)';
        ctx.fillRect(x - w / 2, y + 16, hpw, h);
      }

      // Selection ring
      if (selectedId === u.id) {
        ctx.beginPath();
        ctx.arc(x, y, 18, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.65)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    updateUI();
  }

  function typeGlyph(t) {
    if (t === UnitType.FRIGATE) return 'F';
    if (t === UnitType.STEALTH_CORVETTE) return 'S';
    if (t === UnitType.SUBMARINE) return 'U';
    if (t === UnitType.UAV) return 'A';
    if (t === UnitType.USV) return 'V';
    if (t === UnitType.UUV) return 'u';
    if (t === UnitType.SUBMARINE_HUNTER) return 'H';
    if (t === UnitType.CONVENTIONAL_CORVETTE) return 'C';
    if (t === UnitType.UNCONTROL_MINE) return 'X';
    if (t === UnitType.CONTROL_MINE) return 'M';
    return '?';
  }

  // =====================================================
  // Inmatningshantering (Canvas click)
  // =====================================================
  canvas.addEventListener('click', (ev) => {
    const h = worldToHex(ev);
    if (!inBounds(h)) return;

    const clickedUnit = unitAt(h.q, h.r);
    if (clickedUnit) {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (
        mode === 'attack' &&
        sel &&
        sel.side === activeSide &&
        clickedUnit.side !== activeSide
      ) {
        tryAttack(sel, clickedUnit);
        return;
      }
      selectedId = clickedUnit.id;
      mode = 'order';
      updateUI();
      draw();
      return;
    }

    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel) return;
    if (sel.side !== activeSide) return;
    if (actionsLeft <= 0) {
      showToast('Inga åtgärder kvar', 'Avsluta tur för att fortsätta.');
      return;
    }

    if (mode === 'order') {
      const moves = legalMoves(sel);
      if (!moves.some((m) => hexEq(m, h))) {
        showToast('Ogiltigt drag', 'Du kan bara flytta till markerade vattenhexar.');
        return;
      }
      // Check if submarine is too deep for destination hex
      if (SUBMARINE_TYPES.has(sel.type)) {
        const destCell = getCell(h.q, h.r);
        const maxDepthAtDest = Math.ceil(destCell.depthNormalized * MAX_DEPTH);
        if (sel.depth > maxDepthAtDest) {
          showToast('För djupt', `Du kan inte flytta till hexagonen på djup ${sel.depth}. Max djup där är ${maxDepthAtDest}.`);
          return;
        }
      }

      // --- BEGIN: Mine trigger for passing over or touching any mine cell along the true line ---
      // Use hex line interpolation (lerp + hexRound) to get all cells the line passes through
      const start = { q: sel.q, r: sel.r };
      const end = { q: h.q, r: h.r };
      const dist = hexDistance(start, end);
      let mineTriggered = false;
      let stopQ = sel.q;
      let stopR = sel.r;
      console.log(`Blue unit starts at (${sel.q},${sel.r})`);
      for (let i = 1; i <= dist; i++) {
        const t = i / dist;
        const qf = sel.q + (h.q - sel.q) * t;
        const rf = sel.r + (h.r - sel.r) * t;
        const hex = hexRound(qf, rf);
        // Only check in-bounds
        if (!inBounds(hex)) continue;
        console.log(`Checking hex (${hex.q},${hex.r}) for mine, i=${i}, dist=${dist}`);
        if (mines.has(keyOf(hex.q, hex.r))) {
          console.log('Mine detected at', hex.q, hex.r, 'stopping movement');
          stopQ = hex.q;
          stopR = hex.r;
          mineTriggered = true;
          break;
        }
      }
      if (mineTriggered) {
        sel.q = stopQ;
        sel.r = stopR;
        actionsLeft -= 1;
        applyMineTrigger(stopQ, stopR, sel.side);
        console.log(`Blue unit ends at (${sel.q},${sel.r})`);
        updateUI();
        draw();
        checkWin();
        return;
      }
      // No mine encountered, move normally
      sel.q = h.q;
      sel.r = h.r;
      actionsLeft -= 1;
      console.log(`Blue unit ends at (${sel.q},${sel.r})`);
      updateUI();
      draw();
      checkWin();
      return;
    }

    if (mode === 'mine') {
      if (sel.minesLeft <= 0) {
        showToast('Inga minor kvar', 'Den här enheten kan inte minera mer.');
        return;
      }
      const adj = adjacentWaterHexes(sel);
      if (!adj.some((a) => hexEq(a, h))) {
        showToast('Ogiltig minering', 'Du kan bara lägga mina på intilliggande vattenhex.');
        return;
      }
      mines.set(keyOf(h.q, h.r), { side: sel.side });
      sel.minesLeft -= 1;
      actionsLeft -= 1;
      mode = 'order';
      showToast('Mina utlagd', 'Ett sund är nu minerat.');
      updateUI();
      draw();
      return;
    }
  });

  // =====================================================
  // Initiering
  // =====================================================
  resetGame();
  resize();
  setTimeout(
    () =>
      showToast(
        'Tips',
        'Välj din enhet (Blå) och flytta/attackera/minera. Röd styrs av enkel AI.'
      ),
    450
  );
})();
