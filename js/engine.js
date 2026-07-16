// ORLOG — Motor de juego puro (sin DOM, sin timers, determinista con rng inyectable)
// Contrato: ver SPEC.md §API DEL MOTOR y §Orden exacto de la resolución.
(function () {
  'use strict';

  var GODS = (typeof window !== 'undefined' && window.ORLOG_GODS)
    ? window.ORLOG_GODS
    : (typeof require !== 'undefined' ? require('./gods.js').ORLOG_GODS : null);

  var FACES = ['axe', 'shield', 'arrow', 'axe', 'helmet', 'steal'];
  var GOLD_BY_TYPE = [
    ['arrow', 'steal'],
    ['shield', 'steal'],
    ['arrow', 'helmet'],
    ['steal', 'helmet'],
    ['shield', 'arrow'],
    ['shield', 'helmet']
  ];
  var MAX_HP = 15;
  // amenaza para el targeting automático de Loki/Frigg
  var THREAT = { axe: 5, arrow: 4, steal: 3, helmet: 2, shield: 1 };
  // desempate de mayoría para Freyr
  var MAJORITY_ORDER = ['axe', 'arrow', 'helmet', 'shield', 'steal'];

  function isGold(dieType, face) {
    return GOLD_BY_TYPE[dieType].indexOf(face) >= 0;
  }

  function OrlogEngine(cfg) {
    cfg = cfg || {};
    if (!GODS) throw new Error('ORLOG_GODS no está cargado');
    this.rng = cfg.rng || Math.random;

    var names = cfg.names || ['Jugador', 'Rival'];
    var gods = cfg.gods || [[], []];
    for (var p = 0; p < 2; p++) {
      (gods[p] || []).forEach(function (id) {
        if (!GODS.get(id)) throw new Error('Dios desconocido: ' + id);
      });
    }

    var first = (cfg.firstPlayer === 0 || cfg.firstPlayer === 1)
      ? cfg.firstPlayer
      : (this.rng() < 0.5 ? 0 : 1);

    function mkPlayer(name, godIds) {
      var dice = [];
      for (var i = 0; i < 6; i++) {
        dice.push({
          id: i, dieType: i, face: 'axe', gold: false,
          kept: false, banned: false, justRolled: false
        });
      }
      return {
        name: name, health: MAX_HP, tokens: 0,
        gods: (godIds || []).slice(), favor: null, dice: dice
      };
    }

    this.state = {
      phase: 'roll',
      round: 1,
      rollNum: 1,
      firstPlayer: first,
      activePlayer: first,
      winner: null,
      players: [mkPlayer(names[0], gods[0]), mkPlayer(names[1], gods[1])]
    };

    this._rolled = false;                 // el jugador activo ya tiró en este turno
    this._favorChosen = [false, false];
    this._resolved = false;
    this._turnQueue = this._cycleQueue(); // turnos pendientes de la tirada actual
  }

  // ---- utilidades internas ----

  OrlogEngine.prototype._p = function (i) { return this.state.players[i]; };

  OrlogEngine.prototype._cycleQueue = function () {
    var st = this.state, q = [];
    var order = [st.firstPlayer, 1 - st.firstPlayer];
    for (var i = 0; i < 2; i++) {
      var p = order[i];
      if (this._p(p).dice.some(function (d) { return !d.kept; })) q.push(p);
    }
    return q;
  };

  OrlogEngine.prototype._require = function (phase, what) {
    if (this.state.phase !== phase) {
      throw new Error('No se puede ' + what + ' en fase "' + this.state.phase + '"');
    }
  };

  OrlogEngine.prototype._rollDie = function (die) {
    var ix = Math.floor(this.rng() * 6);
    die.face = FACES[ix];
    die.gold = isGold(die.dieType, die.face);
  };

  OrlogEngine.prototype.getState = function () {
    return JSON.parse(JSON.stringify(this.state));
  };

  // ---- fase de tirada ----

  OrlogEngine.prototype.roll = function () {
    this._require('roll', 'tirar');
    if (this._rolled) throw new Error('Ya has tirado en este turno; elige y termina');
    var pl = this._p(this.state.activePlayer);
    var self = this;
    pl.dice.forEach(function (d) {
      if (d.kept) { d.justRolled = false; return; }
      self._rollDie(d);
      d.justRolled = true;
    });
    this._rolled = true;
  };

  OrlogEngine.prototype.toggleKeep = function (dieId) {
    this._require('roll', 'elegir dados');
    if (!this._rolled) throw new Error('Tira antes de elegir dados');
    var pl = this._p(this.state.activePlayer);
    var die = null;
    pl.dice.forEach(function (d) { if (d.id === dieId) die = d; });
    if (!die) throw new Error('Dado inexistente: ' + dieId);
    if (!die.justRolled) throw new Error('Ese dado ya está bloqueado de una tirada anterior');
    die.kept = !die.kept;
  };

  OrlogEngine.prototype.endTurn = function () {
    this._require('roll', 'terminar el turno');
    if (!this._rolled) throw new Error('Tira antes de terminar el turno');
    var st = this.state;
    var pl = this._p(st.activePlayer);

    // en la 3ª tirada todo queda bloqueado
    if (st.rollNum >= 3) {
      pl.dice.forEach(function (d) { d.kept = true; });
    }
    pl.dice.forEach(function (d) { d.justRolled = false; });

    this._rolled = false;
    this._turnQueue.shift();

    if (this._turnQueue.length === 0) {
      if (st.rollNum >= 3) { st.phase = 'favor'; return; }
      st.rollNum++;
      this._turnQueue = this._cycleQueue();
      if (this._turnQueue.length === 0) { st.phase = 'favor'; return; }
    }
    st.activePlayer = this._turnQueue[0];
  };

  OrlogEngine.prototype.keepAll = function () {
    this._require('roll', 'quedarse todo');
    if (!this._rolled) throw new Error('Tira antes de quedarte los dados');
    this._p(this.state.activePlayer).dice.forEach(function (d) { d.kept = true; });
    this.endTurn();
  };

  // ---- fase de favor ----

  OrlogEngine.prototype.selectFavor = function (playerIdx, godId, level) {
    this._require('favor', 'elegir favor');
    if (playerIdx !== 0 && playerIdx !== 1) throw new Error('Jugador inválido');
    if (this._favorChosen[playerIdx]) throw new Error('Ese jugador ya eligió favor');
    var pl = this._p(playerIdx);

    if (godId == null) {
      pl.favor = null;
    } else {
      if (pl.gods.indexOf(godId) < 0) throw new Error('Ese dios no es tuyo: ' + godId);
      var god = GODS.get(godId);
      var lv = level | 0;
      if (lv < 1 || lv > 3) throw new Error('Nivel inválido: ' + level);
      var cost = god.levels[lv - 1].cost;
      if (pl.tokens < cost) {
        throw new Error('Favor insuficiente: ' + godId + ' nivel ' + lv +
          ' cuesta ' + cost + ' y tienes ' + pl.tokens);
      }
      pl.favor = { godId: godId, level: lv };
    }
    this._favorChosen[playerIdx] = true;
    if (this._favorChosen[0] && this._favorChosen[1]) {
      this.state.phase = 'resolution';
    }
  };

  OrlogEngine.prototype.needsOdinPrompt = function () {
    if (this.state.phase !== 'resolution' || this._resolved) return null;
    for (var i = 0; i < 2; i++) {
      var p = this._p(i);
      if (p.favor && p.favor.godId === 'odin') {
        return { player: i, maxSacrifice: Math.max(0, p.health - 1) };
      }
    }
    return null;
  };

  // ---- resolución ----

  OrlogEngine.prototype.resolve = function (opts) {
    this._require('resolution', 'resolver');
    if (this._resolved) throw new Error('La ronda ya está resuelta');
    opts = opts || {};
    var odinSac = opts.odinSacrifice || {};

    var self = this;
    var st = this.state;
    var ev = [];
    var order = [st.firstPlayer, 1 - st.firstPlayer];
    var gameEnded = false;

    function alive(i) { return self._p(i).health > 0; }

    function keptDice(i) {
      return self._p(i).dice.filter(function (d) { return d.kept && !d.banned; });
    }

    function faceDice(i, face) {
      return keptDice(i).filter(function (d) { return d.face === face; });
    }

    function heal(i, amount, source) {
      var pl = self._p(i);
      var real = Math.min(amount, MAX_HP - pl.health);
      if (real <= 0) return;
      pl.health += real;
      ev.push({ type: 'heal', player: i, amount: real, source: source || null });
    }

    function hurt(i, amount, breakdown, blocked) {
      var pl = self._p(i);
      var real = Math.min(amount, pl.health);
      pl.health -= real;
      ev.push({
        type: 'damage', player: i, amount: real,
        blocked: blocked || 0, breakdown: breakdown || {}
      });
    }

    function checkDeath() {
      if (gameEnded) return true;
      var d0 = !alive(0), d1 = !alive(1);
      if (!d0 && !d1) return false;
      if (d0) ev.push({ type: 'death', player: 0 });
      if (d1) ev.push({ type: 'death', player: 1 });
      st.winner = (d0 && d1) ? 'draw' : (d0 ? 1 : 0);
      gameEnded = true;
      return true;
    }

    // Estado de favores en curso
    var reduction = [0, 0];   // Thrymr sobre el favor del jugador i
    var varHeal = [0, 0];     // Var activo del jugador i (cura por token rival)
    var pierce = [0, 0];      // Ullr: flechas que ignoran escudos
    var helHeal = [0, 0];     // Hel: cura por daño de hacha propio
    var heimdallHeal = [0, 0];
    var mimirGain = [0, 0];

    function pay(i, cost) {
      self._p(i).tokens -= cost;
      var foe = 1 - i;
      if (varHeal[foe] > 0 && cost > 0) {
        heal(foe, cost * varHeal[foe], 'var');
      }
    }

    // Targeting automático (Loki/Frigg): dados rivales más peligrosos
    function threatSorted(i) {
      return keptDice(i).slice().sort(function (a, b) {
        var t = (THREAT[b.face] || 0) - (THREAT[a.face] || 0);
        if (t) return t;
        return (b.gold ? 1 : 0) - (a.gold ? 1 : 0);
      });
    }

    // Entradas de favor ordenadas por prioridad (empate: jugador inicial antes)
    var entries = [];
    order.forEach(function (i) {
      var f = self._p(i).favor;
      if (!f) return;
      entries.push({ player: i, god: GODS.get(f.godId), level: f.level });
    });
    entries.sort(function (a, b) {
      var d = a.god.priority - b.god.priority;
      if (d) return d;
      return order.indexOf(a.player) - order.indexOf(b.player);
    });

    function runEntry(e) {
      var i = e.player, foe = 1 - i;
      var pl = self._p(i);
      var lv = e.level - reduction[i];
      if (lv < 1) {
        ev.push({ type: 'favorFailed', player: i, godId: e.god.id, reason: 'cancelled' });
        return;
      }
      var def = e.god.levels[lv - 1];
      if (pl.tokens < def.cost) {
        ev.push({ type: 'favorFailed', player: i, godId: e.god.id, reason: 'tokens' });
        return;
      }
      pay(i, def.cost);
      ev.push({ type: 'favorInvoked', player: i, godId: e.god.id, level: lv });
      applyGod(e.god.id, i, foe, def.value, lv);
    }

    function applyGod(id, i, foe, v) {
      var pl = self._p(i), en = self._p(foe);
      var detail = null;

      switch (id) {
        case 'thrymr':
          reduction[foe] += v;
          detail = { reducedLevels: v };
          break;

        case 'var':
          varHeal[i] = v;
          detail = { armed: true };
          break;

        case 'loki': {
          var targets = threatSorted(foe).slice(0, v);
          targets.forEach(function (d) {
            en.dice.forEach(function (real) { if (real.id === d.id) real.banned = true; });
          });
          detail = { banned: targets.map(function (d) { return d.id; }) };
          break;
        }

        case 'frigg': {
          var rr = threatSorted(foe).slice(0, v);
          var rerolled = [];
          rr.forEach(function (d) {
            en.dice.forEach(function (real) {
              if (real.id !== d.id) return;
              var from = real.face;
              self._rollDie(real);
              rerolled.push({ id: real.id, from: from, to: real.face, gold: real.gold });
            });
          });
          detail = { rerolled: rerolled };
          break;
        }

        case 'freyja': {
          var extras = [], goldExtras = 0, extraIds = [];
          var nextId = pl.dice.length ? pl.dice[pl.dice.length - 1].id + 1 : 6;
          for (var k = 0; k < v; k++) {
            var die = {
              id: nextId + k, dieType: Math.floor(self.rng() * 6),
              face: 'axe', gold: false, kept: true, banned: false, justRolled: false
            };
            self._rollDie(die);
            pl.dice.push(die);
            extras.push({ id: die.id, face: die.face, gold: die.gold });
            if (die.gold) { goldExtras++; extraIds.push(die.id); }
          }
          detail = { extraDice: extras };
          ev.push({ type: 'favorEffect', player: i, godId: id, detail: detail });
          if (goldExtras > 0) {
            pl.tokens += goldExtras;
            ev.push({ type: 'goldTokens', player: i, amount: goldExtras, diceIds: extraIds });
          }
          return; // eventos ya emitidos
        }

        case 'skuld': {
          var arrowsMine = faceDice(i, 'arrow').length;
          var destroy = Math.min(v * arrowsMine, en.tokens);
          en.tokens -= destroy;
          detail = { tokensDestroyed: destroy };
          break;
        }

        case 'vidar': {
          var helms = faceDice(foe, 'helmet');
          var removed = Math.min(v, helms.length);
          combat[foe].helmet = Math.max(0, combat[foe].helmet - v);
          detail = { removedHelmets: removed };
          break;
        }

        case 'ullr':
          pierce[i] = v;
          detail = { piercing: v };
          break;

        case 'baldr': {
          var addH = v * combat[i].helmetDice;
          var addS = v * combat[i].shieldDice;
          combat[i].helmet += addH;
          combat[i].shield += addS;
          if (addH > 0) {
            ev.push({ type: 'favorEffect', player: i, godId: id, detail: { added: { face: 'helmet', n: addH } } });
          }
          if (addS > 0) {
            ev.push({ type: 'favorEffect', player: i, godId: id, detail: { added: { face: 'shield', n: addS } } });
          }
          if (addH === 0 && addS === 0) {
            ev.push({ type: 'favorEffect', player: i, godId: id, detail: { added: { face: 'shield', n: 0 } } });
          }
          return;
        }

        case 'skadi': {
          var addA = v * combat[i].arrowDice;
          combat[i].arrow += addA;
          detail = { added: { face: 'arrow', n: addA } };
          break;
        }

        case 'brunhild': {
          var from = combat[i].axe;
          var to = Math.ceil(from * v);
          combat[i].axe = to;
          detail = { multiplied: { from: from, to: to } };
          break;
        }

        case 'freyr': {
          var best = MAJORITY_ORDER[0], bestN = -1;
          MAJORITY_ORDER.forEach(function (f) {
            if (combat[i][f] > bestN) { bestN = combat[i][f]; best = f; }
          });
          combat[i][best] += v;
          detail = { added: { face: best, n: v } };
          break;
        }

        case 'hel':
          helHeal[i] = v;
          detail = { armed: true };
          break;

        case 'heimdall':
          heimdallHeal[i] = v;
          detail = { armed: true };
          break;

        case 'mimir':
          mimirGain[i] = v;
          detail = { armed: true };
          break;

        case 'bragi': {
          var hands = faceDice(i, 'steal').length;
          var gain = v * hands;
          pl.tokens += gain;
          detail = { tokensGained: gain };
          break;
        }

        case 'thor':
          ev.push({ type: 'favorEffect', player: i, godId: id, detail: { directDamage: v } });
          hurt(foe, v, { direct: true }, 0);
          return;

        case 'tyr': {
          var sac = Math.min(v, Math.max(0, pl.health - 1));
          var loss = Math.min(sac * 2, en.tokens);
          if (sac > 0) hurt(i, sac, { sacrifice: true }, 0);
          en.tokens -= loss;
          if (loss > 0) ev.push({ type: 'tokens', player: foe, amount: -loss, source: 'tyr' });
          detail = null;
          return;
        }

        case 'odin': {
          var want = odinSac[i] | 0;
          var s = Math.max(0, Math.min(want, pl.health - 1));
          if (s > 0) {
            hurt(i, s, { sacrifice: true }, 0);
            var gained = v * s;
            pl.tokens += gained;
            ev.push({ type: 'tokens', player: i, amount: gained, source: 'odin' });
          }
          return;
        }

        case 'idun':
          heal(i, v, 'idun');
          return;

        default:
          detail = {};
      }

      ev.push({ type: 'favorEffect', player: i, godId: id, detail: detail || {} });
    }

    // ── 1. Tokens dorados ──
    order.forEach(function (i) {
      var goldDice = keptDice(i).filter(function (d) { return d.gold; });
      if (!goldDice.length) return;
      self._p(i).tokens += goldDice.length;
      ev.push({
        type: 'goldTokens', player: i, amount: goldDice.length,
        diceIds: goldDice.map(function (d) { return d.id; })
      });
    });

    // ── 2. Favores P1–P3 ──
    var pre = entries.filter(function (e) { return e.god.priority <= 3; });
    var mid = entries.filter(function (e) { return e.god.priority === 5; });
    var post = entries.filter(function (e) { return e.god.priority >= 6; });

    // combat se construye tras P2 (bans/rerolls/extras ya aplicados), pero
    // Skuld (P3) solo cuenta dados reales, así que puede ir antes.
    var combat = null;

    pre.forEach(runEntry);

    // ── Robo de manos (P4) ──
    (function () {
      var s0 = faceDice(0, 'steal').length;
      var s1 = faceDice(1, 'steal').length;
      var t0 = self._p(0).tokens, t1 = self._p(1).tokens;
      var steal0 = Math.min(s0, t1); // lo que roba el jugador 0
      var steal1 = Math.min(s1, t0);
      self._p(0).tokens = t0 - steal1 + steal0;
      self._p(1).tokens = t1 - steal0 + steal1;
      order.forEach(function (i) {
        var amt = i === 0 ? steal0 : steal1;
        if (amt > 0) ev.push({ type: 'steal', player: i, amount: amt });
      });
    })();

    // ── Recuento de combate ──
    combat = [null, null];
    [0, 1].forEach(function (i) {
      var c = { axe: 0, arrow: 0, helmet: 0, shield: 0, steal: 0, arrowDice: 0, helmetDice: 0, shieldDice: 0 };
      keptDice(i).forEach(function (d) {
        c[d.face]++;
        if (d.face === 'arrow') c.arrowDice++;
        if (d.face === 'helmet') c.helmetDice++;
        if (d.face === 'shield') c.shieldDice++;
      });
      combat[i] = c;
    });

    // ── Favores P5 (modificadores) ──
    mid.forEach(runEntry);

    // ── 3. Daño simultáneo ──
    var dmgInfo = [null, null];
    [0, 1].forEach(function (def) {
      var atk = 1 - def;
      var axes = combat[atk].axe;
      var axesBlocked = Math.min(axes, combat[def].helmet);
      var axeDmg = axes - axesBlocked;

      var arrows = combat[atk].arrow;
      var piercing = Math.min(pierce[atk], arrows);
      var normal = arrows - piercing;
      var arrowsBlocked = Math.min(normal, combat[def].shield);
      var arrowDmg = normal - arrowsBlocked + piercing;

      dmgInfo[def] = {
        total: axeDmg + arrowDmg,
        blocked: axesBlocked + arrowsBlocked,
        axeDmg: axeDmg,
        breakdown: {
          axes: axes, axesBlocked: axesBlocked,
          arrows: arrows, arrowsBlocked: arrowsBlocked, pierced: piercing
        }
      };
    });

    order.forEach(function (def) {
      var info = dmgInfo[def];
      hurt(def, info.total, info.breakdown, info.blocked);
    });

    // curas y ganancias ligadas al daño
    order.forEach(function (i) {
      var foe = 1 - i;
      if (helHeal[i] > 0 && dmgInfo[foe].axeDmg > 0) {
        heal(i, helHeal[i] * dmgInfo[foe].axeDmg, 'hel');
      }
      if (heimdallHeal[i] > 0 && dmgInfo[i].blocked > 0) {
        heal(i, heimdallHeal[i] * dmgInfo[i].blocked, 'heimdall');
      }
      if (mimirGain[i] > 0 && dmgInfo[i].total > 0) {
        var gain = mimirGain[i] * dmgInfo[i].total;
        self._p(i).tokens += gain;
        ev.push({ type: 'tokens', player: i, amount: gain, source: 'mimir' });
      }
    });

    // ── 4. Muerte tras el daño ──
    if (!checkDeath()) {
      // ── 5. Favores post-resolución ──
      for (var k = 0; k < post.length; k++) {
        runEntry(post[k]);
        if (checkDeath()) break;
      }
    }

    // ── 6. Cierre ──
    ev.push({
      type: 'roundEnd',
      summary: {
        healths: [this._p(0).health, this._p(1).health],
        tokens: [this._p(0).tokens, this._p(1).tokens]
      }
    });

    if (gameEnded) {
      st.phase = 'gameover';
      ev.push({ type: 'gameOver', winner: st.winner });
    }

    this._resolved = true;
    return { events: ev };
  };

  OrlogEngine.prototype.nextRound = function () {
    if (this.state.phase === 'gameover') throw new Error('La partida ha terminado');
    this._require('resolution', 'empezar nueva ronda');
    if (!this._resolved) throw new Error('Resuelve la ronda antes de continuar');

    var st = this.state;
    st.round++;
    st.rollNum = 1;
    st.firstPlayer = 1 - st.firstPlayer;
    st.activePlayer = st.firstPlayer;
    st.phase = 'roll';

    for (var i = 0; i < 2; i++) {
      var pl = this._p(i);
      pl.favor = null;
      pl.dice = pl.dice.filter(function (d) { return d.id < 6; });
      pl.dice.forEach(function (d) {
        d.kept = false; d.banned = false; d.justRolled = false;
      });
    }
    this._rolled = false;
    this._favorChosen = [false, false];
    this._resolved = false;
    this._turnQueue = this._cycleQueue();
  };

  if (typeof window !== 'undefined') window.OrlogEngine = OrlogEngine;
  if (typeof module !== 'undefined') module.exports = { OrlogEngine: OrlogEngine };
})();
