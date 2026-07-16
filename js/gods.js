// ORLOG — Datos de los Favores de los Dioses (20)
// Números contrastados con el juego original (AC Valhalla) y guías/clones publicados.
// priority: orden de resolución (1 primero). Ver SPEC.md §Orden exacto de la resolución.
(function () {
  'use strict';

  var GODS = [
    {
      id: 'thor', god: 'Thor', name: 'Golpe de Thor', rune: 'ᚦ', color: '#e8b03a',
      priority: 6,
      desc: 'Inflige daño directo al rival tras la resolución. Nada puede bloquearlo.',
      levels: [{ cost: 4, value: 2 }, { cost: 8, value: 5 }, { cost: 12, value: 8 }],
      levelDesc: function (v) { return v + ' de daño'; }
    },
    {
      id: 'idun', god: 'Idun', name: 'Rejuvenecimiento de Idun', rune: 'ᛁ', color: '#8fbf6f',
      priority: 7,
      desc: 'Cura vida tras la fase de resolución.',
      levels: [{ cost: 4, value: 2 }, { cost: 7, value: 4 }, { cost: 10, value: 6 }],
      levelDesc: function (v) { return '+' + v + ' de vida'; }
    },
    {
      id: 'vidar', god: 'Vidar', name: 'Fuerza de Vidar', rune: 'ᚹ', color: '#c96f3b',
      priority: 5,
      desc: 'Destruye cascos del rival antes de resolver el daño.',
      levels: [{ cost: 2, value: 2 }, { cost: 4, value: 4 }, { cost: 6, value: 6 }],
      levelDesc: function (v) { return 'Elimina ' + v + ' cascos'; }
    },
    {
      id: 'heimdall', god: 'Heimdall', name: 'Guardia de Heimdall', rune: 'ᚺ', color: '#7fb3c8',
      priority: 5,
      desc: 'Te cura por cada ataque que bloquees (con casco o escudo).',
      levels: [{ cost: 4, value: 1 }, { cost: 7, value: 2 }, { cost: 10, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' vida por bloqueo'; }
    },
    {
      id: 'ullr', god: 'Ullr', name: 'Puntería de Ullr', rune: 'ᚢ', color: '#a8d05a',
      priority: 5,
      desc: 'Tus flechas ignoran los escudos del rival.',
      levels: [{ cost: 2, value: 2 }, { cost: 3, value: 3 }, { cost: 4, value: 6 }],
      levelDesc: function (v) { return v + ' flechas ignoran escudos'; }
    },
    {
      id: 'baldr', god: 'Baldr', name: 'Invulnerabilidad de Baldr', rune: 'ᛒ', color: '#e8e1d0',
      priority: 5,
      desc: 'Añade cascos y escudos extra por cada casco/escudo que hayas sacado.',
      levels: [{ cost: 3, value: 1 }, { cost: 6, value: 2 }, { cost: 9, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' por cada equivalente'; }
    },
    {
      id: 'freyja', god: 'Freyja', name: 'Abundancia de Freyja', rune: 'ᚠ', color: '#d98cb3',
      priority: 2,
      desc: 'Tira dados adicionales esta ronda.',
      levels: [{ cost: 2, value: 1 }, { cost: 4, value: 2 }, { cost: 6, value: 3 }],
      levelDesc: function (v) { return '+' + v + (v === 1 ? ' dado extra' : ' dados extra'); }
    },
    {
      id: 'freyr', god: 'Freyr', name: 'Don de Freyr', rune: 'ᛃ', color: '#d4a94e',
      priority: 5,
      desc: 'Suma unidades al símbolo que tengas en mayoría.',
      levels: [{ cost: 4, value: 2 }, { cost: 6, value: 3 }, { cost: 8, value: 4 }],
      levelDesc: function (v) { return '+' + v + ' al símbolo mayoritario'; }
    },
    {
      id: 'hel', god: 'Hel', name: 'Presa de Hel', rune: 'ᛉ', color: '#9a5fc9',
      priority: 5,
      desc: 'Cada daño de hacha que inflijas te cura vida.',
      levels: [{ cost: 6, value: 1 }, { cost: 12, value: 2 }, { cost: 18, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' vida por daño de hacha'; }
    },
    {
      id: 'skadi', god: 'Skadi', name: 'Caza de Skadi', rune: 'ᛊ', color: '#bfe3f0',
      priority: 5,
      desc: 'Añade flechas a cada dado tuyo que haya sacado flecha.',
      levels: [{ cost: 6, value: 1 }, { cost: 10, value: 2 }, { cost: 14, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' flecha' + (v === 1 ? '' : 's') + ' por flecha'; }
    },
    {
      id: 'brunhild', god: 'Brunilda', name: 'Furia de Brunilda', rune: 'ᛟ', color: '#e05a3a',
      priority: 5,
      desc: 'Multiplica tus hachas (redondeando hacia arriba).',
      levels: [{ cost: 6, value: 1.5 }, { cost: 10, value: 2 }, { cost: 18, value: 3 }],
      levelDesc: function (v) { return 'Hachas ×' + v; }
    },
    {
      id: 'skuld', god: 'Skuld', name: 'Reclamo de Skuld', rune: 'ᛋ', color: '#6b7a8f',
      priority: 3,
      desc: 'Destruye favor del rival por cada dado tuyo con flecha.',
      levels: [{ cost: 4, value: 2 }, { cost: 6, value: 3 }, { cost: 8, value: 4 }],
      levelDesc: function (v) { return 'Rival −' + v + ' tokens por flecha'; }
    },
    {
      id: 'frigg', god: 'Frigg', name: 'Visión de Frigg', rune: 'ᚷ', color: '#c9b8e8',
      priority: 2,
      desc: 'Vuelve a tirar dados del rival.',
      levels: [{ cost: 2, value: 2 }, { cost: 3, value: 3 }, { cost: 4, value: 4 }],
      levelDesc: function (v) { return 'Re-tira ' + v + ' dados rivales'; }
    },
    {
      id: 'loki', god: 'Loki', name: 'Ardid de Loki', rune: 'ᛚ', color: '#5fc98f',
      priority: 2,
      desc: 'Anula dados del rival durante esta ronda.',
      levels: [{ cost: 3, value: 1 }, { cost: 6, value: 2 }, { cost: 9, value: 3 }],
      levelDesc: function (v) { return 'Anula ' + v + ' dado' + (v === 1 ? '' : 's') + ' rival' + (v === 1 ? '' : 'es'); }
    },
    {
      id: 'mimir', god: 'Mimir', name: 'Sabiduría de Mimir', rune: 'ᛗ', color: '#8fa8c9',
      priority: 5,
      desc: 'Gana favor por cada punto de daño que recibas esta ronda.',
      levels: [{ cost: 3, value: 1 }, { cost: 5, value: 2 }, { cost: 7, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' token' + (v === 1 ? '' : 's') + ' por daño recibido'; }
    },
    {
      id: 'bragi', god: 'Bragi', name: 'Brío de Bragi', rune: 'ᛘ', color: '#e8c56a',
      priority: 5,
      desc: 'Gana favor por cada dado de mano (robo) que hayas jugado.',
      levels: [{ cost: 4, value: 2 }, { cost: 8, value: 3 }, { cost: 12, value: 4 }],
      levelDesc: function (v) { return '+' + v + ' tokens por mano'; }
    },
    {
      id: 'odin', god: 'Odín', name: 'Sacrificio de Odín', rune: 'ᚬ', color: '#4a5a75',
      priority: 7,
      desc: 'Tras la resolución, sacrifica la vida que quieras y gana favor por cada una.',
      levels: [{ cost: 6, value: 3 }, { cost: 8, value: 4 }, { cost: 10, value: 5 }],
      levelDesc: function (v) { return '+' + v + ' tokens por vida sacrificada'; }
    },
    {
      id: 'var', god: 'Var', name: 'Vínculo de Var', rune: 'ᚡ', color: '#b3d98c',
      priority: 1,
      desc: 'Cada token de favor que gaste el rival te cura vida.',
      levels: [{ cost: 10, value: 1 }, { cost: 14, value: 2 }, { cost: 18, value: 3 }],
      levelDesc: function (v) { return '+' + v + ' vida por token rival gastado'; }
    },
    {
      id: 'thrymr', god: 'Thrymr', name: 'Hurto de Thrymr', rune: 'ᚴ', color: '#8f6b4a',
      priority: 1,
      desc: 'Reduce el nivel del favor que invoque el rival esta ronda.',
      levels: [{ cost: 3, value: 1 }, { cost: 6, value: 2 }, { cost: 9, value: 3 }],
      levelDesc: function (v) { return 'Favor rival −' + v + ' nivel' + (v === 1 ? '' : 'es'); }
    },
    {
      id: 'tyr', god: 'Tyr', name: 'Promesa de Tyr', rune: 'ᛏ', color: '#c94a4a',
      priority: 6,
      desc: 'Sacrifica tu vida para destruir el favor acumulado del rival.',
      levels: [{ cost: 2, value: 1 }, { cost: 4, value: 2 }, { cost: 6, value: 3 }],
      levelDesc: function (v) { return 'Sacrificas ' + v + ' vida · rival −' + (v * 2) + ' tokens'; }
    }
  ];

  var byId = {};
  GODS.forEach(function (g) { byId[g.id] = g; });

  var API = {
    list: GODS,
    get: function (id) { return byId[id]; }
  };

  if (typeof window !== 'undefined') window.ORLOG_GODS = API;
  if (typeof module !== 'undefined') module.exports = { ORLOG_GODS: API };
})();
