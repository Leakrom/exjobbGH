(() => {
  try {
    console.log('=== Script.js loading START ===');
    
    // Add global error handler for debugging
    window.addEventListener('error', (e) => {
      console.error('Global error:', e.error);
    });
    
    console.log('Step 1: Defining game constants...');
    
    // =====================================================
    // KONFIGURATION
    // =====================================================
    const GRID_W = 20;
    const GRID_H = 20;
    const HEX_SIZE = 34;
    const ACTIONS_PER_TURN = 3;
    
    console.log('Step 2: Game constants defined');

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

  // Current selected map
  let selectedMapIndex = 0;

  // =====================================================
  // Canvas och rendering setup
  // =====================================================
  console.log('Step 3: Getting canvas element...');
  const canvas = document.getElementById('c');
  if (!canvas) {
    console.error('FATAL: Canvas element "c" not found - game cannot start');
    const err = new Error('Canvas not found');
    console.error(err);
    throw err;
  }
  
  console.log('Step 4: Getting canvas 2D context...');
  let ctx;
  try {
    ctx = canvas.getContext('2d');
  } catch (getCtxErr) {
    console.error('FATAL: Cannot get 2D context', getCtxErr);
    throw new Error('Cannot initialize canvas context');
  }
  
  if (!ctx) {
    console.error('FATAL: Canvas context is null');
    throw new Error('Canvas context is null');
  }
  
  console.log('Step 5: Getting stage wrapper...');
  const stageWrap = document.getElementById('stageWrap');
  if (!stageWrap) {
    console.error('FATAL: Stage wrapper element "stageWrap" not found');
    throw new Error('stageWrap not found');
  }
  
  console.log('Step 6: DOM elements acquired successfully');

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
  let mines = new Map();      // faktiska minor
  let minefields = [];        // visuella områden
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

  // Map selection buttons
  const btnMap1 = document.getElementById('btnMap1');
  const btnMap2 = document.getElementById('btnMap2');
  const btnMap3 = document.getElementById('btnMap3');
  const btnMap4 = document.getElementById('btnMap4');

  const elRedMove1 = document.getElementById('redMove1');
  const elRedMove2 = document.getElementById('redMove2');
  const elRedMove3 = document.getElementById('redMove3');

  const toast = document.getElementById('toast');
  let toastTimer = null;

  // Sessionlogg
  let sessionLogBuffer = '';
  const sessionStartedAt = new Date();
  const sessionId = `session-${sessionStartedAt.toISOString()}`;
  const AUTO_LOG_DIR = 'C:\\Users\\linene\\exjobbGH\\loggfiler';
  let sessionHeaderWritten = false;
  let logStatusWrapEl = null;
  let logStatusEl = null;

  function ensureLogStatusElement() {
    if (logStatusEl) return logStatusEl;

    logStatusWrapEl = document.createElement('div');
    logStatusWrapEl.style.marginTop = '10px';
    logStatusWrapEl.style.display = 'flex';
    logStatusWrapEl.style.alignItems = 'center';
    logStatusWrapEl.style.gap = '8px';

    logStatusEl = document.createElement('div');
    logStatusEl.id = 'logStatus';
    logStatusEl.style.padding = '4px 8px';
    logStatusEl.style.borderRadius = '8px';
    logStatusEl.style.border = '1px solid rgba(255,255,255,.14)';
    logStatusEl.style.background = 'rgba(15, 23, 42, .30)';
    logStatusEl.style.color = 'rgba(248,250,252,.9)';
    logStatusEl.style.font = '11px system-ui, -apple-system, Segoe UI, Roboto, Arial';
    logStatusEl.textContent = 'Logg: automatisk lagring';
    logStatusEl.title = `Sparas i: ${AUTO_LOG_DIR}`;

    logStatusWrapEl.appendChild(logStatusEl);

    const targetPanel = btnEndTurn && btnEndTurn.closest('.panel');
    if (targetPanel) {
      targetPanel.appendChild(logStatusWrapEl);
    } else {
      document.body.appendChild(logStatusWrapEl);
    }

    return logStatusEl;
  }

  function setLogStatus(text) {
    ensureLogStatusElement();
    logStatusEl.textContent = `Logg: ${text}`;
  }

  function getTimestamp() {
    return new Date().toISOString();
  }

  function logEvent(text) {
    const line = `[${getTimestamp()}] ${text}`;
    sessionLogBuffer += `${line}\n`;
    console.log('[GAME LOG]', line);
  }

  async function flushSessionLogToFile() {
    if (!sessionLogBuffer) return;

    setLogStatus('sparar...');

    const content = sessionLogBuffer;

    try {
      const response = await fetch('/api/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sessionId,
          content,
        }),
      });

      if (!response.ok) {
        throw new Error(`Loggservern svarade ${response.status}`);
      }

      sessionLogBuffer = '';
      setLogStatus(`sparad ${new Date().toLocaleTimeString()}`);
    } catch (e) {
      console.error('Kunde inte spara sessionslogg:', e);
      setLogStatus('sparfel (starta server.js)');
      throw e;
    }
  }

  function showBlueTurnReflectionPopup() {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,.55)';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.zIndex = '9999';

      const dialog = document.createElement('div');
      dialog.style.width = 'min(92vw, 620px)';
      dialog.style.background = '#0f172a';
      dialog.style.color = '#f8fafc';
      dialog.style.border = '1px solid rgba(255,255,255,.2)';
      dialog.style.borderRadius = '10px';
      dialog.style.padding = '14px';
      dialog.style.boxSizing = 'border-box';

      const heading = document.createElement('h3');
      heading.textContent = 'Avsluta tur';
      heading.style.margin = '0 0 10px 0';
      heading.style.fontSize = '16px';
      dialog.appendChild(heading);

      const l1 = document.createElement('label');
      l1.textContent = 'Varför gjorde du det här draget?';
      l1.style.display = 'block';
      l1.style.marginBottom = '6px';
      dialog.appendChild(l1);

      const t1 = document.createElement('textarea');
      t1.rows = 3;
      t1.style.width = '100%';
      t1.style.boxSizing = 'border-box';
      t1.style.borderRadius = '6px';
      t1.style.marginBottom = '10px';
      dialog.appendChild(t1);

      const l2 = document.createElement('label');
      l2.textContent = 'Vad tänker du att det ska få för resultat?';
      l2.style.display = 'block';
      l2.style.marginBottom = '6px';
      dialog.appendChild(l2);

      const t2 = document.createElement('textarea');
      t2.rows = 3;
      t2.style.width = '100%';
      t2.style.boxSizing = 'border-box';
      t2.style.borderRadius = '6px';
      t2.style.marginBottom = '12px';
      dialog.appendChild(t2);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      actions.style.gap = '8px';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = 'Avbryt';

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = 'Spara svar';

      actions.appendChild(cancelBtn);
      actions.appendChild(saveBtn);
      dialog.appendChild(actions);

      overlay.appendChild(dialog);
      document.body.appendChild(overlay);
      t1.focus();

      function cleanup() {
        overlay.remove();
      }

      cancelBtn.addEventListener('click', () => {
        cleanup();
        resolve(null);
      });

      saveBtn.addEventListener('click', async () => {
        const answer1 = t1.value.trim();
        const answer2 = t2.value.trim();

        cleanup();
        resolve({ answer1, answer2 });
      });
    });
  }

  function showToast(title, msg, msg2, msg3) {
    if (!toast) return; // Toast element not found, skip
    if (msg2 == undefined) msg2 = '';
    if (msg3 == undefined) msg3 = '';
    toast.style.display = 'block';
    toast.innerHTML = `<b>${escapeHtml(title)}</b>
                      <small>${escapeHtml(msg)}<br>
                             ${escapeHtml(msg2)}<br>
                             ${escapeHtml(msg3)}</small>`;
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

  function placeMine(q, r, side) {
    mines.set(keyOf(q, r), { side });
    createMinefieldArea(q, r);
  }

  function createMinefieldArea(centerQ, centerR) {
    const targetSize = 12;
    const start = { q: centerQ, r: centerR };

    const cells = new Set();
    const frontier = [start];

    cells.add(keyOf(start.q, start.r));

    while (cells.size < targetSize && frontier.length > 0) {
      const idx = Math.floor(Math.random() * frontier.length);
      const current = frontier.splice(idx, 1)[0];
      let added = false;

      const dirs = [...HEX_DIRS].sort(() => Math.random() - 0.5);

      for (const dir of dirs) {
        const next = { q: current.q + dir.q, r: current.r + dir.r };
        const k = keyOf(next.q, next.r);

        if (!inBounds(next)) continue;
        if (!isWater(next.q, next.r)) continue;
        if (cells.has(k)) continue;

        cells.add(k);
        frontier.push(next);
        added = true;

        if (cells.size >= targetSize) break;
      }

      if (added) {
        frontier.push(current);
      }
    }

    minefields.push({
      center: { q: centerQ, r: centerR },
      cells
    });
  }

/*   // Ta bort mina från mines-Map och dess visuella minefield
  function removeMineAndField(q, r) {
    const key = keyOf(q, r);

    // Ta bort från mines
    mines.delete(key);

    // Ta bort matchande minfält
    minefields = minefields.filter(
      field => !(field.center.q === q && field.center.r === r)
    );
  } */

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
    if (
      !elTurnPill || !elPhasePill || !elActivePlayer || !elActionsLeft ||
      !elSelType || !elSelSide || !elSelHP || !elSelMove || !elSelRange ||
      !elSelDepth || !elSelMines || !btnAttack || !btnMine || !btnDepthUp ||
      !btnDepthDown || !btnToggleSensor
    ) {
      return;
    }

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
      btnToggleSensor.innerHTML = sel.sensorActive
        ? 'Växla sensorläge<br>(<span class="sensor-active">Aktiv</span>)'
        : 'Växla sensorläge<br>(Passiv)';
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

  function mineAt(q, r, enteringSide) {
  // Mina från mines-Map
  const mapMine = mines.get(keyOf(q, r));
  if (mapMine && mapMine.side !== enteringSide) {
    return { type: 'map' };
  }

  // Mina som är en enhet
  const unitMine = units.find(
    (u) =>
      u.q === q &&
      u.r === r &&
      u.side !== enteringSide &&
      (u.type === UnitType.UNCONTROL_MINE ||
       u.type === UnitType.CONTROL_MINE)
  );

  if (unitMine) {
    return { type: 'unit', unit: unitMine };
  }

  return null;
}


  // =====================================================
  // Kartgenerering: ladda från fördefinierad konfiguration
  // =====================================================
  function generateMap() {
    // Load the selected map configuration
    const mapConfig = MAP_CONFIGS[selectedMapIndex];
    map = [];
    mines = new Map();
    minefields = [];
    
    // Copy cells from the map configuration
    for (const cell of mapConfig.cells) {
      map.push({
        q: cell.q,
        r: cell.r,
        land: cell.land,
        isSkerry: cell.isSkerry,
        depth: cell.depth,
        depthNormalized: cell.depthNormalized
      });
    }
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

    // Om enheten är en mina → skapa minfält
    if (
      type === UnitType.UNCONTROL_MINE ||
      type === UnitType.CONTROL_MINE
    ) {
      createMinefieldArea(q, r);
    }
  }

  // Find a suitable water hex for spawning a unit for the given side.
  // Uses predefined start positions from the map configuration.
  let blueSpawnIndex = 0;
  let redSpawnIndex = 0;
  let loadedMapIndex = -1; // Track which map is currently loaded

  // Kartorna genereras on-demand när de behövs.
  function ensureMapLoaded(mapIndex) {
    console.log('    [ensureMapLoaded] Called with mapIndex:', mapIndex);
    console.log('    [ensureMapLoaded] Current loadedMapIndex:', loadedMapIndex);
    
    // Only load map once
    if (loadedMapIndex === mapIndex) {
      console.log('    [ensureMapLoaded] Map already loaded, returning');
      return;
    }
    
    // Generate this specific map if not already generated
    console.log('    [ensureMapLoaded] Checking if map cells exist:', MAP_CONFIGS[mapIndex].cells.length);
    if (MAP_CONFIGS[mapIndex].cells.length === 0) {
      console.log('    [ensureMapLoaded] MAP IS EMPTY! Generating map', mapIndex + 1);
      console.log('    [ensureMapLoaded] Calling generateMapWithSeed with seed:', MAP_CONFIGS[mapIndex].seed);
      const cells = generateMapWithSeed(MAP_CONFIGS[mapIndex].seed, GRID_W, GRID_H);
      console.log('    [ensureMapLoaded] generateMapWithSeed returned with', cells.length, 'cells');
      MAP_CONFIGS[mapIndex].cells = cells;
      console.log('    [ensureMapLoaded] Map cells assigned');
    } else {
      console.log('    [ensureMapLoaded] Map already has', MAP_CONFIGS[mapIndex].cells.length, 'cells');
    }
    
    loadedMapIndex = mapIndex;
    console.log('    [ensureMapLoaded] loadedMapIndex set to:', loadedMapIndex);
    console.log('    [ensureMapLoaded] COMPLETE');
  }

  function findStartHex(side) {
    const mapConfig = MAP_CONFIGS[selectedMapIndex];

    function findNearestWater(start) {
      if (!inBounds(start)) return null;
      if (isWater(start.q, start.r)) return start;

      const visited = new Set([keyOf(start.q, start.r)]);
      const queue = [start];

      while (queue.length) {
        const curr = queue.shift();
        for (const dir of HEX_DIRS) {
          const next = { q: curr.q + dir.q, r: curr.r + dir.r };
          if (!inBounds(next)) continue;
          const k = keyOf(next.q, next.r);
          if (visited.has(k)) continue;
          if (isWater(next.q, next.r)) return next;
          visited.add(k);
          queue.push(next);
        }
      }

      return null;
    }
    
    if (side === Side.BLUE) {
      const positions = mapConfig.blueStartPositions;
      if (blueSpawnIndex < positions.length) {
        const pos = positions[blueSpawnIndex++];
        const waterPos = findNearestWater(pos); //onödigt, hårdkoda i map_configs istället
        if (waterPos) return waterPos;
      }
    } else {
      const positions = mapConfig.redStartPositions;
      if (redSpawnIndex < positions.length) {
        const pos = positions[redSpawnIndex++];
        const waterPos = findNearestWater(pos); //onödigt, hårdkoda i map_configs istället
        if (waterPos) return waterPos;
      }
    }
    
    // Fallback if we run out of predefined positions
    return findNearestWater({ q: side === Side.BLUE ? 5 : 14, r: 10 }) ||
      { q: side === Side.BLUE ? 5 : 14, r: 10 };
  }


  //////////////

  function resetGame() {
    try {
      console.log('====== BUTTON CLICKED: resetGame() STARTING ======');
      console.log('selectedMapIndex:', selectedMapIndex);

      if (!sessionHeaderWritten) {
        sessionHeaderWritten = true;
        logEvent('============================================================');
        logEvent(`Spelsession startad: ${sessionId}`);
      }
      logEvent(`Nytt slag initieras, karta: ${MAP_CONFIGS[selectedMapIndex].name}`);
      
      console.log('Step A: Calling ensureMapLoaded...');
      ensureMapLoaded(selectedMapIndex);
      console.log('Step B: ensureMapLoaded completed');
      
      console.log('Step C: Resetting game state...');
      nextId = 1;
      turn = 1;
      activeSide = Side.BLUE;
      actionsLeft = ACTIONS_PER_TURN;
      selectedId = null;
      mode = 'order';
      blueSpawnIndex = 0;
      redSpawnIndex = 0;
      console.log('Step D: Game state reset');
      
      console.log('Step E: Calling generateMap...');
      generateMap();
      console.log('Step F: generateMap completed, map length:', map.length);
      
      console.log('Step G: Clearing units, preparing to spawn...');
      units = [];
      
      console.log('Step H: Spawning blue units...');
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
      console.log('Step I: Blue units spawned, total units:', units.length);

      console.log('Step J: Spawning red units...');
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
      console.log('Step K: Red units spawned, total units:', units.length);
      
      console.log('Step L: Showing toast message...');
      showToast('Nytt slag', `${MAP_CONFIGS[selectedMapIndex].name} är vald. Blå börjar.`);
      console.log('Step M: Toast shown');
      
      console.log('Step N: Calling updateUI...');
      updateUI();
      console.log('Step O: updateUI completed');
      
      console.log('Step P: Calling resize...');
      resize();
      console.log('Step Q: resize completed');
      
      console.log('Step R: Calling draw...');
      draw();
      console.log('Step S: draw completed');
      
      console.log('====== resetGame() COMPLETED SUCCESSFULLY ======');
    } catch (e) {
      console.error('ERROR in resetGame:', e.message);
      console.error('Stack trace:', e.stack);
    }
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
  const u = unitAt(q, r);
  if (!u) return false;

  logEvent(`Minträff: ${u.side} ${u.type} på (${q},${r}) sänks`);

  showToast('💥 Mina!', `${u.type} träffade en mina och sänks!`);

  // Ta bort minan och minfältet från mines-Map och minefields-arrayen
  //removeMineAndField(q, r);
  
  // Ta bort minan och blå enheten från units-arrayen
  units = units.filter((x) => x.id !== u.id);
  

  if (selectedId === u.id) {
    selectedId = null;
  }

  return true;
}




  function checkWin() {
    const blue = units.some((u) => u.side === Side.BLUE);
    const red = units.some((u) => 
      u.side === Side.RED && 
      u.type !== UnitType.UNCONTROL_MINE && 
      u.type !== UnitType.CONTROL_MINE
    );
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
    logEvent(`${attacker.side} attackerar: ${attacker.type} -> ${target.type}, skada=${dmg}, återstående HP mål=${Math.max(0, target.hp)}`);

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
      logEvent(`${target.side} enhet sänkt: ${target.type}`);
    }

    mode = 'order';
    updateUI();
    draw();
    checkWin();
  }

  // =====================================================
  // Knappar
  // =====================================================
  console.log('Step 7: Setting up button event listeners...');
  
  // Map selection buttons - optional, may not exist in all implementations
  try {
    if (btnMap1) {
      console.log('Step 7a: Attaching btnMap1 listener...');
      btnMap1.addEventListener('click', () => {
        console.log('>>> [CLICK EVENT] Map 1 clicked');
        console.log('>>> [CLICK EVENT] Setting selectedMapIndex to 0');
        selectedMapIndex = 0;
        console.log('>>> [CLICK EVENT] selectedMapIndex set. Calling resetGame...');
        resetGame();
        console.log('>>> [CLICK EVENT] resetGame returned');
      });
    }

    if (btnMap2) {
      console.log('Step 7b: Attaching btnMap2 listener...');
      btnMap2.addEventListener('click', () => {
        console.log('>>> [CLICK EVENT] Map 2 clicked');
        console.log('>>> [CLICK EVENT] Setting selectedMapIndex to 1');
        selectedMapIndex = 1;
        console.log('>>> [CLICK EVENT] selectedMapIndex set. Calling resetGame...');
        resetGame();
        console.log('>>> [CLICK EVENT] resetGame returned');
      });
    }

    if (btnMap3) {
      console.log('Step 7c: Attaching btnMap3 listener...');
      btnMap3.addEventListener('click', () => {
        console.log('>>> [CLICK EVENT] Map 3 clicked');
        console.log('>>> [CLICK EVENT] Setting selectedMapIndex to 2');
        selectedMapIndex = 2;
        console.log('>>> [CLICK EVENT] selectedMapIndex set. Calling resetGame...');
        resetGame();
        console.log('>>> [CLICK EVENT] resetGame returned');
      });
    }

    if (btnMap4) {
      console.log('Step 7d: Attaching btnMap4 listener...');
      btnMap4.addEventListener('click', () => {
        console.log('>>> [CLICK EVENT] Map 4 clicked');
        console.log('>>> [CLICK EVENT] Setting selectedMapIndex to 3');
        selectedMapIndex = 3;
        console.log('>>> [CLICK EVENT] selectedMapIndex set. Calling resetGame...');
        resetGame();
        console.log('>>> [CLICK EVENT] resetGame returned');
      });
    }
    
    if (btnMap1 && btnMap2 && btnMap3 && btnMap4) {
      console.log('Step 7e: All map buttons initialized successfully');
    } else {
      console.warn('Note: Not all map buttons found, but game can still run');
    }
  } catch(e) {
    console.error('Error initializing map buttons:', e);
  }

  // Other buttons
  if (btnEndTurn) {
    btnEndTurn.addEventListener('click', async () => {
      if (activeSide === Side.BLUE) {
        const answers = await showBlueTurnReflectionPopup();
        if (!answers) return;

        logEvent('BLÅ REFLEKTION');
        logEvent('Fråga: Varför gjorde du det här draget?');
        logEvent(`Svar: ${answers.answer1 || '(tomt svar)'}`);
        logEvent('Fråga: Vad tänker du att det ska få för resultat?');
        logEvent(`Svar: ${answers.answer2 || '(tomt svar)'}`);
        logEvent(`${activeSide} avslutar sin tur`);

        try {
          await flushSessionLogToFile();
        } catch (e) {
          console.error('Kunde inte spara sessionslogg:', e);
          setLogStatus('fel vid sparning');
          showToast('Loggning misslyckades', 'Kunde inte skriva till textfilen.');
          return;
        }
      } else {
        logEvent(`${activeSide} avslutar sin tur`);
      }
      endTurn();
    });
  }
  
  if (btnReset) {
    btnReset.addEventListener('click', () => {
      resetGame();
    });
  }
  
  if (btnHelp) {
    btnHelp.addEventListener('click', () => {
      showToast(
        'Hjälp',
        'Välj en enhet, flytta/attackera/minera.',
        'Minor utlöses när en enhet rör sig över dem.',
        'Minor sänker enhet direkt vid utlösning.'

      );
    });
  }
  
  if (btnAttack) {
    btnAttack.addEventListener('click', () => {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (!sel || sel.side !== activeSide) return;
      mode = 'attack';
      updateUI();
      draw();
    });
  }
  
  if (btnMine) {
    btnMine.addEventListener('click', () => {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (!sel || sel.side !== activeSide) return;
      if (sel.minesLeft <= 0) return;
      mode = 'mine';
      updateUI();
      draw();
    });
  }
  
  if (btnDepthUp) {
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
      logEvent(`${sel.side} ändrar djup upp: ${sel.type} till djup ${sel.depth}`);
      updateUI();
      draw();
    });
  }

  if (btnDepthDown) {
    btnDepthDown.addEventListener('click', () => {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (!sel || sel.side !== activeSide) return;
      if (!SUBMARINE_TYPES.has(sel.type)) return;
      if (sel.depth <= 0) return;
      if (actionsLeft <= 0) return;
      sel.depth -= 1;
      actionsLeft -= 1;
      logEvent(`${sel.side} ändrar djup ned: ${sel.type} till djup ${sel.depth}`);
      updateUI();
      draw();
    });
  }

  if (btnToggleSensor) {
    btnToggleSensor.addEventListener('click', () => {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (!sel || sel.side !== activeSide) return;
      if (!SENSOR_CONFIG[sel.type] || !SENSOR_CONFIG[sel.type].type) return;
      sel.sensorActive = !sel.sensorActive;
      logEvent(`${sel.side} växlar sensorläge: ${sel.type} -> ${sel.sensorActive ? 'Aktiv' : 'Passiv'}`);
      updateUI();
      draw();
    });
  }

  function endTurn() {
    const nextSide = activeSide === Side.BLUE ? Side.RED : Side.BLUE;
    logEvent(`Turbyte: ${activeSide} -> ${nextSide}`);
    selectedId = null;
    mode = 'order';
    activeSide = nextSide;
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
      const from = { q: mover.q, r: mover.r };
      mover.q = dest.q;
      mover.r = dest.r;
      actionsLeft -= 1;
      logEvent(`${mover.side} flyttar: ${mover.type} (${from.q},${from.r}) -> (${dest.q},${dest.r})`);
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
    if (!map || map.length === 0) {
      // Map not loaded yet, just clear canvas
      if (!canvas.width || !canvas.height) return;
      const rect = canvas.getBoundingClientRect();
      ctx.clearRect(0, 0, rect.width, rect.height);
      return;
    }
    
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

    // ===== RITA MINFÄLT-BORDER =====
    for (const field of minefields) {
      for (const key of field.cells) {
        const [q, r] = key.split(',').map(Number);

        const p = hexToPixel(q, r);
        const x = origin.x + p.x;
        const y = origin.y + p.y;

        for (let i = 0; i < HEX_DIRS.length; i++) {
          const dir = HEX_DIRS[i];
          const neighborKey = keyOf(q + dir.q, r + dir.r);

          if (!field.cells.has(neighborKey)) {
            const pts = hexPolygon(x, y);
            const a = pts[i];
            const b = pts[(i + 1) % 6];

            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.strokeStyle = "red";
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        }
      }
    }

    // Rita enheter
    for (const u of units) {
     /* // Hide red units unless detected (or if we're the red player)
      if (u.side === Side.RED && !u.detected && activeSide !== Side.RED) {
        continue; // Skip rendering
      }*/

      /*// Hide red units unless detected
      if (u.side === Side.RED && !u.detected) {
        continue; // Skip rendering
      }*/

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
      ctx.strokeStyle = u.sensorActive ? 'orange' : 'rgba(255,255,255,.35)';
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
  console.log('Step 8: Attaching canvas click listener...');
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
      const from = { q: sel.q, r: sel.r };
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
        const foundMine = mineAt(hex.q, hex.r, sel.side);
        if (foundMine) {
          stopQ = hex.q;
          stopR = hex.r;
          mineTriggered = true;

          // Ta bort minan direkt
          if (foundMine.type === 'map') {
            mines.delete(keyOf(hex.q, hex.r));
          }

          if (foundMine.type === 'unit') {
            units = units.filter((u) => u.id !== foundMine.unit.id);
          }

          break;
        }

      }
      if (mineTriggered) {
        sel.q = stopQ;
        sel.r = stopR;
        actionsLeft -= 1;
        logEvent(`${sel.side} flyttar (mina utlöst): ${sel.type} (${from.q},${from.r}) -> (${stopQ},${stopR})`);
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
      logEvent(`${sel.side} flyttar: ${sel.type} (${from.q},${from.r}) -> (${h.q},${h.r})`);
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
      placeMine(h.q, h.r, sel.side);
      sel.minesLeft -= 1;
      actionsLeft -= 1;
      mode = 'order';
      logEvent(`${sel.side} lägger mina: ${sel.type} på (${h.q},${h.r})`);
      showToast('Mina utlagd', 'Ett sund är nu minerat.');
      updateUI();
      draw();
      return;
    }
  });

  // =====================================================
  // Initiering
  // =====================================================
  console.log('========================================');
  console.log('Step 9: GAME INITIALIZATION COMPLETE');
  console.log('========================================');
  console.log('Game initialized. Waiting for user to select a map...');
  console.log('Setting up welcome toast in 450ms...');
  setTimeout(
    () => {
      console.log('Showing welcome toast now');
      ensureLogStatusElement();
      if (location.protocol === 'file:') {
        setLogStatus('starta via server.js');
      }
      showToast(
        'Välj karta',
        'Klicka på en kartknapp för att starta spelet.'
      );
    },
    450
  );
  } catch(e) {
    console.error('FATAL ERROR during script initialization:', e.message, e.stack);
    alert('Fatal error starting game: ' + e.message);
  }
})();
