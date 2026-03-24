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
    const BLUE_ACTIONS_UNLIMITED = true;
    const ASK_BLUE_REFLECTION_EACH_TURN = false; // true = efter varje blå tur, false = först vid spelavslut
    
    console.log('Step 2: Game constants defined');

    const UnitType = {
      FRIGATE: 'Fregatt',
      STEALTH_CORVETTE: 'Stealth-korvett',
      SUBMARINE: 'Ubåt',
      UAV: 'UAV - obemannad flygenhet',
      USV: 'USV - obemannad ytenhet',
      UUV: 'UUV - obemannad undervattensenhet',
      SUBMARINE_HUNTER: 'Ubåtsjakthelikopter',
      CONVENTIONAL_CORVETTE: 'Konventionell korvett',
      //UNCONTROL_MINE: 'Okontrollerbar mina',
      //CONTROL_MINE: 'Kontrollerbar mina',
      UNCONTROL_MINE: 'Mina',
      CONTROL_MINE: 'Mina',
    };

  // Unit stats: hp, move (in hexes), range, mines (mines this unit can lay), ammo (total shots)
  const UNIT_STATS = {
    [UnitType.FRIGATE]: { hp: 4, move: 4, range: 4, mines: 0, ammo: 10 },
    [UnitType.STEALTH_CORVETTE]: { hp: 2, move: 3, range: 3, mines: 0, ammo: 8 },
    [UnitType.SUBMARINE]: { hp: 3, move: 3, range: 3, mines: 0, ammo: 8 },
    [UnitType.UAV]: { hp: 1, move: 7, range: 7, mines: 0, ammo: 0 },
    [UnitType.USV]: { hp: 2, move: 2, range: 2, mines: 0, ammo: 1 },
    [UnitType.UUV]: { hp: 1, move: 2, range: 2, mines: 0, ammo: 0 },
    [UnitType.SUBMARINE_HUNTER]: { hp: 2, move: 3, range: 4, mines: 0, ammo: 0 },
    [UnitType.CONVENTIONAL_CORVETTE]: { hp: 4, move: 2, range: 3, mines: 0, ammo: 8 },
    [UnitType.UNCONTROL_MINE]: { hp: 1, move: 0, range: 0, mines: 0, ammo: 0 },
    [UnitType.CONTROL_MINE]: { hp: 1, move: 0, range: 0, mines: 0, ammo: 0 },
  };

  const Side = { BLUE: 'Blå', RED: 'Röd' };

  // Sensor types: RADAR (surface) or SONAR (underwater)
  const SensorType = { RADAR: 'Radar', SONAR: 'Sonar' };

  // Determine if a unit type is underwater capable
  const SUBMARINE_TYPES = new Set([
    UnitType.SUBMARINE,
    UnitType.UUV,
    UnitType.UNCONTROL_MINE,
    UnitType.CONTROL_MINE
  ]);

   // Determine if a unit type is airborne
  const AIRBORNE_TYPES = new Set([
    UnitType.UAV,
    UnitType.SUBMARINE_HUNTER
  ]);

  // Sensor system configuration
  const SENSOR_CONFIG = {
    [UnitType.FRIGATE]: { type: SensorType.RADAR, passiveRange: 4, activeRange: 6 },
    [UnitType.STEALTH_CORVETTE]: { type: SensorType.RADAR, passiveRange: 3, activeRange: 5 },
    [UnitType.SUBMARINE]: { type: SensorType.SONAR, passiveRange: 3, activeRange: 5 },
    [UnitType.UAV]: { type: SensorType.RADAR, passiveRange: 7, activeRange: 10 },
    [UnitType.USV]: { type: SensorType.RADAR, passiveRange: 2, activeRange: 4 },
    [UnitType.UUV]: { type: SensorType.SONAR, passiveRange: 2, activeRange: 4 },
    [UnitType.SUBMARINE_HUNTER]: { type: SensorType.SONAR, passiveRange: 4, activeRange: 6 },
    [UnitType.CONVENTIONAL_CORVETTE]: { type: SensorType.RADAR, passiveRange: 3, activeRange: 5 },
    [UnitType.UNCONTROL_MINE]: { type: null, passiveRange: 0, activeRange: 0 },
    [UnitType.CONTROL_MINE]: { type: null, passiveRange: 0, activeRange: 0 },
  };

  // Separate attack ranges so they can be tuned independently from sensors.
  const ATTACK_RANGE_CONFIG = {
    [UnitType.FRIGATE]: 4,
    [UnitType.STEALTH_CORVETTE]: 3,
    [UnitType.SUBMARINE]: 3,
    [UnitType.UAV]: 7,
    [UnitType.USV]: 2,
    [UnitType.UUV]: 2,
    [UnitType.SUBMARINE_HUNTER]: 4,
    [UnitType.CONVENTIONAL_CORVETTE]: 3,
    [UnitType.UNCONTROL_MINE]: 0,
    [UnitType.CONTROL_MINE]: 0,
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
  let gameOver = false;
  let endGameReflectionHandled = false;
  let detectionDirty = true;

  let selectedId = null;
  let selectedByUser = false;
  let mode = 'order'; // 'order' | 'attack' | 'mine'

  // =====================================================
  // UI-element-referenser
  // =====================================================
  const elTurnPill = document.getElementById('turnPill');
  const elPhasePill = document.getElementById('phasePill');
  const elHintPill = document.getElementById('hintPill');
  const elMapPill = document.getElementById('mapPill');

  const elSelType = document.getElementById('selType');
  const elSelSide = document.getElementById('selSide');
  const elSelHP = document.getElementById('selHP');
  const elSelMove = document.getElementById('selMove');
  const elSelRange = document.getElementById('selRange');
  const elSelAttackRange = document.getElementById('selAttackRange');
  const elSelDepth = document.getElementById('selDepth');
  const elSelMines = document.getElementById('selMines');
  const elSelAmmo = document.getElementById('selAmmo');
  const elSelSensor = document.getElementById('selSensor');

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
  const redMovesWrap = document.getElementById('redMovesWrap');

  const elRedMove1 = document.getElementById('redMove1');
  const elRedMove2 = document.getElementById('redMove2');
  const elRedMove3 = document.getElementById('redMove3');

  const toast = document.getElementById('toast');
  let toastTimer = null;
  let toastPlacedUnderRedMoves = false;

  function ensureToastPlacement() {
    if (!toast) return;

    if (toast.parentElement !== document.body) {
      document.body.appendChild(toast);
    }

    // Keep toast directly below and within the same horizontal area as "Röda drag".
    const panelRect = redMovesWrap ? redMovesWrap.getBoundingClientRect() : null;
    const top = panelRect
      ? Math.min(window.innerHeight - 90, Math.max(12, Math.round(panelRect.bottom + 10)))
      : Math.round(window.innerHeight * 0.72);

    toast.style.position = 'fixed';
    toast.style.left = panelRect ? `${Math.round(panelRect.left)}px` : '16px';
    toast.style.top = `${top}px`;
    toast.style.transform = 'none';
    toast.style.marginTop = '0';
    toast.style.width = panelRect
      ? `${Math.max(220, Math.round(panelRect.width))}px`
      : 'min(680px, calc(100vw - 32px))';
    toast.style.maxWidth = panelRect
      ? `${Math.max(220, Math.round(panelRect.width))}px`
      : 'min(680px, calc(100vw - 32px))';
    toast.style.zIndex = '3';

    toastPlacedUnderRedMoves = true;
  }

  // Sessionlogg
  let sessionLogBuffer = '';
  const sessionStartedAt = new Date();
  const sessionId = `session-${getTimestamp().replace(/[:+]/g, '-')}`;
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
    const now = new Date();
    const parts = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).formatToParts(now);

    const get = (type) => parts.find((p) => p.type === type)?.value || '00';
    const ms = String(now.getMilliseconds()).padStart(3, '0');
    const tzName = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Stockholm',
      timeZoneName: 'shortOffset',
    }).formatToParts(now).find((p) => p.type === 'timeZoneName')?.value || 'GMT+1';
    const offsetHoursRaw = Number((tzName.match(/GMT([+-]\d{1,2})/) || [])[1] || 1);
    const sign = offsetHoursRaw >= 0 ? '+' : '-';
    const offsetHours = String(Math.abs(offsetHoursRaw)).padStart(2, '0');

    return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}.${ms}${sign}${offsetHours}:00`;
  }

  function getSwedishTimeString() {
    return new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Europe/Stockholm',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(new Date());
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
      setLogStatus(`sparad ${getSwedishTimeString()}`);
    } catch (e) {
      console.error('Kunde inte spara sessionslogg:', e);
      setLogStatus('sparfel (starta server.js)');
      throw e;
    }
  }

  function positionDialogOverMap(dialog) {
    const rect = canvas.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    dialog.style.position = 'fixed';
    dialog.style.left = `${Math.round(centerX)}px`;
    dialog.style.top = `${Math.round(centerY)}px`;
    dialog.style.transform = 'translate(-50%, -50%)';
  }



  function showBlueTurnReflectionPopup(options = {}) {
    const {
      title = 'Reflektera över följande frågor',
      saveButtonText = 'Spara svar',
      cancelButtonText = 'Avbryt',
    } = options;

    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,.55)';
      overlay.style.zIndex = '9999';

      const dialog = document.createElement('div');
      dialog.style.width = 'min(92vw, 620px)';
      dialog.style.background = '#0f172a';
      dialog.style.color = '#f8fafc';
      dialog.style.border = '1px solid rgba(255,255,255,.2)';
      dialog.style.borderRadius = '10px';
      dialog.style.padding = '14px';
      dialog.style.boxSizing = 'border-box';
      positionDialogOverMap(dialog);

      const heading = document.createElement('h3');
      heading.textContent = title;
      heading.style.margin = '0 0 10px 0';
      heading.style.fontSize = '16px';
      dialog.appendChild(heading);

      /*const note = document.createElement('div');
      note.textContent = 'Turen går vidare även om loggningen misslyckas.';
      note.style.margin = '0 0 12px 0';
      note.style.opacity = '0.8';
      note.style.fontSize = '12px';
      dialog.appendChild(note);
*/
      const l1 = document.createElement('label');
      if (ASK_BLUE_REFLECTION_EACH_TURN) {
        l1.textContent = 'Beskriv vilka drag du gjorde.';
      } else {
        l1.textContent = 'Redogör för din övergripande strategi och vad som hände i spelet.';
      }
      l1.style.display = 'block';
      l1.style.marginBottom = '6px';
      dialog.appendChild(l1);

      const t1 = document.createElement('textarea');
      t1.rows = 7;
      t1.style.width = '100%';
      t1.style.boxSizing = 'border-box';
      t1.style.borderRadius = '6px';
      t1.style.marginBottom = '10px';
      dialog.appendChild(t1);

      const l2 = document.createElement('label');
      if (ASK_BLUE_REFLECTION_EACH_TURN) {
        l2.textContent = 'Var det lätt att ta beslut om att göra dessa drag?';
      } else {
        l2.textContent = 'Är du nöjd med utfallet och den strategi du valde? Utveckla gärna';
      }
      l2.style.display = 'block';
      l2.style.marginBottom = '6px';
      dialog.appendChild(l2);

      const t2 = document.createElement('textarea');
      t2.rows = 7;
      t2.style.width = '100%';
      t2.style.boxSizing = 'border-box';
      t2.style.borderRadius = '6px';
      t2.style.marginBottom = '12px';
      dialog.appendChild(t2);
      
      const l3 = document.createElement('label');
      if (ASK_BLUE_REFLECTION_EACH_TURN) {
        l3.textContent = 'Varför valde du att göra just dessa drag? Vad tänkte du att de skulle leda till? Vilka andra drag kunde du ha gjort, och varför valde du bort dem?';
      } else {
        l3.textContent = 'Varför valde du den strategi du gjorde? Vilka andra drag kunde du ha gjort, och varför valde du bort dem?';
      }
      l3.style.display = 'block';
      l3.style.marginBottom = '6px';
      dialog.appendChild(l3);

      const t3 = document.createElement('textarea');
      t3.rows = 7;
      t3.style.width = '100%';
      t3.style.boxSizing = 'border-box';
      t3.style.borderRadius = '6px';
      t3.style.marginBottom = '10px';
      dialog.appendChild(t3);

      const l4 = document.createElement('label');
      if (ASK_BLUE_REFLECTION_EACH_TURN) {
        l4.textContent = 'Hur planerar du att fortsätta i nästa tur?';
      } else {
        l4.textContent = 'Om du skulle spela en omgång till; hur skulle du lägga upp din strategi då? Finns det något du vilja ändra på i ditt sätt att spela?';
      }
      l4.style.display = 'block';
      l4.style.marginBottom = '6px';
      dialog.appendChild(l4);

      const t4 = document.createElement('textarea');
      t4.rows = 7;
      t4.style.width = '100%';
      t4.style.boxSizing = 'border-box';
      t4.style.borderRadius = '6px';
      t4.style.marginBottom = '12px';
      dialog.appendChild(t4);

      const actions = document.createElement('div');
      actions.style.display = 'flex';
      actions.style.justifyContent = 'flex-end';
      actions.style.gap = '8px';

      const cancelBtn = document.createElement('button');
      cancelBtn.type = 'button';
      cancelBtn.textContent = cancelButtonText;

      const saveBtn = document.createElement('button');
      saveBtn.type = 'button';
      saveBtn.textContent = saveButtonText;

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
        const answer3 = t3.value.trim();
        const answer4 = t4.value.trim();

        cleanup();
        resolve({ answer1, answer2, answer3, answer4 });
      });
    });
  }

  async function collectBlueReflection(contextLabel) {
    const answers = await showBlueTurnReflectionPopup();
    if (!answers) return false;

    logEvent(contextLabel);
    logEvent('Fråga 1');
    logEvent(`Svar: ${answers.answer1 || '(tomt svar)'}`);
    logEvent('Fråga 2');
    logEvent(`Svar: ${answers.answer2 || '(tomt svar)'}`);
    logEvent('Fråga 3');
    logEvent(`Svar: ${answers.answer3 || '(tomt svar)'}`);
    logEvent('Fråga 4');
    logEvent(`Svar: ${answers.answer4 || '(tomt svar)'}`);

    try {
      await flushSessionLogToFile();
    } catch (e) {
      console.error('Kunde inte spara sessionslogg:', e);
      setLogStatus('fel vid sparning');
      showToast('Loggning misslyckades', 'Kunde inte skriva till textfilen.');
    }

    return true;
  }

  function isReflectionDisabledForCurrentMap() {
    // Karta 1 och 4 ska inte visa reflektionsfrågor.
    return selectedMapIndex === 0 || selectedMapIndex === 3;
  }

  function shouldAskBlueTurnReflection() {
    return !isReflectionDisabledForCurrentMap() && ASK_BLUE_REFLECTION_EACH_TURN;
  }

  function shouldAskBlueEndGameReflection() {
    return !isReflectionDisabledForCurrentMap() && !ASK_BLUE_REFLECTION_EACH_TURN;
  }

  function showEndGameResultPopup(winner) {
    return new Promise((resolve) => {
      logEvent(winner === Side.BLUE ? 'BLÅ VANN' : 'RÖD VANN');
      flushSessionLogToFile().catch((e) => {
        console.error('Kunde inte spara sessionslogg vid spelavslut:', e);
        setLogStatus('fel vid sparning');
      });

      const overlay = document.createElement('div');
      overlay.style.position = 'fixed';
      overlay.style.inset = '0';
      overlay.style.background = 'rgba(0,0,0,.55)';
      overlay.style.zIndex = '10000';

      const dialog = document.createElement('div');
      dialog.style.width = 'min(92vw, 620px)';
      dialog.style.background = '#0f172a';
      dialog.style.color = '#f8fafc';
      dialog.style.border = '1px solid rgba(255,255,255,.2)';
      dialog.style.borderRadius = '10px';
      dialog.style.padding = '18px';
      dialog.style.boxSizing = 'border-box';
      dialog.style.textAlign = 'center';
      positionDialogOverMap(dialog);

      const message = document.createElement('div');
      message.style.fontSize = '22px';
      message.style.fontWeight = '700';
      message.textContent = winner === Side.BLUE
        ? 'Grattis, du vann!'
        : 'Tyvärr, röd vann den här omgången.';

      dialog.appendChild(message);
      overlay.appendChild(dialog);
      document.body.appendChild(overlay);

      setTimeout(() => {
        overlay.remove();
        resolve();
      }, 2000);
    });
  }

  function handleEndGameReflectionIfNeeded(winner) {
    if (endGameReflectionHandled) return;
    endGameReflectionHandled = true;

    (async () => {
      await showEndGameResultPopup(winner);
      if (!shouldAskBlueEndGameReflection()) return;
      const ok = await collectBlueReflection(`BLÅ REFLEKTION (efter spelavslut, vinnare: ${winner})`);
      if (!ok) {
        console.warn('Slutreflektion hoppades över eller kunde inte sparas.');
      }
    })();
  }

  function showToast(title, msg, msg2, msg3) {
    ensureToastPlacement();
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
  let redAiLastHexByUnit = new Map();
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
    mines.set(keyOf(q, r), { side, identified: false });
    createMinefieldArea(q, r);
  }

  function createSeededRng(seed) {
    let s = seed >>> 0;
    return function next() {
      s += 0x6d2b79f5;
      let t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function getMinefieldSeed(centerQ, centerR) {
    const mapSeed = (MAP_CONFIGS[selectedMapIndex] && MAP_CONFIGS[selectedMapIndex].seed) || 0;
    const mixed =
      (mapSeed ^ ((centerQ + 1) * 73856093) ^ ((centerR + 1) * 19349663)) >>> 0;
    return mixed || 0x9e3779b9;
  }

  function shuffledHexDirs(rng) {
    const dirs = [...HEX_DIRS];
    for (let i = dirs.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const tmp = dirs[i];
      dirs[i] = dirs[j];
      dirs[j] = tmp;
    }
    return dirs;
  }

  function createMinefieldArea(centerQ, centerR) {
    const rng = createSeededRng(getMinefieldSeed(centerQ, centerR));
    const targetSize = 12;
    const start = { q: centerQ, r: centerR };

    const cells = new Set();
    const frontier = [start];

    cells.add(keyOf(start.q, start.r));

    while (cells.size < targetSize && frontier.length > 0) {
      const idx = Math.floor(rng() * frontier.length);
      const current = frontier.splice(idx, 1)[0];
      let added = false;

      const dirs = shuffledHexDirs(rng);

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

  function isMineType(type) {
    return type === UnitType.UNCONTROL_MINE || type === UnitType.CONTROL_MINE;
  }

  function isAdjacentToBlueUnit(q, r) {
    const mineCenter = hexToPixel(q, r);
    // Match "bredvid" by rendered hex-center distance so it aligns with what the player sees.
    const neighborDistance = HEX_SIZE * 1.8;
    return units.some((u) => {
      if (u.side !== Side.BLUE) return false;
      if (AIRBORNE_TYPES.has(u.type)) return false;
      const unitCenter = hexToPixel(u.q, u.r);
      const dx = unitCenter.x - mineCenter.x;
      const dy = unitCenter.y - mineCenter.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      return dist <= neighborDistance;
    });
  }

  function isMineVisibleToBlue(q, r, mineSide) {
    if (mineSide === Side.BLUE) return true;
    return isAdjacentToBlueUnit(q, r);
  }

  function updateUI() {
    /*if (
      !elTurnPill || !elPhasePill || !elActivePlayer || !elActionsLeft ||
      !elSelType || !elSelSide || !elSelHP || !elSelMove || !elSelRange ||
      !elSelDepth || !elSelMines || !elSelAmmo || !btnAttack || !btnMine || !btnDepthUp ||
      !btnDepthDown || !btnToggleSensor
    ) {
      return;
    }*/

    if (
      !elTurnPill || !elPhasePill || !elActivePlayer || !elActionsLeft ||
      !elSelType || !elSelSide || !elSelHP || !elSelMove || !elSelRange ||
      !elSelDepth || !elSelMines || !elSelAmmo || !btnAttack || !btnMine || !btnDepthUp ||
      !btnDepthDown || !btnToggleSensor
    ) {
      return;
    }

    elTurnPill.textContent = `Tur ${turn} • ${activeSide}`;
    elPhasePill.textContent = `Fas: ${
      mode === 'order' ? 'Förflyttning' : mode === 'attack' ? 'Attack' : 'Minering'
    }`;
    elMapPill.textContent = `Karta: ${loadedMapIndex+1}`;

    elActivePlayer.textContent = activeSide;
    elActionsLeft.textContent =
      actionsLeft === Number.POSITIVE_INFINITY ? 'Obegränsat' : String(actionsLeft);

    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel) {
      elSelType.textContent = '–';
      elSelSide.textContent = '–';
      elSelHP.textContent = '–';
      elSelMove.textContent = '–';
      elSelRange.textContent = '–';
      if (elSelAttackRange) elSelAttackRange.textContent = '–';
      elSelDepth.textContent = '–';
      elSelMines.textContent = '–';
      elSelAmmo.textContent = '–';
      if (elSelSensor) elSelSensor.textContent = '–';
      btnAttack.disabled = true;
      btnMine.disabled = true;
      btnDepthUp.disabled = true;
      btnDepthDown.disabled = true;
      btnToggleSensor.disabled = true;
      return;
    }

    if (sel.side === Side.RED && (!selectedByUser || !sel.identified)) {
      elSelType.textContent = '–';
      elSelSide.textContent = '–';
      elSelHP.textContent = '–';
      elSelMove.textContent = '–';
      elSelRange.textContent = '–';
      if (elSelAttackRange) elSelAttackRange.textContent = '–';
      elSelDepth.textContent = '–';
      elSelMines.textContent = '–';
      elSelAmmo.textContent = '–';
      if (elSelSensor) elSelSensor.textContent = '–';
      btnAttack.disabled = true;
      btnMine.disabled = true;
      btnDepthUp.disabled = true;
      btnDepthDown.disabled = true;
      btnToggleSensor.disabled = true;
      return;
    }

    const st = UNIT_STATS[sel.type];
    const sensorCfg = SENSOR_CONFIG[sel.type];
    const attackRange = ATTACK_RANGE_CONFIG[sel.type] ?? st.range;
    const hasSensor = !!(sensorCfg && sensorCfg.type);
    const effectiveSensorRange = hasSensor
      ? (sel.sensorActive ? sensorCfg.activeRange : sensorCfg.passiveRange)
      : null;
    elSelType.textContent = sel.type;
    elSelSide.textContent = sel.side;
    elSelHP.textContent = `${sel.hp}/${st.hp}`;
    elSelMove.textContent = String(st.move);
    // Show sensor-based range in panel when the unit has sensors.
    elSelRange.textContent = effectiveSensorRange !== null
      ? String(effectiveSensorRange)
      : String(st.range);
    if (elSelAttackRange) {
      elSelAttackRange.textContent = st.ammo <= 0 ? '–' : String(attackRange);
    }
    elSelDepth.textContent = `${sel.depth}/${MAX_DEPTH}`;
    elSelMines.textContent = String(sel.minesLeft);
    elSelAmmo.textContent = `${sel.ammoLeft}/${st.ammo}`;
    if (elSelSensor) elSelSensor.textContent = sensorCfg && sensorCfg.type ? sensorCfg.type : 'Ingen';

    const isOwn = sel.side === activeSide;
    const hasActions = hasActionsFor(activeSide);
    btnAttack.disabled = !isOwn || !hasActions || sel.ammoLeft <= 0;
    btnMine.disabled = !isOwn || !hasActions || sel.minesLeft <= 0;
    // Depth buttons only for submarines and if own unit
    const cell = sel.q !== undefined ? getCell(sel.q, sel.r) : null;
    const maxDepthAtHex = cell ? Math.ceil(cell.depthNormalized * MAX_DEPTH) : MAX_DEPTH;
    btnDepthUp.disabled = !isOwn || !hasActions || !SUBMARINE_TYPES.has(sel.type) || sel.depth >= maxDepthAtHex;
    btnDepthDown.disabled = !isOwn || !hasActions || !SUBMARINE_TYPES.has(sel.type) || sel.depth <= 0;
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

  function getAttackRangeForUnit(u) {
    const st = UNIT_STATS[u.type] || { range: 0 };
    return ATTACK_RANGE_CONFIG[u.type] ?? st.range;
  }

  function mineAt(q, r, enteringSide, enteringType = null) {
  if (enteringType && AIRBORNE_TYPES.has(enteringType)) {
    return null;
  }

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
      ammoLeft: st.ammo,
      movedThisTurn: false,
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

  function findStartHex(side, unitType = null) {
    const mapConfig = MAP_CONFIGS[selectedMapIndex];

    function findNearestUnitHex(start) {
      if (!inBounds(start)) return null;
      if (isUnitPlacableHex(start.q, start.r, unitType)) return start;

      const visited = new Set([keyOf(start.q, start.r)]);
      const queue = [start];

      while (queue.length) {
        const curr = queue.shift();
        for (const dir of HEX_DIRS) {
          const next = { q: curr.q + dir.q, r: curr.r + dir.r };
          if (!inBounds(next)) continue;
          const k = keyOf(next.q, next.r);
          if (visited.has(k)) continue;
          if (isUnitPlacableHex(next.q, next.r, unitType)) return next;
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
        const waterPos = findNearestUnitHex(pos); //onödigt, hårdkoda i map_configs istället
        if (waterPos) return waterPos;
      }
    } else {
      const positions = mapConfig.redStartPositions;
      if (redSpawnIndex < positions.length) {
        const pos = positions[redSpawnIndex++];
        const waterPos = findNearestUnitHex(pos); //onödigt, hårdkoda i map_configs istället
        if (waterPos) return waterPos;
      }
    }
    
    // Fallback if we run out of predefined positions
    return findNearestUnitHex({ q: side === Side.BLUE ? 5 : 14, r: 10 }) ||
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
      logEvent(`\n`);
      logEvent(`Nytt slag initieras, karta: ${MAP_CONFIGS[selectedMapIndex].name}`);
      
      console.log('Step A: Calling ensureMapLoaded...');
      ensureMapLoaded(selectedMapIndex);
      console.log('Step B: ensureMapLoaded completed');
      
      console.log('Step C: Resetting game state...');
      nextId = 1;
      turn = 1;
      activeSide = Side.BLUE;
      actionsLeft = BLUE_ACTIONS_UNLIMITED ? Number.POSITIVE_INFINITY : ACTIONS_PER_TURN;
      gameOver = false;
      endGameReflectionHandled = false;
      selectedId = null;
      selectedByUser = false;
      detectionDirty = true;
      mode = 'order';
      blueSpawnIndex = 0;
      redSpawnIndex = 0;
      redAiLastHexByUnit = new Map();
      console.log('Step D: Game state reset');
      
      console.log('Step E: Calling generateMap...');
      generateMap();
      console.log('Step F: generateMap completed, map length:', map.length);
      
      console.log('Step G: Clearing units, preparing to spawn...');
      units = [];
      
      //Spawn blue units
      console.log('Step H: Spawning blue units...');
      /*
      const blueUnits = [
        UnitType.FRIGATE,
        UnitType.STEALTH_CORVETTE, UnitType.STEALTH_CORVETTE,
        UnitType.SUBMARINE,
        UnitType.UAV, UnitType.UAV,
        UnitType.USV, UnitType.USV,
        UnitType.UUV, UnitType.UUV,
        UnitType.SUBMARINE_HUNTER,
      ];
      */

      const blueUnits = [
        UnitType.FRIGATE,
        UnitType.STEALTH_CORVETTE,
        UnitType.SUBMARINE,
        UnitType.UAV,
        UnitType.USV,
        UnitType.UUV,
        UnitType.SUBMARINE_HUNTER,
      ];      
      for (const t of blueUnits) {
        const h = findStartHex(Side.BLUE, t);
        spawn(Side.BLUE, t, h.q, h.r);
      }
      console.log('Step I: Blue units spawned, total units:', units.length);

      //Spawn red units
      console.log('Step J: Spawning red units...');
      const redUnits = [
        UnitType.CONVENTIONAL_CORVETTE, 
        UnitType.SUBMARINE, 
        UnitType.UNCONTROL_MINE, UnitType.UNCONTROL_MINE,
        UnitType.CONTROL_MINE, UnitType.CONTROL_MINE,
        UnitType.CONVENTIONAL_CORVETTE, UnitType.CONVENTIONAL_CORVETTE,
        UnitType.SUBMARINE
      ];
      for (const t of redUnits) {
        const h = findStartHex(Side.RED, t);
        spawn(Side.RED, t, h.q, h.r);
      }
      console.log('Step K: Red units spawned, total units:', units.length);

      resetBlueMoves();
      
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

  function isUnitPlacableHex(q, r, unitType = null) {
    if (!inBounds({ q, r })) return false;
    if (unitType && AIRBORNE_TYPES.has(unitType)) return true;
    const cell = getCell(q, r);
    return !cell.land && !cell.isSkerry;
  }

  function canSelect(u) {
    return u.side === activeSide;
  }

  function legalMoves(u) {
    if (u.side === Side.BLUE && u.movedThisTurn) return [];
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
        if (!isUnitPlacableHex(nh.q, nh.r, u.type)) continue;
        const occupyingUnit = unitAt(nh.q, nh.r);
        const canLandOnHex =
          !occupyingUnit ||
          (
            !AIRBORNE_TYPES.has(u.type) &&
            occupyingUnit.side !== u.side &&
            isMineType(occupyingUnit.type)
          );

        const nd = d + 1;
        if (nd <= st.move) {
          visited.add(k);
          if (canLandOnHex) {
            res.push(nh);
          }
          queue.push({ h: nh, d: nd });
        }
      }
    }
    return res;
  }

  function enemiesInRange(u) {
    const attackRange = getAttackRangeForUnit(u);
    return units.filter(
      (o) =>
        o.side !== u.side &&
        hexDistance({ q: u.q, r: u.r }, { q: o.q, r: o.r }) <= attackRange
    );
  }

  function attackRangeHexes(u) {
    const range = getAttackRangeForUnit(u);
    const origin = { q: u.q, r: u.r };
    const res = [];
    for (let r = 0; r < GRID_H; r++) {
      for (let q = 0; q < GRID_W; q++) {
        if (q === origin.q && r === origin.r) continue;
        if (hexDistance(origin, { q, r }) <= range) {
          res.push({ q, r });
        }
      }
    }
    return res;
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
    selectedByUser = false;
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
      gameOver = true;

      // --- NYTT: logga antal och vilka enheter som finns kvar ---
      const remainingBlue = units.filter((u) => u.side === Side.BLUE);
      const remainingRed = units.filter((u) => u.side === Side.RED);

      logEvent(`Återstående enheter vid spelavslut: Blå=${remainingBlue.length}, Röd=${remainingRed.length}`);

      if (remainingBlue.length > 0) {
        logEvent('Blå enheter: ' + remainingBlue
          .map(u => `${u.type} (id=${u.id}) @(${u.q},${u.r}) hp=${u.hp}`)
          .join(' ; '));
      } else {
        logEvent('Blå enheter: Inga');
      }

      if (remainingRed.length > 0) {
        logEvent('Röda enheter: ' + remainingRed
          .map(u => `${u.type} (id=${u.id}) @(${u.q},${u.r}) hp=${u.hp}`)
          .join(' ; '));
      } else {
        logEvent('Röda enheter: Inga');
      }
      // --- SLUT NYTT ---

      showToast(
        'Spelet är slut',
        `${winner} vinner! Tryck "Nytt slag" för att spela igen.`
      );
      handleEndGameReflectionIfNeeded(winner);
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
        // Mines must never be detected by sensors.
        // They are discovered/identified only by adjacency rules.
        if (isMineType(red.type)) continue;

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
        const randFactor = Math.floor(Math.random() * 5) + 1;
        if (dist + randFactor > range) continue;

        // Detected!
        red.detected = true;

        // Check identification: randFactor - 5 > 0
        const identRand = Math.floor(Math.random() * 5) + 1;
        if (identRand - 3 > 0) {
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
    if (!hasActionsFor(attacker.side)) {
      showToast('Inga åtgärder kvar', 'Avsluta tur för att fortsätta.');
      return false;
    }
    if (attacker.ammoLeft <= 0) {
      showToast('Slut på ammunition', 'Den här enheten har inga skott kvar.');
      return false;
    }
    const attackRange = getAttackRangeForUnit(attacker);
    const d = hexDistance(
      { q: attacker.q, r: attacker.r },
      { q: target.q, r: target.r }
    );
    if (d > attackRange) {
      showToast('För långt bort', 'Målet är utanför räckvidd.');
      return false;
    }

    if (attacker.side === Side.RED && target.side === Side.BLUE) {
      attacker.detected = true;
      attacker.identified = true;
    }

    let dmg = 1;
    if (attacker.type === UnitType.SUBMARINE && d === 1) dmg = 2;

    target.hp -= dmg;
    attacker.ammoLeft -= 1;
    spendActionFor(attacker.side);
    showToast('Träff', `${attacker.type} träffar ${target.type} för ${dmg} skada.`);
    logEvent(`${attacker.side} attackerar: ${attacker.type} -> ${target.type}, skada=${dmg}, återstående HP mål=${Math.max(0, target.hp)}`);

    if (attacker.side === Side.RED && target.side === Side.BLUE) {
      if (target.hp <= 0) {
        pushRedMove(`${attacker.type} sänkte ${target.type}`);
      } else {
        pushRedMove(`${attacker.type} anföll ${target.type}`);
      }
    }

    if (target.hp <= 0) {
      units = units.filter((u) => u.id !== target.id);
      if (selectedId === target.id) {
        selectedId = null;
        selectedByUser = false;
      }
      if( target.type === UnitType.CONTROL_MINE || target.type === UnitType.UNCONTROL_MINE) {
        showToast('Sänkt!', `${target.type} röjd.`);
        logEvent(`${target.side} enhet sänkt: ${target.type}`);
      } else {
        showToast('Sänkt!', `${target.type} sjunker!`);
        logEvent(`${target.side} enhet sänkt: ${target.type}`);
      }
    }

    mode = 'order';
    updateUI();
    draw();
    checkWin();
    return true;
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
      if (activeSide === Side.BLUE && shouldAskBlueTurnReflection()) {
        const ok = await collectBlueReflection('BLÅ REFLEKTION');
        if (!ok) return;
      }

      logEvent(`${activeSide} avslutar sin tur`);

      // Spara alltid logghändelser när Blå avslutar sin tur,
      // även om reflektion bara samlas in vid spelavslut.
      if (activeSide === Side.BLUE && !ASK_BLUE_REFLECTION_EACH_TURN) {
        try {
          await flushSessionLogToFile();
        } catch (e) {
          console.error('Kunde inte spara sessionslogg vid turavslut:', e);
          setLogStatus('fel vid sparning');
          showToast('Loggning misslyckades', 'Kunde inte skriva till textfilen.');
        }
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
      if (!hasActionsFor(sel.side)) return;
      // Cannot go deeper than water depth at this hex
      const cell = getCell(sel.q, sel.r);
      const maxDepth = Math.ceil(cell.depthNormalized * MAX_DEPTH);
      if (sel.depth >= maxDepth) return;
      sel.depth += 1;
      spendActionFor(sel.side);
      logEvent(`${sel.side} ändrar djup upp: ${sel.type} till djup ${sel.depth}`);
      updateUI();
      draw();
    });
  }

  if (btnDepthDown) {
    btnDepthDown.addEventListener('click', () => {
      const sel = selectedId ? getUnit(selectedId) : null;
      if (!sel || sel.side !== activeSide) return;
      if (sel.depth <= 0) return;
      if (!hasActionsFor(sel.side)) return;
      sel.depth -= 1;
      spendActionFor(sel.side);
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
      detectionDirty = true;
      logEvent(`${sel.side} växlar sensorläge: ${sel.type} -> ${sel.sensorActive ? 'Aktiv' : 'Passiv'}`);
      updateUI();
      draw();
    });
  }

  function endTurn() {
    if (gameOver) return;
    const nextSide = activeSide === Side.BLUE ? Side.RED : Side.BLUE;
    const nextTurn = nextSide === Side.BLUE ? turn + 1 : turn;
    logEvent(`Turbyte: ${activeSide} -> ${nextSide} (tur ${nextTurn})`);
    selectedId = null;
    selectedByUser = false;
    mode = 'order';
    activeSide = nextSide;
    detectionDirty = true;
    if (activeSide === Side.BLUE) turn += 1;
    actionsLeft =
      activeSide === Side.BLUE && BLUE_ACTIONS_UNLIMITED
        ? Number.POSITIVE_INFINITY
        : ACTIONS_PER_TURN;

    if (activeSide === Side.BLUE) resetBlueMoves();

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
      if (!reds.length || !blues.length) {
        endTurn();
        return;
      }

      // Attackera om möjligt
      for (const u of reds) {
        if (u.ammoLeft <= 0) continue;
        const inR = enemiesInRange(u);
        if (inR.length) {
          inR.sort((a, b) => a.hp - b.hp);
          selectedId = u.id;
          selectedByUser = false;
          mode = 'attack';
          updateUI();
          draw();
          const attacked = tryAttack(u, inR[0]);
          if (attacked) {
            steps++;
            if (steps >= ACTIONS_PER_TURN) {
              endTurn();
            } else {
              setTimeout(tick, 350);
            }
            return;
          }
        }
      }

      // Flytta mot närmaste fiende
      const mobileReds = reds.filter((u) => UNIT_STATS[u.type] && UNIT_STATS[u.type].move > 0);
      const moverPool = mobileReds.length ? mobileReds : reds;
      const moverCandidates = moverPool
        .map((u) => ({ u, moves: legalMoves(u) }))
        .filter((entry) => entry.moves.length > 0);

      if (!moverCandidates.length) {
        steps++;
        if (steps >= ACTIONS_PER_TURN) {
          endTurn();
        } else {
          setTimeout(tick, 250);
        }
        return;
      }

      const moversWithAmmo = moverCandidates.filter((entry) => entry.u.ammoLeft > 0);
      const prioritizedMoverCandidates = moversWithAmmo.length ? moversWithAmmo : moverCandidates;

      // Build obstacle-aware distance field from all blue positions.
      // This helps red route around land instead of using only straight-line distance.
      const bluePathDist = new Map();
      const bfsQueue = [];
      for (const b of blues) {
        const k = keyOf(b.q, b.r);
        if (bluePathDist.has(k)) continue;
        bluePathDist.set(k, 0);
        bfsQueue.push({ q: b.q, r: b.r });
      }
      while (bfsQueue.length) {
        const cur = bfsQueue.shift();
        const curKey = keyOf(cur.q, cur.r);
        const curDist = bluePathDist.get(curKey);
        for (const dir of HEX_DIRS) {
          const nh = { q: cur.q + dir.q, r: cur.r + dir.r };
          if (!inBounds(nh)) continue;
          if (!isUnitPlacableHex(nh.q, nh.r)) continue;
          const nk = keyOf(nh.q, nh.r);
          if (bluePathDist.has(nk)) continue;
          bluePathDist.set(nk, curDist + 1);
          bfsQueue.push(nh);
        }
      }

      const getBluePathDist = (pos) => {
        const d = bluePathDist.get(keyOf(pos.q, pos.r));
        return d == null ? Number.POSITIVE_INFINITY : d;
      };

      const scoredMoverCandidates = prioritizedMoverCandidates.map((entry) => {
        const currentDist = getBluePathDist({ q: entry.u.q, r: entry.u.r });
        const prevHex = redAiLastHexByUnit.get(entry.u.id);
        const bestMove = entry.moves.reduce((best, m) => {
          const d = getBluePathDist(m);
          const isImmediateBacktrack = !!prevHex && prevHex.q === m.q && prevHex.r === m.r;
          const effectiveDist = d + (isImmediateBacktrack ? 0.25 : 0);
          if (!best) return { move: m, dist: d, effectiveDist };
          if (effectiveDist < best.effectiveDist) return { move: m, dist: d, effectiveDist };
          if (
            effectiveDist === best.effectiveDist &&
            (m.q < best.move.q || (m.q === best.move.q && m.r < best.move.r))
          ) {
            return { move: m, dist: d, effectiveDist };
          }
          return best;
        }, null);
        return {
          entry,
          bestMove: bestMove.move,
          bestDist: bestMove.dist,
          bestEffectiveDist: bestMove.effectiveDist,
          currentDist,
          improvement: currentDist - bestMove.dist,
        };
      });

      scoredMoverCandidates.sort(
        (a, b) =>
          b.improvement - a.improvement ||
          a.bestEffectiveDist - b.bestEffectiveDist ||
          a.bestDist - b.bestDist ||
          String(a.entry.u.id).localeCompare(String(b.entry.u.id))
      );

      const chosen = scoredMoverCandidates[0];
      const mover = chosen.entry.u;
      const dest = chosen.bestMove;
      selectedId = mover.id;
      selectedByUser = false;
      mode = 'order';
      const from = { q: mover.q, r: mover.r };
      mover.q = dest.q;
      mover.r = dest.r;
      redAiLastHexByUnit.set(mover.id, from);
      spendActionFor(mover.side);
      logEvent(`${mover.side} flyttar: ${mover.type} (${from.q},${from.r}) -> (${dest.q},${dest.r})`);
      if (!AIRBORNE_TYPES.has(mover.type) && mines.has(keyOf(dest.q, dest.r))) {
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

    // Update detection before rendering, but only when game state has changed
    if (activeSide === Side.BLUE && detectionDirty) {
      updateDetection();
      detectionDirty = false;
    }

    const origin = getMapOrigin();
    const sel = selectedId ? getUnit(selectedId) : null;
    const moveSet =
      sel && sel.side === Side.BLUE && mode === 'order' ? legalMoves(sel) : [];
    const attackSet =
      sel && sel.side === Side.BLUE && mode === 'attack'
        ? attackRangeHexes(sel)
        : [];
    const mineSet =
      sel && sel.side === Side.BLUE && mode === 'mine'
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

        /*// Draw coordinate label
        ctx.save();
        ctx.fillStyle = '#fff';
        ctx.font = '10px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.globalAlpha = 0.85;
        ctx.fillText(`${q},${r}`, x, y - HEX_SIZE * 0.45);
        ctx.restore();*/

        if (sel && sel.side === Side.BLUE && sel.q === q && sel.r === r) {
          drawHex(x, y, 'rgba(255,255,255,.08)', 'rgba(255,255,255,.45)', 2);
        }
        if (moveSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(255,255,255,.06)', 'rgba(255,255,255,.18)', 2);
        }
        if (attackSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(168,85,247,.12)', 'rgba(168,85,247,.75)', 2);
        }
        if (mineSet.some((h) => h.q === q && h.r === r)) {
          drawHex(x, y, 'rgba(255,213,74,.08)', 'rgba(255,213,74,.40)', 2);
        }

        const m = mines.get(keyOf(q, r));
        if (m) {
          const mineVisibleNow = isMineVisibleToBlue(q, r, m.side);
          if (mineVisibleNow) {
            m.identified = true;
          }
          if (!mineVisibleNow && !m.identified) {
            continue;
          }

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
      
       
      const isRedMine = u.side === Side.RED && isMineType(u.type);
      if (isRedMine && !u.identified && !isMineVisibleToBlue(u.q, u.r, u.side)) {
        continue;
      }

      // Once a mine has been identified, it stays identified.
      if (isRedMine && isMineVisibleToBlue(u.q, u.r, u.side)) {
        u.detected = true;
        u.identified = true;
      }
      
      
      // Hide non-mine red units unless detected or identified
      if (u.side === Side.RED && !isMineType(u.type) && !u.detected && !u.identified) {
        continue; // Skip rendering
      }
       


      const p = hexToPixel(u.q, u.r);
      const x = origin.x + p.x;
      const y = origin.y + p.y;
      const isRedUnknown = u.side === Side.RED && !isRedMine && u.detected && !u.identified;
      const col = u.side === Side.BLUE
        ? LEGEND_COLORS.unitBlue
        : isRedUnknown
          ? LEGEND_COLORS.mine
          : LEGEND_COLORS.unitRed;
      const symbolCanvas = !isRedUnknown ? getUnitSymbolCanvas(u.type, u.side) : null;
      const iconSize = symbolCanvas ? getUnitSymbolSize(u.type) : 0;
      const iconOffsetY = symbolCanvas ? getUnitSymbolOffsetY(u.type, u.side) : 0;
      const unitCenterY = y + iconOffsetY;
      const unitStrokeRadius = symbolCanvas ? Math.ceil(iconSize * 0.72) + 1 : 12;

      // Unit circle (dimmer if not identified)
      if (!symbolCanvas) {
        ctx.beginPath();
        ctx.arc(x, unitCenterY, 12, 0, Math.PI * 2);
        ctx.fillStyle = col;
        if (isRedUnknown) {
          // Detected but not identified: dimmer
          ctx.globalAlpha = 1.0; //Om du vill ha dimmer så sänk till 0.5 eller liknande
        }
        ctx.fill();
      }
      ctx.globalAlpha = 1.0;
      ctx.beginPath();
      ctx.arc(x, unitCenterY, unitStrokeRadius, 0, Math.PI * 2);
      ctx.strokeStyle = u.sensorActive ? 'orange' : 'rgba(255,255,255,.35)';
      ctx.lineWidth = symbolCanvas ? 2.5 : 2;
      ctx.stroke();

      // Type glyph or question mark
      ctx.fillStyle = '#0b1220';
      ctx.font = isRedUnknown
        ? 'bold 16px system-ui, -apple-system, Segoe UI, Roboto, Arial'
        : 'bold 10px system-ui, -apple-system, Segoe UI, Roboto, Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      if (isRedUnknown) {
        ctx.fillText('?', x, y); // Question mark for detected but not identified
      } else {
        if (symbolCanvas) {
          ctx.drawImage(symbolCanvas, x - iconSize / 2, y - iconSize / 2 + iconOffsetY, iconSize, iconSize);
        } else {
          ctx.fillText(typeGlyph(u.type), x, y); // Bokstavsglyf fallback
        }
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
      if (selectedId === u.id && u.side === Side.BLUE) {
        ctx.beginPath();
        const selectionRadius = symbolCanvas ? unitStrokeRadius + 4 : 18;
        ctx.arc(x, unitCenterY, selectionRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,.65)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    updateUI();
  }

  //Importera symbol från milsymbol.com för att använda som ikon för kontrollerbara minor
  let ms_FRIGATE = null;
  let ms_STEALTH_CORVETTE = null;
  let ms_SUBMARINE = null;
  let ms_UAV = null;
  let ms_USV = null;
  let ms_UUV = null;
  let ms_SUBMARINE_HUNTER = null;
  let ms_CONVENTIONAL_CORVETTE = null;
  let ms_UNCONTROL_MINE = null;
  let ms_CONTROL_MINE = null;

  // Röda symboler (lägg in egna SIDC-koder här när du har dem)
  let ms_RED_FRIGATE = null;
  let ms_RED_STEALTH_CORVETTE = null;
  let ms_RED_SUBMARINE = null;
  let ms_RED_UAV = null;
  let ms_RED_USV = null;
  let ms_RED_UUV = null;
  let ms_RED_SUBMARINE_HUNTER = null;
  let ms_RED_CONVENTIONAL_CORVETTE = null;
  let ms_RED_UNCONTROL_MINE = null;
  let ms_RED_CONTROL_MINE = null;

  if (window.ms && typeof window.ms.Symbol === 'function') {
    try {
      ms_FRIGATE = new window.ms.Symbol('130330000012020400000000000000', { size: 28 }).asCanvas();
      ms_STEALTH_CORVETTE = new window.ms.Symbol('130330000012020500000000000000', { size: 28 }).asCanvas();
      ms_SUBMARINE = new window.ms.Symbol('130335000011010000000000000000', { size: 28 }).asCanvas();
      ms_UAV = new window.ms.Symbol('130301000011030000000000000000', { size: 28 }).asCanvas();
      ms_USV = new window.ms.Symbol('130330000012070000000000000000', { size: 28 }).asCanvas();
      ms_UUV = new window.ms.Symbol('130335000011040000000000000000', { size: 28 }).asCanvas();
      ms_SUBMARINE_HUNTER = new window.ms.Symbol('130301000011020000000000000000', { size: 28 }).asCanvas();
      ms_CONVENTIONAL_CORVETTE = new window.ms.Symbol('130330000012020500000000000000', { size: 28 }).asCanvas();
      ms_UNCONTROL_MINE = new window.ms.Symbol('130336000011000000000000000000', { size: 28 }).asCanvas();
      ms_CONTROL_MINE = new window.ms.Symbol('130336000011000000000000000000', { size: 28 }).asCanvas();

      // TODO: Ersätt SIDC-strängarna nedan med dina röda enhetssymboler
      // ms_RED_FRIGATE = new window.ms.Symbol('REPLACE_RED_FRIGATE_SIDC', { size: 28 }).asCanvas();
      // ms_RED_STEALTH_CORVETTE = new window.ms.Symbol('130630000012020500000000000000', { size: 28 }).asCanvas();
      ms_RED_SUBMARINE = new window.ms.Symbol('130635000011010000000000000000', { size: 28 }).asCanvas();
      // ms_RED_UAV = new window.ms.Symbol('REPLACE_RED_UAV_SIDC', { size: 28 }).asCanvas();
      // ms_RED_USV = new window.ms.Symbol('REPLACE_RED_USV_SIDC', { size: 28 }).asCanvas();
      // ms_RED_UUV = new window.ms.Symbol('REPLACE_RED_UUV_SIDC', { size: 28 }).asCanvas();
      // ms_RED_SUBMARINE_HUNTER = new window.ms.Symbol('REPLACE_RED_SUBMARINE_HUNTER_SIDC', { size: 28 }).asCanvas();
      ms_RED_CONVENTIONAL_CORVETTE = new window.ms.Symbol('130630000012020500000000000000', { size: 28 }).asCanvas();
      ms_RED_UNCONTROL_MINE = new window.ms.Symbol('130636000011000000000000000000', { size: 28 }).asCanvas();
      ms_RED_CONTROL_MINE = new window.ms.Symbol('130636000011000000000000000000', { size: 28 }).asCanvas();
    } catch (e) {
      console.warn('Kunde inte skapa milsymboler', e);
    }
  }

  function getUnitSymbolCanvas(unitType, side) {
    const useRed = side === Side.RED;

    if (unitType === UnitType.FRIGATE) return useRed ? (ms_RED_FRIGATE || ms_FRIGATE) : ms_FRIGATE;
    if (unitType === UnitType.STEALTH_CORVETTE) return useRed ? (ms_RED_STEALTH_CORVETTE || ms_STEALTH_CORVETTE) : ms_STEALTH_CORVETTE;
    if (unitType === UnitType.SUBMARINE) return useRed ? (ms_RED_SUBMARINE || ms_SUBMARINE) : ms_SUBMARINE;
    if (unitType === UnitType.UAV) return useRed ? (ms_RED_UAV || ms_UAV) : ms_UAV;
    if (unitType === UnitType.USV) return useRed ? (ms_RED_USV || ms_USV) : ms_USV;
    if (unitType === UnitType.UUV) return useRed ? (ms_RED_UUV || ms_UUV) : ms_UUV;
    if (unitType === UnitType.SUBMARINE_HUNTER) return useRed ? (ms_RED_SUBMARINE_HUNTER || ms_SUBMARINE_HUNTER) : ms_SUBMARINE_HUNTER;
    if (unitType === UnitType.CONVENTIONAL_CORVETTE) return useRed ? (ms_RED_CONVENTIONAL_CORVETTE || ms_CONVENTIONAL_CORVETTE) : ms_CONVENTIONAL_CORVETTE;
    if (unitType === UnitType.UNCONTROL_MINE) return useRed ? (ms_RED_UNCONTROL_MINE || ms_UNCONTROL_MINE) : ms_UNCONTROL_MINE;
    if (unitType === UnitType.CONTROL_MINE) return useRed ? (ms_RED_CONTROL_MINE || ms_CONTROL_MINE) : ms_CONTROL_MINE;
    return null;
  }

  function getUnitSymbolSize(unitType) {
    if (unitType === UnitType.FRIGATE) return 26;
    if (unitType === UnitType.CONVENTIONAL_CORVETTE) return 26;
    if (unitType === UnitType.STEALTH_CORVETTE) return 24;
    if (unitType === UnitType.SUBMARINE) return 24;
    if (unitType === UnitType.SUBMARINE_HUNTER) return 23;
    if (unitType === UnitType.USV) return 21;
    if (unitType === UnitType.UAV) return 20;
    if (unitType === UnitType.UUV) return 20;
    if (unitType === UnitType.UNCONTROL_MINE) return 20;
    if (unitType === UnitType.CONTROL_MINE) return 20;
    return 22;
  }

  function getUnitSymbolOffsetY(unitType, side) {
    const isRed = side === Side.RED;
    if (unitType === UnitType.FRIGATE) return isRed ? -1 : -1;
    if (unitType === UnitType.CONVENTIONAL_CORVETTE) return isRed ? -1 : -1;
    if (unitType === UnitType.STEALTH_CORVETTE) return isRed ? 0 : 0;
    if (unitType === UnitType.SUBMARINE) return isRed ? 1 : 1;
    if (unitType === UnitType.SUBMARINE_HUNTER) return isRed ? 0 : 0;
    if (unitType === UnitType.USV) return isRed ? 0 : 0;
    if (unitType === UnitType.UAV) return isRed ? -1 : -1;
    if (unitType === UnitType.UUV) return isRed ? 1 : 1;
    if (unitType === UnitType.UNCONTROL_MINE) return isRed ? 1 : 1;
    if (unitType === UnitType.CONTROL_MINE) return isRed ? 1 : 1;
    return 0;
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
      const selectedUnit = selectedId ? getUnit(selectedId) : null;
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
      const isMoveAttemptIntoEnemyMine =
        mode === 'order' &&
        selectedUnit &&
        selectedUnit.side === activeSide &&
        clickedUnit.side !== activeSide &&
        isMineType(clickedUnit.type);

      if (isMoveAttemptIntoEnemyMine) {
        // Fall through so the normal move handling can trigger mine detonation.
      } else {
      selectedId = clickedUnit.id;
      selectedByUser = true;
      mode = 'order';
      updateUI();
      draw();
      return;
      }
    }

    const sel = selectedId ? getUnit(selectedId) : null;
    if (!sel) return;
    if (sel.side !== activeSide) return;
    if (!hasActionsFor(sel.side)) {
      showToast('Inga åtgärder kvar', 'Avsluta tur för att fortsätta.');
      return;
    }

    if (mode === 'order') {
      if (sel.side === Side.BLUE && sel.movedThisTurn) {
        showToast('Redan flyttad', 'Varje enhet kan bara förflytta sig en gång per tur.');
        return;
      }
      const from = { q: sel.q, r: sel.r };
      const moves = legalMoves(sel);
      if (!moves.some((m) => hexEq(m, h))) {
        showToast('Ogiltigt drag', 'Du kan bara flytta till markerade hexar.');
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

      if (!AIRBORNE_TYPES.has(sel.type)) {
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
          const foundMine = mineAt(hex.q, hex.r, sel.side, sel.type);
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
          spendActionFor(sel.side);
          if (sel.side === Side.BLUE) sel.movedThisTurn = true;
          logEvent(`${sel.side} flyttar (mina utlöst): ${sel.type} (${from.q},${from.r}) -> (${stopQ},${stopR})`);
          applyMineTrigger(stopQ, stopR, sel.side);
          console.log(`Blue unit ends at (${sel.q},${sel.r})`);
          updateUI();
          draw();
          checkWin();
          return;
        }
      }
      // No mine encountered, move normally
      sel.q = h.q;
      sel.r = h.r;
      spendActionFor(sel.side);
      if (sel.side === Side.BLUE) sel.movedThisTurn = true;
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
      spendActionFor(sel.side);
      mode = 'order';
      logEvent(`${sel.side} lägger mina: ${sel.type} på (${h.q},${h.r})`);
      showToast('Mina utlagd', 'Ett sund är nu minerat.');
      updateUI();
      draw();
      return;
    }
  });

  function hasActionsFor(side) {
    return side === Side.BLUE && BLUE_ACTIONS_UNLIMITED ? true : actionsLeft > 0;
  }

  function spendActionFor(side) {
    detectionDirty = true;
    if (side === Side.BLUE && BLUE_ACTIONS_UNLIMITED) return;
    actionsLeft -= 1;
  }

  function resetBlueMoves() {
    for (const u of units) {
      if (u.side === Side.BLUE) u.movedThisTurn = false;
    }
  }

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
