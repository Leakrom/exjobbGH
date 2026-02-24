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