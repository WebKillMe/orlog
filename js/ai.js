// ORLOG — IA (3 niveles: easy «Descastado», normal «Jarl», hard «Rey»)
// Sin DOM. Determinista si se sustituye OrlogAI.rng.
(function () {
  'use strict';

  var GODS = (typeof window !== 'undefined' && window.ORLOG_GODS)
    ? window.ORLOG_GODS
    : (typeof require !== 'undefined' ? require('./gods.js').ORLOG_GODS : null);

  var ALL_IDS = GODS.list.map(function (g) { return g.id; });

  var NORMAL_POOL = ['thor', 'idun', 'vidar', 'ullr', 'baldr', 'brunhild',
    'skadi', 'heimdall', 'mimir', 'frigg', 'loki'];

  var HARD_SETS = [
    ['thor', 'baldr', 'thrymr'],
    ['ullr', 'skadi', 'idun'],
    ['hel', 'brunhild', 'var'],
    ['thor', 'mimir', 'loki'],
    ['brunhild', 'vidar', 'idun'],
    ['thor', 'frigg', 'baldr']
  ];

  var OrlogAI = {
    rng: Math.random,

    pickGods: function (difficulty) {
      if (difficulty === 'hard') {
        return HARD_SETS[Math.floor(this.rng() * HARD_SETS.length)].slice();
      }
      var pool = difficulty === 'normal' ? NORMAL_POOL.slice() : ALL_IDS.slice();
      shuffle(pool, this.rng);
      return pool.slice(0, 3);
    },

    decideKeeps: function (state, difficulty) {
      var me = state.activePlayer;
      var pl = state.players[me];
      var rolled = pl.dice.filter(function (d) { return d.justRolled && !d.kept; });
      if (!rolled.length) return { keep: [], stopRolling: false };

      if (difficulty === 'easy') return this._easyKeeps(state, rolled);
      return this._smartKeeps(state, rolled, difficulty);
    },

    _easyKeeps: function (state, rolled) {
      var rng = this.rng, keep = [];
      rolled.forEach(function (d) {
        var p = d.face === 'axe' ? 0.6 : 0.3;
        if (rng() < p) keep.push(d.id);
      });
      var stop = state.rollNum >= 2 && rng() < 0.15;
      return { keep: keep, stopRolling: stop };
    },

    _smartKeeps: function (state, rolled, difficulty) {
      var me = state.activePlayer, foeIx = 1 - me;
      var pl = state.players[me], foe = state.players[foeIx];
      var hard = difficulty === 'hard';
      var rng = this.rng;

      var myKept = counts(pl, true);
      var foeKept = counts(foe, true);
      var foeUnkept = foe.dice.filter(function (d) { return !d.kept; }).length;

      // proyección del rival: lo bloqueado + lo esperable de sus dados libres
      var expFoe = {
        axe: foeKept.axe + foeUnkept / 3,
        arrow: foeKept.arrow + foeUnkept / 6,
        helmet: foeKept.helmet + foeUnkept / 6,
        shield: foeKept.shield + foeUnkept / 6
      };

      // coste mínimo de mis dioses (para valorar el favor dorado)
      var minCost = 99;
      pl.gods.forEach(function (id) {
        var g = GODS.get(id);
        if (g && g.levels[0].cost < minCost) minCost = g.levels[0].cost;
      });
      var tokenHunger = pl.tokens < minCost ? 0.18 : 0;

      // evaluación voraz en orden de amenaza, con recuento acumulado
      var run = { axe: myKept.axe, arrow: myKept.arrow, helmet: myKept.helmet, shield: myKept.shield, steal: myKept.steal };
      var sorted = rolled.slice().sort(function (a, b) {
        var ord = { axe: 0, arrow: 1, helmet: 2, shield: 3, steal: 4 };
        return ord[a.face] - ord[b.face];
      });

      var lowFoe = foe.health <= 6;
      var lowMe = pl.health <= 5;
      var threshold = hard ? (state.rollNum >= 2 ? 0.55 : 0.7) : 0.65;
      // si la partida se eterniza, dejar de jugar a la tortuga
      var aggression = Math.min(0.6, Math.max(0, (state.round - 10) * 0.08));

      var keep = [];
      sorted.forEach(function (d) {
        var s = 0;
        switch (d.face) {
          case 'axe':
            s = (run.axe + 1 > expFoe.helmet) ? 1.0 : 0.45;
            if (lowFoe) s += 0.4;
            s += aggression;
            break;
          case 'arrow':
            s = (run.arrow + 1 > expFoe.shield) ? 0.85 : 0.4;
            if (lowFoe) s += 0.25;
            if (pl.gods.indexOf('ullr') >= 0 || pl.gods.indexOf('skadi') >= 0) s += 0.15;
            s += aggression;
            break;
          case 'helmet':
            s = (expFoe.axe > run.helmet) ? 0.85 : 0.3;
            if (lowMe) s += 0.3;
            if (pl.gods.indexOf('baldr') >= 0) s += 0.1;
            s -= aggression * 0.7;
            break;
          case 'shield':
            s = (expFoe.arrow > run.shield) ? 0.7 : 0.25;
            if (lowMe) s += 0.2;
            if (pl.gods.indexOf('baldr') >= 0) s += 0.1;
            s -= aggression * 0.7;
            break;
          case 'steal':
            s = foe.tokens > 0 ? 0.7 : 0.25;
            if (foe.tokens >= 4) s += 0.2;
            if (pl.gods.indexOf('bragi') >= 0) s += 0.2;
            break;
        }
        if (d.gold) s += 0.35 + tokenHunger;
        if (!hard) s += (rng() - 0.5) * 0.2; // el Jarl duda un poco
        if (s >= threshold) {
          keep.push(d.id);
          run[d.face]++;
        }
      });

      // ¿plantarse? — si lo que hay sobre la mesa ya es letal, bloquear todo
      var stop = false;
      if (hard) {
        var all = counts(pl, false); // todas las caras actuales (kept + recién tiradas)
        var dmg = Math.max(0, all.axe - foeKept.helmet - foeUnkept / 6 * 1.2) +
          Math.max(0, all.arrow - foeKept.shield - foeUnkept / 6 * 1.2);
        if (dmg >= foe.health) stop = true;
      }
      return { keep: keep, stopRolling: stop };
    },

    decideFavor: function (state, difficulty, playerIdx) {
      var pl = state.players[playerIdx];
      var rng = this.rng;

      if (difficulty === 'easy') {
        if (rng() >= 0.35) return null;
        var options = [];
        pl.gods.forEach(function (id) {
          var g = GODS.get(id);
          g.levels.forEach(function (lv, i) {
            if (pl.tokens >= lv.cost) options.push({ godId: id, level: i + 1 });
          });
        });
        if (!options.length) return null;
        return options[Math.floor(rng() * options.length)];
      }

      var hard = difficulty === 'hard';
      var best = null, bestNet = -1;
      var self = this;
      pl.gods.forEach(function (id) {
        var g = GODS.get(id);
        g.levels.forEach(function (lv, i) {
          if (pl.tokens < lv.cost) return;
          var u = self._favorUtility(state, playerIdx, id, lv.value, hard);
          var net = u - lv.cost * (hard ? 0.28 : 0.35);
          if (u >= 90) net = u; // letal: el coste da igual
          if (net > bestNet) { bestNet = net; best = { godId: id, level: i + 1 }; }
        });
      });

      var threshold = hard ? 0.4 : 0.8;
      if (!hard && rng() < 0.15) return null; // el Jarl a veces se lo guarda
      return (best && bestNet >= threshold) ? best : null;
    },

    _favorUtility: function (state, me, godId, v, hard) {
      var foeIx = 1 - me;
      var pl = state.players[me], foe = state.players[foeIx];
      var my = counts(pl, true), en = counts(foe, true);

      var dmgOut = Math.max(0, my.axe - en.helmet) + Math.max(0, my.arrow - en.shield);
      var dmgIn = Math.max(0, en.axe - my.helmet) + Math.max(0, en.arrow - my.shield);
      var dying = dmgIn >= pl.health;
      var def = dying ? 2 : 1; // pánico defensivo
      // curarse pierde gracia si la partida se eterniza (rompe tablas infinitas)
      var lateness = Math.min(0.8, Math.max(0, (state.round - 10) * 0.08));

      switch (godId) {
        case 'thor':
          if (dmgOut + v >= foe.health) return 100;
          return v * 0.9;
        case 'idun': {
          if (dying) return 0; // Idun llega tarde si mueres en la resolución
          var hpAfter = Math.max(0, pl.health - dmgIn);
          var useful = Math.min(v, 15 - hpAfter);
          return useful * (pl.health <= 8 ? 1.1 : 0.6) * (1 - lateness);
        }
        case 'heimdall': {
          var blocks = Math.min(en.axe, my.helmet) + Math.min(en.arrow, my.shield);
          return Math.min(v * blocks, 15 - pl.health) * 0.7 * (1 - lateness);
        }
        case 'vidar': {
          var gain = Math.min(Math.min(v, en.helmet), my.axe);
          if (dmgOut + gain >= foe.health && gain > 0) return 90;
          return gain;
        }
        case 'ullr': {
          var blocked = Math.min(my.arrow, en.shield);
          var gainU = Math.min(v, blocked);
          if (dmgOut + gainU >= foe.health && gainU > 0) return 90;
          return gainU;
        }
        case 'baldr': {
          var extraH = Math.min(v * my.helmet, Math.max(0, en.axe - my.helmet));
          var extraS = Math.min(v * my.shield, Math.max(0, en.arrow - my.shield));
          return (extraH + extraS) * def;
        }
        case 'freyja': return v * 0.55;
        case 'freyr': return v * 0.65;
        case 'hel': {
          var axeDmg = Math.max(0, my.axe - en.helmet);
          return Math.min(v * axeDmg, 15 - pl.health) * 0.8;
        }
        case 'skadi': {
          var extra = Math.max(0, (my.arrow + v * my.arrow) - en.shield) -
            Math.max(0, my.arrow - en.shield);
          if (dmgOut + extra >= foe.health && extra > 0) return 90;
          return extra;
        }
        case 'brunhild': {
          var newAxes = Math.ceil(my.axe * v);
          var extraB = Math.max(0, newAxes - en.helmet) - Math.max(0, my.axe - en.helmet);
          if (dmgOut + extraB >= foe.health && extraB > 0) return 90;
          return extraB;
        }
        case 'skuld':
          return Math.min(v * my.arrow, foe.tokens) * 0.4;
        case 'frigg': {
          var danger = Math.max(0, en.axe - my.helmet) + Math.max(0, en.arrow - my.shield);
          return Math.min(v, danger) * 0.55 * def;
        }
        case 'loki': {
          var dangerL = Math.max(0, en.axe - my.helmet) + Math.max(0, en.arrow - my.shield);
          return Math.min(v, dangerL) * 0.85 * def;
        }
        case 'mimir':
          return dmgIn * v * (dying ? 0 : 0.3);
        case 'bragi':
          return v * my.steal * 0.35;
        case 'odin':
          return (pl.health >= 12 && !dying) ? 0.6 : 0;
        case 'var':
          return foe.tokens >= 8 ? 1.0 : 0.1;
        case 'thrymr':
          return foe.tokens >= 4 ? (hard ? 1.1 : 0.9) : 0;
        case 'tyr': {
          var destroyed = Math.min(v * 2, foe.tokens);
          return destroyed * 0.35 - v * (dying ? 9 : 0.8);
        }
      }
      return 0;
    },

    decideOdinSacrifice: function (state, playerIdx) {
      var pl = state.players[playerIdx];
      if (pl.health > 8) return Math.min(pl.health - 8, 4);
      if (pl.health > 5) return 1;
      return 0;
    }
  };

  function counts(pl, keptOnly) {
    var c = { axe: 0, arrow: 0, helmet: 0, shield: 0, steal: 0 };
    pl.dice.forEach(function (d) {
      if (d.banned) return;
      if (keptOnly && !d.kept) return;
      c[d.face]++;
    });
    return c;
  }

  function shuffle(arr, rng) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  if (typeof window !== 'undefined') window.OrlogAI = OrlogAI;
  if (typeof module !== 'undefined') module.exports = { OrlogAI: OrlogAI };
})();
