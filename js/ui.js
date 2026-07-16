// ORLOG — UI completa (DOM, animaciones, sonido, flujo de partida)
// Contrato: window.OrlogUI. Usa window.ORLOG_GODS, window.OrlogEngine, window.OrlogAI.
(function () {
  'use strict';

  var REDUCED = (typeof matchMedia !== 'undefined') &&
    matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ROMAN = ['I', 'II', 'III'];

  var DIFFS = [
    {
      id: 'easy', name: 'Descastado', rune: 'ᚢ',
      desc: 'Un saqueador sin clan ni juicio. Tira los dados como quien tira la vida: sin pensar.'
    },
    {
      id: 'normal', name: 'Jarl', rune: 'ᛃ',
      desc: 'Señor de su tierra y de sus dados. Sabe lo que hace… casi siempre.'
    },
    {
      id: 'hard', name: 'Rey', rune: 'ᚦ',
      desc: 'Cuenta tus dados, cuenta tus errores y no perdona ninguno de los dos.'
    }
  ];

  var DIFF_NAME = { easy: 'Descastado', normal: 'Jarl', hard: 'Rey' };

  var FACE_NAMES = {
    axe: 'hacha', arrow: 'flecha', helmet: 'casco', shield: 'escudo', steal: 'mano'
  };
  var FACE_PLURAL = {
    axe: 'hachas', arrow: 'flechas', helmet: 'cascos', shield: 'escudos', steal: 'manos'
  };
  // Ciclo de caras físico de cada dado (para poblar las caras ocultas del cubo)
  var FACE_CYCLE = ['axe', 'shield', 'arrow', 'axe', 'helmet', 'steal'];

  // ── Iconos SVG propios (22px legibles, sin emoji) ──────────────────────────
  var ICONS = {
    axe:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M5.9 21.6 4.4 20.1 13.9 10.6 15.4 12.1z"/>' +
      '<path fill="currentColor" d="M12.9 5.9C15 3.2 18.4 1.9 21.7 2.6c-.3 3.3-2.3 6.3-5.3 7.9l-1.1.6-3.2-3.2z"/>' +
      '<path fill="currentColor" opacity=".8" d="M12.3 11.5c-1.6-.4-3-1.2-4.2-2.4l1.5-1.5c1.2 1.2 2 2.6 2.7 3.9z"/>' +
      '</svg>',
    arrow:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M20.9 3.1 13.4 4.8l5.8 5.8z"/>' +
      '<path fill="currentColor" d="M4.5 21 3 19.5 15.6 6.9l1.5 1.5z"/>' +
      '<path fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" d="M5.9 14.2l3.9 3.9M3.7 16.4l3.9 3.9"/>' +
      '</svg>',
    helmet:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="currentColor" d="M12 2.8c4.5 0 8.1 3.5 8.1 7.9v3.6h-5.3v-2.7h-1.5v9.6L12 19.7l-1.3 1.5v-9.6H9.2v2.7H3.9v-3.6C3.9 6.3 7.5 2.8 12 2.8z"/>' +
      '</svg>',
    shield:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<circle cx="12" cy="12" r="8.6" fill="none" stroke="currentColor" stroke-width="2.2"/>' +
      '<circle cx="12" cy="12" r="2.7" fill="currentColor"/>' +
      '<path stroke="currentColor" stroke-width="1.4" d="M12 3.4v5.1M12 15.5v5.1M3.4 12h5.1M15.5 12h5.1"/>' +
      '</svg>',
    steal:
      '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">' +
      '<path d="M7.8 11.8V6a1.3 1.3 0 0 1 2.6 0v4.4"/>' +
      '<path d="M10.4 10.4V4.7a1.3 1.3 0 0 1 2.6 0v5.5"/>' +
      '<path d="M13 10.2V5.5a1.3 1.3 0 0 1 2.6 0v5.9"/>' +
      '<path d="M15.6 11.4V7.3a1.3 1.3 0 0 1 2.6 0v6c0 4.2-2.6 7.2-6.4 7.2-2.9 0-4.7-1.5-6.2-4.4l-1.5-2.9c-.5-1 .7-1.9 1.5-1.2l2.2 1.9"/>' +
      '</svg>',
    lock:
      '<svg viewBox="0 0 24 24" aria-hidden="true">' +
      '<path fill="none" stroke="currentColor" stroke-width="2.4" d="M7.5 11V7.5a4.5 4.5 0 0 1 9 0V11"/>' +
      '<rect x="5" y="10.5" width="14" height="10" rx="2" fill="currentColor"/>' +
      '</svg>'
  };

  function el(tag, cls, html) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (html != null) e.innerHTML = html;
    return e;
  }

  function wait(ms) {
    return new Promise(function (res) { setTimeout(res, ms); });
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  // ── Sonido WebAudio sintetizado, muy sutil ─────────────────────────────────
  function Sfx() {
    this.muted = false;
    try { this.muted = localStorage.getItem('orlog_muted') === '1'; } catch (e) { /* file:// raro */ }
    this.ctx = null;
    this.master = null;
  }

  Sfx.prototype._ensure = function () {
    if (!this.ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try {
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.45;
        this.master.connect(this.ctx.destination);
      } catch (e) { return null; }
    }
    if (this.ctx.state === 'suspended') { try { this.ctx.resume(); } catch (e) { } }
    return this.ctx;
  };

  Sfx.prototype.toggle = function () {
    this.muted = !this.muted;
    try { localStorage.setItem('orlog_muted', this.muted ? '1' : '0'); } catch (e) { }
    return this.muted;
  };

  Sfx.prototype._tone = function (type, f0, f1, t0, dur, peak) {
    var ctx = this.ctx;
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, t0);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(peak, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  };

  Sfx.prototype._noise = function (t0, dur, freq, q, peak, type) {
    var ctx = this.ctx;
    var len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    var src = ctx.createBufferSource();
    src.buffer = buf;
    var filt = ctx.createBiquadFilter();
    filt.type = type || 'bandpass';
    filt.frequency.value = freq;
    filt.Q.value = q || 1;
    var g = ctx.createGain();
    g.gain.setValueAtTime(peak, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filt); filt.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  };

  Sfx.prototype.play = function (name) {
    if (this.muted) return;
    if (!this._ensure()) return;
    var t = this.ctx.currentTime + 0.01;
    try {
      switch (name) {
        case 'click':
          this._tone('triangle', 660, 440, t, 0.07, 0.06); break;
        case 'tick':
          this._tone('triangle', 1100, 900, t, 0.045, 0.045); break;
        case 'dice':
          this._noise(t, 0.07, 2100, 1.4, 0.11);
          this._noise(t + 0.05, 0.06, 1500, 1.2, 0.09);
          this._noise(t + 0.11, 0.05, 2600, 1.6, 0.07);
          break;
        case 'coin':
          this._tone('sine', 1568, 1568, t, 0.18, 0.07);
          this._tone('sine', 2093, 2093, t + 0.02, 0.22, 0.05);
          break;
        case 'thud':
          this._tone('sine', 150, 42, t, 0.32, 0.22);
          this._noise(t, 0.12, 220, 0.8, 0.1, 'lowpass');
          break;
        case 'crack':
          this._noise(t, 0.05, 3200, 2, 0.09, 'highpass'); break;
        case 'block':
          this._tone('square', 320, 240, t, 0.09, 0.05);
          this._noise(t, 0.08, 900, 3, 0.06);
          break;
        case 'heal':
          this._tone('sine', 523, 659, t, 0.35, 0.05);
          this._tone('sine', 784, 784, t + 0.1, 0.3, 0.035);
          break;
        case 'invoke':
          this._tone('sawtooth', 62, 130, t, 0.85, 0.06);
          this._tone('sine', 262, 392, t + 0.1, 0.6, 0.04);
          break;
        case 'ban':
          this._tone('square', 240, 110, t, 0.25, 0.05); break;
        case 'fail':
          this._tone('square', 220, 120, t, 0.3, 0.05); break;
        case 'gong':
          this._tone('sine', 98, 96, t, 1.3, 0.16);
          this._tone('sine', 147, 145, t, 1.0, 0.07);
          break;
        case 'win':
          this._tone('triangle', 523, 523, t, 0.16, 0.07);
          this._tone('triangle', 659, 659, t + 0.15, 0.16, 0.07);
          this._tone('triangle', 784, 784, t + 0.3, 0.16, 0.07);
          this._tone('triangle', 1047, 1047, t + 0.45, 0.4, 0.08);
          break;
        case 'lose':
          this._tone('triangle', 392, 392, t, 0.22, 0.07);
          this._tone('triangle', 330, 330, t + 0.2, 0.22, 0.07);
          this._tone('triangle', 262, 250, t + 0.4, 0.5, 0.08);
          break;
      }
    } catch (e) { /* el sonido nunca rompe el juego */ }
  };

  // ── UI ─────────────────────────────────────────────────────────────────────

  function OrlogUI(rootEl) {
    if (!rootEl) throw new Error('OrlogUI necesita un elemento raíz');
    this.root = rootEl;
    this.GODS = window.ORLOG_GODS;
    this.sound = new Sfx();

    this.engine = null;
    this.difficulty = null;
    this.aiName = 'Jarl';
    this.lastConfig = null;
    this.gameToken = 0;

    this.mirror = { health: [15, 15], tokens: [0, 0] };
    this.stats = { dmg: [0, 0], rounds: 1 };

    this._buildShell();
    this.showScreen('title');
  }

  OrlogUI.prototype.ms = function (x) {
    return REDUCED ? Math.min(80, x) : x;
  };

  // ---- Construcción de pantallas ----

  OrlogUI.prototype._buildShell = function () {
    var self = this;
    this.root.innerHTML = '';
    this.root.className = 'orlog-app';

    this.screens = {
      title: el('section', 'screen screen-title'),
      difficulty: el('section', 'screen screen-difficulty'),
      draft: el('section', 'screen screen-draft'),
      board: el('section', 'screen screen-board'),
      end: el('section', 'screen screen-end')
    };
    var k;
    for (k in this.screens) this.root.appendChild(this.screens[k]);

    // Overlays globales
    this.vignetteEl = el('div', 'vignette');
    this.root.appendChild(this.vignetteEl);

    this.muteBtn = el('button', 'mute-btn', this.sound.muted ? '🔇' : '🔊');
    this.muteBtn.setAttribute('aria-label', 'Silenciar sonido');
    this.muteBtn.addEventListener('click', function () {
      var m = self.sound.toggle();
      self.muteBtn.innerHTML = m ? '🔇' : '🔊';
      if (!m) self.sound.play('click');
    });
    this.root.appendChild(this.muteBtn);

    this.helpBtn = el('button', 'help-btn', '?');
    this.helpBtn.setAttribute('aria-label', 'Cómo se juega');
    this.helpBtn.title = 'Cómo se juega';
    this.helpBtn.addEventListener('click', function () {
      self.sound.play('click');
      self.openHelp();
    });
    this.root.appendChild(this.helpBtn);

    this._buildTitle();
    this._buildDifficulty();
    this._buildDraft();
  };

  OrlogUI.prototype.showScreen = function (name) {
    for (var k in this.screens) {
      this.screens[k].classList.toggle('active', k === name);
    }
  };

  OrlogUI.prototype._buildTitle = function () {
    var self = this;
    var s = this.screens.title;
    s.innerHTML = '';

    var embers = el('div', 'embers');
    for (var i = 0; i < 16; i++) {
      var e = el('span', 'ember');
      e.style.setProperty('--x', (3 + Math.random() * 94) + '%');
      e.style.setProperty('--s', (3 + Math.random() * 5) + 'px');
      e.style.setProperty('--d', (7 + Math.random() * 9) + 's');
      e.style.setProperty('--delay', (-Math.random() * 14) + 's');
      e.style.setProperty('--sway', ((Math.random() * 60 - 30)) + 'px');
      embers.appendChild(e);
    }
    s.appendChild(embers);

    s.appendChild(el('div', 'rune-frieze', 'ᚠ ᚢ ᚦ ᚨ ᚱ ᚲ ᚷ ᚹ ᚺ ᚾ ᛁ ᛃ'));
    s.appendChild(el('h1', 'title-word', 'ORLOG'));
    s.appendChild(el('p', 'title-sub', 'El juego de dados del destino'));

    var play = el('button', 'btn btn-primary btn-big', 'Jugar');
    play.addEventListener('click', function () {
      self.sound.play('click');
      self.showScreen('difficulty');
    });
    s.appendChild(play);

    var help = el('button', 'btn btn-ghost', 'Cómo se juega');
    help.addEventListener('click', function () {
      self.sound.play('click');
      self.openHelp();
    });
    s.appendChild(help);

    s.appendChild(el('div', 'rune-frieze bottom', 'ᛈ ᛇ ᛉ ᛊ ᛏ ᛒ ᛖ ᛗ ᛚ ᛜ ᛞ ᛟ'));
    s.appendChild(el('p', 'title-credit',
      'Concepto original de Ubisoft© en Assassin’s Creed Valhalla®'));
  };

  OrlogUI.prototype.openHelp = function () {
    var self = this;
    function faceRow(face, title, desc) {
      return '<div class="help-face">' +
        '<span class="help-ic">' + (ICONS[face] || '') + '</span>' +
        '<span class="help-face-txt"><b>' + title + '</b>' + desc + '</span></div>';
    }
    var ov = el('div', 'overlay help-overlay');
    var panel = el('div', 'help-panel');
    panel.innerHTML =
      '<h3 class="help-title">Cómo se juega a Orlog</h3>' +
      '<div class="help-body">' +
        '<section><h4>El objetivo</h4><p>Cada jugador empieza con <b>15 piedras de vida</b>. ' +
          'Gana quien deje al rival sin ninguna. Se juega por rondas.</p></section>' +
        '<section><h4>Una ronda, paso a paso</h4><ol>' +
          '<li><b>Tiradas.</b> Tienes 6 dados y tres tiradas. Tras cada tirada eliges qué dados ' +
            '<b>te quedas</b> (se bloquean) y vuelves a tirar el resto. Tú y el rival os turnáis.</li>' +
          '<li><b>Favor.</b> Si tienes tokens, puedes invocar el favor de un dios. Es opcional.</li>' +
          '<li><b>Resolución.</b> Se aplican los dados y los favores a la vez: los ataques ' +
            'que no se bloquean quitan vida.</li>' +
        '</ol></section>' +
        '<section><h4>Las caras del dado</h4><div class="help-faces">' +
          faceRow('axe', 'Hacha', ' — 1 de daño cuerpo a cuerpo. La bloquea un casco.') +
          faceRow('arrow', 'Flecha', ' — 1 de daño a distancia. La bloquea un escudo.') +
          faceRow('helmet', 'Casco', ' — bloquea un hacha rival.') +
          faceRow('shield', 'Escudo', ' — bloquea una flecha rival.') +
          faceRow('steal', 'Mano', ' — roba un token de favor al rival.') +
        '</div></section>' +
        '<section><h4>Tokens de favor</h4><p>Los consigues de dos formas: con las ' +
          '<b>caras doradas</b> (borde punteado) de tus dados, y <b>robándolos</b> con las manos. ' +
          'Con ellos pagas los favores de los dioses.</p></section>' +
        '<section><h4>Favores de los dioses</h4><p>Antes de jugar eliges 3 dioses. En la fase de ' +
          'favor gastas tokens para invocar uno, con tres niveles de potencia (más tokens, más ' +
          'efecto): daño directo, curación, robo, multiplicar tus hachas, anular dados del rival… ' +
          'Un favor <b>falla</b> si te roban los tokens antes de pagarlo.</p></section>' +
        '<section><h4>Cómo se cuenta el daño</h4><p>Se resuelve para los dos a la vez: ' +
          '<b>hachas − cascos del rival</b> y <b>flechas − escudos del rival</b>. ' +
          'Lo que sobre, resta vida. Si lo bloqueas todo, no recibes daño.</p></section>' +
        '<section class="help-tips"><h4>Consejos</h4><ul>' +
          '<li>Si el rival guarda muchas hachas, quédate cascos para frenarlas.</li>' +
          '<li>Las caras doradas alimentan tus favores: no las malgastes.</li>' +
          '<li>Ahorrar para un favor de nivel alto suele rentar más que gastar pronto.</li>' +
        '</ul></section>' +
      '</div>';
    var close = el('button', 'btn btn-primary help-close', 'Entendido');
    function teardown() {
      ov.remove();
      document.removeEventListener('keydown', onKey);
    }
    function onKey(e) { if (e.key === 'Escape') teardown(); }
    close.addEventListener('click', function () { self.sound.play('click'); teardown(); });
    panel.appendChild(close);
    ov.addEventListener('click', function (e) { if (e.target === ov) teardown(); });
    document.addEventListener('keydown', onKey);
    ov.appendChild(panel);
    document.body.appendChild(ov);
  };

  OrlogUI.prototype._buildDifficulty = function () {
    var self = this;
    var s = this.screens.difficulty;
    s.innerHTML = '';
    s.appendChild(el('h2', 'screen-head', 'Elige a tu rival'));
    var row = el('div', 'diff-row');
    DIFFS.forEach(function (d) {
      var c = el('button', 'diff-card',
        '<span class="diff-rune">' + d.rune + '</span>' +
        '<span class="diff-name">' + d.name + '</span>' +
        '<span class="diff-desc">' + d.desc + '</span>');
      c.addEventListener('click', function () {
        self.sound.play('click');
        self.difficulty = d.id;
        self.aiName = DIFF_NAME[d.id];
        self._resetDraft();
        self.showScreen('draft');
      });
      row.appendChild(c);
    });
    s.appendChild(row);
    var back = el('button', 'btn btn-ghost', 'Volver');
    back.addEventListener('click', function () { self.showScreen('title'); });
    s.appendChild(back);
  };

  OrlogUI.prototype._buildDraft = function () {
    var self = this;
    var s = this.screens.draft;
    s.innerHTML = '';
    s.appendChild(el('h2', 'screen-head', 'Invoca a tus tres dioses'));
    s.appendChild(el('p', 'screen-sub', 'Sus favores te acompañarán en la batalla. Elige con cabeza.'));

    this.draftPick = [];
    var grid = el('div', 'draft-grid');
    this.draftCards = {};

    this.GODS.list.forEach(function (g) {
      var lv = '';
      for (var i = 0; i < 3; i++) {
        lv += '<li><b>' + ROMAN[i] + '</b><span class="cost">✦' + g.levels[i].cost +
          '</span><span class="lvl-txt">' + g.levelDesc(g.levels[i].value) + '</span></li>';
      }
      var c = el('button', 'god-card');
      c.style.setProperty('--god-color', g.color);
      c.innerHTML =
        '<span class="g-rune">' + g.rune + '</span>' +
        '<span class="g-title">' + g.name + '</span>' +
        '<span class="g-god">' + g.god + '</span>' +
        '<span class="g-desc">' + g.desc + '</span>' +
        '<ul class="g-levels">' + lv + '</ul>';
      c.addEventListener('click', function () { self._toggleDraft(g.id); });
      self.draftCards[g.id] = c;
      grid.appendChild(c);
    });
    s.appendChild(grid);

    var bar = el('div', 'draft-bar');
    this.draftCount = el('span', 'draft-count', '0 / 3 elegidos');
    this.draftGo = el('button', 'btn btn-primary', 'Al combate');
    this.draftGo.disabled = true;
    this.draftGo.addEventListener('click', function () {
      if (self.draftPick.length !== 3) return;
      self.sound.play('click');
      self._startMatchFromDraft();
    });
    var back = el('button', 'btn btn-ghost', 'Volver');
    back.addEventListener('click', function () { self.showScreen('difficulty'); });
    bar.appendChild(back);
    bar.appendChild(this.draftCount);
    bar.appendChild(this.draftGo);
    s.appendChild(bar);
  };

  OrlogUI.prototype._resetDraft = function () {
    this.draftPick = [];
    for (var id in this.draftCards) this.draftCards[id].classList.remove('selected');
    this.draftCount.textContent = '0 / 3 elegidos';
    this.draftGo.disabled = true;
  };

  OrlogUI.prototype._toggleDraft = function (godId) {
    var i = this.draftPick.indexOf(godId);
    if (i >= 0) {
      this.draftPick.splice(i, 1);
      this.draftCards[godId].classList.remove('selected');
    } else {
      if (this.draftPick.length >= 3) return;
      this.draftPick.push(godId);
      this.draftCards[godId].classList.add('selected');
      this.sound.play('tick');
    }
    this.draftCount.textContent = this.draftPick.length + ' / 3 elegidos';
    this.draftGo.disabled = this.draftPick.length !== 3;
  };

  OrlogUI.prototype._startMatchFromDraft = function () {
    var humanGods = this.draftPick.slice();
    var aiGods = window.OrlogAI.pickGods(this.difficulty);
    this.lastConfig = { humanGods: humanGods, aiGods: aiGods };
    this.startMatch();
  };

  OrlogUI.prototype.startMatch = function () {
    var cfg = this.lastConfig;
    this.engine = new window.OrlogEngine({
      names: ['Tú', this.aiName],
      gods: [cfg.humanGods.slice(), cfg.aiGods.slice()]
    });
    this.mirror = { health: [15, 15], tokens: [0, 0] };
    this.stats = { dmg: [0, 0], rounds: 1 };
    this.buildBoard();
    this.showScreen('board');
    var names = cfg.aiGods.map(function (id) { return this.GODS.get(id).god; }, this).join(', ');
    this.log('El ' + this.aiName + ' se encomienda a: ' + names + '.');
    this.runGame();
  };

  // ---- Tablero ----

  OrlogUI.prototype.buildBoard = function () {
    var self = this;
    var st = this.engine.getState();
    var s = this.screens.board;
    s.innerHTML = '';

    this.diceEls = [Object.create(null), Object.create(null)];
    this.sides = [];

    function mkSide(p) {
      var pl = st.players[p];
      var root = el('div', 'side ' + (p === 0 ? 'side-human' : 'side-ai'));

      var head = el('div', 'side-head');
      head.appendChild(el('span', 'pname', p === 0 ? 'Tú' : self.aiName));
      var tokenWrap = el('span', 'token-wrap',
        '<span class="token-coin"></span><span class="token-count">0</span>');
      head.appendChild(tokenWrap);

      var stones = el('div', 'stones');
      for (var i = 0; i < 15; i++) stones.appendChild(el('span', 'stone alive'));

      var godRow = el('div', 'god-row');
      var godCards = {};
      pl.gods.forEach(function (gid) {
        var g = self.GODS.get(gid);
        var c = el('div', 'godcard-mini');
        c.style.setProperty('--god-color', g.color);
        c.innerHTML = '<span class="gm-rune">' + g.rune + '</span>' +
          '<span class="gm-name">' + g.god + '</span>';
        c.title = g.name + ' — ' + g.desc;
        godCards[gid] = c;
        godRow.appendChild(c);
      });
      var armed = el('span', 'armed-badge', 'ᚠ');
      armed.title = 'Favor armado en secreto';
      godRow.appendChild(armed);

      var tray = el('div', 'dice-tray');
      var locked = el('div', 'dice-row dice-locked');
      var active = el('div', 'dice-row dice-active');
      tray.appendChild(locked);
      tray.appendChild(active);

      root.appendChild(head);
      root.appendChild(stones);
      root.appendChild(godRow);
      root.appendChild(tray);

      return {
        root: root,
        tokenEl: tokenWrap,
        tokenCount: tokenWrap.querySelector('.token-count'),
        stonesEl: stones,
        stones: Array.prototype.slice.call(stones.children),
        godCards: godCards,
        armed: armed,
        locked: locked,
        active: active,
        tray: tray
      };
    }

    var aiSide = mkSide(1);
    var humanSide = mkSide(0);
    this.sides = [humanSide, aiSide];

    var center = el('div', 'board-center');
    this.roundEl = el('div', 'round-ind', 'Ronda 1');
    this.bannerEl = el('div', 'phase-banner');
    this.actionsEl = el('div', 'actions');
    this.logEl = el('div', 'battle-log');
    center.appendChild(this.roundEl);
    center.appendChild(this.bannerEl);
    center.appendChild(this.actionsEl);
    center.appendChild(this.logEl);

    s.appendChild(aiSide.root);
    s.appendChild(center);
    s.appendChild(humanSide.root);

    // dados iniciales
    for (var p = 0; p < 2; p++) {
      var dice = st.players[p].dice;
      for (var i = 0; i < dice.length; i++) this.ensureDie(p, dice[i]);
    }
    this.keepSelectable = false;
  };

  OrlogUI.prototype.side = function (p) { return this.sides[p]; };
  OrlogUI.prototype.dieEl = function (p, id) { return this.diceEls[p][id] || null; };
  OrlogUI.prototype.diceOf = function (p) {
    var map = this.diceEls[p], out = [], k;
    for (k in map) out.push(map[k]);
    return out;
  };

  OrlogUI.prototype.ensureDie = function (p, die) {
    var existing = this.dieEl(p, die.id);
    if (existing) return existing;
    var self = this;
    var d = el('div', 'die unrolled');
    d.dataset.id = die.id;
    d.dataset.face = die.face || 'axe';

    var cube = el('div', 'die-cube');
    var names = ['f-front', 'f-back', 'f-right', 'f-left', 'f-top', 'f-bottom'];
    for (var i = 0; i < 6; i++) cube.appendChild(el('div', 'die-face ' + names[i]));
    d.appendChild(cube);

    var rim = el('div', 'gold-rim',
      '<svg viewBox="0 0 100 100" preserveAspectRatio="none">' +
      '<rect x="3" y="3" width="94" height="94" rx="12" pathLength="100"/></svg>');
    d.appendChild(rim);
    d.appendChild(el('span', 'die-lock', ICONS.lock));
    d.appendChild(el('span', 'die-ban', 'ᛚ'));

    this.setDieFaces(d, die.face || 'axe', false);

    if (p === 0) {
      d.setAttribute('role', 'button');
      d.tabIndex = 0;
      d.addEventListener('click', function () { self._onDieClick(die.id); });
      d.addEventListener('keydown', function (evk) {
        if (evk.key === 'Enter' || evk.key === ' ') {
          evk.preventDefault();
          self._onDieClick(die.id);
        }
      });
    }
    this.side(p).active.appendChild(d);
    this.diceEls[p][die.id] = d;
    return d;
  };

  OrlogUI.prototype.setDieFaces = function (dieEl, face, gold) {
    var faces = dieEl.querySelectorAll('.die-face');
    // la cara frontal es el resultado; el resto, el ciclo real del dado
    var pool = FACE_CYCLE.slice();
    var ix = pool.indexOf(face);
    if (ix >= 0) pool.splice(ix, 1);
    faces[0].innerHTML = ICONS[face] || '';
    faces[0].classList.toggle('gold-face', !!gold);
    for (var i = 1; i < 6; i++) {
      faces[i].innerHTML = ICONS[pool[(i - 1) % pool.length]] || '';
      faces[i].classList.remove('gold-face');
    }
    dieEl.dataset.face = face;
    dieEl.setAttribute('aria-label',
      'Dado: ' + (FACE_NAMES[face] || face) + (gold ? ' dorado' : ''));
  };

  OrlogUI.prototype._onDieClick = function (dieId) {
    if (!this.keepSelectable || !this.engine) return;
    try {
      this.engine.toggleKeep(dieId);
    } catch (e) { return; } // dado no togglable (p. ej. kept de tiradas previas)
    var st = this.engine.getState();
    var die = null;
    st.players[0].dice.forEach(function (d) { if (d.id === dieId) die = d; });
    var elDie = this.dieEl(0, dieId);
    if (elDie && die) {
      elDie.classList.toggle('pre-kept', !!die.kept);
      this.sound.play('tick');
    }
  };

  // FLIP: mueve un nodo a otro contenedor con transición suave
  OrlogUI.prototype.flipMove = function (node, newParent) {
    if (node.parentNode === newParent) return;
    if (REDUCED) { newParent.appendChild(node); return; }
    var first = node.getBoundingClientRect();
    newParent.appendChild(node);
    var last = node.getBoundingClientRect();
    var dx = first.left - last.left, dy = first.top - last.top;
    if (!dx && !dy) return;
    node.style.transition = 'none';
    node.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    requestAnimationFrame(function () {
      node.style.transition = 'transform .35s cubic-bezier(.2,.8,.25,1)';
      node.style.transform = '';
      setTimeout(function () { node.style.transition = ''; }, 420);
    });
  };

  OrlogUI.prototype.syncDice = function (p, stOpt) {
    var st = stOpt || this.engine.getState();
    var side = this.side(p);
    var seen = {};
    var self = this;
    st.players[p].dice.forEach(function (die) {
      seen[die.id] = true;
      var d = self.ensureDie(p, die);
      d.classList.remove('pre-kept');
      d.classList.toggle('kept', !!die.kept);
      d.classList.toggle('banned', !!die.banned);
      d.classList.toggle('gold', !!die.gold && !d.classList.contains('unrolled'));
      var target = die.kept ? side.locked : side.active;
      self.flipMove(d, target);
    });
    // dados que ya no existen (extra de Freyja al limpiar ronda)
    var k;
    for (k in this.diceEls[p]) {
      if (!seen[k]) {
        var gone = this.diceEls[p][k];
        if (gone.parentNode) gone.parentNode.removeChild(gone);
        delete this.diceEls[p][k];
      }
    }
  };

  OrlogUI.prototype.animateDieRoll = function (dieEl, face, gold) {
    this.setDieFaces(dieEl, face, gold);
    dieEl.classList.remove('unrolled', 'landed', 'gold');
    var cube = dieEl.querySelector('.die-cube');
    var dur = REDUCED ? 60 : (700 + Math.random() * 350);
    var sx = (Math.random() < 0.5 ? -1 : 1) * (420 + Math.random() * 480);
    var sy = (Math.random() < 0.5 ? -1 : 1) * (380 + Math.random() * 460);
    var sz = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 200);
    cube.style.setProperty('--rx', sx + 'deg');
    cube.style.setProperty('--ry', sy + 'deg');
    cube.style.setProperty('--rz', sz + 'deg');
    cube.style.setProperty('--roll-dur', dur + 'ms');
    cube.classList.remove('rolling');
    void cube.offsetWidth; // reinicia la animación
    cube.classList.add('rolling');
    return dur;
  };

  OrlogUI.prototype.animateRollBatch = function (p) {
    var self = this;
    var st = this.engine.getState();
    var rolled = st.players[p].dice.filter(function (d) { return d.justRolled; });
    if (!rolled.length) return Promise.resolve();
    this.sound.play('dice');
    var maxDur = 0;
    rolled.forEach(function (d) {
      var elDie = self.ensureDie(p, d);
      var dur = self.animateDieRoll(elDie, d.face, d.gold);
      if (dur > maxDur) maxDur = dur;
    });
    return wait(maxDur + 80).then(function () {
      rolled.forEach(function (d) {
        var e = self.dieEl(p, d.id);
        if (e) {
          e.classList.add('landed');
          e.classList.toggle('gold', !!d.gold);
        }
      });
    });
  };

  // ---- Piedras de vida / tokens ----

  OrlogUI.prototype.breakStone = function (p) {
    var stones = this.side(p).stones;
    for (var i = stones.length - 1; i >= 0; i--) {
      if (stones[i].classList.contains('alive')) {
        var s = stones[i];
        s.classList.remove('alive', 'healing');
        s.classList.add('breaking');
        setTimeout(function () { s.classList.remove('breaking'); s.classList.add('broken'); },
          this.ms(300));
        if (this.mirror.health[p] > 0) this.mirror.health[p]--;
        return true;
      }
    }
    return false;
  };

  OrlogUI.prototype.restoreStone = function (p) {
    var stones = this.side(p).stones;
    for (var i = 0; i < stones.length; i++) {
      if (!stones[i].classList.contains('alive')) {
        stones[i].classList.remove('broken', 'breaking');
        stones[i].classList.add('alive', 'healing');
        var s = stones[i];
        setTimeout(function () { s.classList.remove('healing'); }, this.ms(700));
        if (this.mirror.health[p] < 15) this.mirror.health[p]++;
        return true;
      }
    }
    return false;
  };

  OrlogUI.prototype.setHealth = function (p, hp) {
    hp = clamp(hp, 0, 15);
    this.mirror.health[p] = hp;
    var stones = this.side(p).stones;
    for (var i = 0; i < stones.length; i++) {
      stones[i].classList.remove('breaking', 'healing');
      stones[i].classList.toggle('alive', i < hp);
      stones[i].classList.toggle('broken', i >= hp);
    }
  };

  OrlogUI.prototype.setTokens = function (p, n) {
    this.mirror.tokens[p] = Math.max(0, n);
    this.side(p).tokenCount.textContent = this.mirror.tokens[p];
  };

  OrlogUI.prototype.addTokens = function (p, delta) {
    var wrap = this.side(p).tokenEl;
    this.setTokens(p, this.mirror.tokens[p] + delta);
    wrap.classList.remove('bump', 'drain');
    void wrap.offsetWidth;
    wrap.classList.add(delta >= 0 ? 'bump' : 'drain');
  };

  // ---- Monedas volando (FLIP con clon) ----

  OrlogUI.prototype.flyCoin = function (fromEl, toEl) {
    var self = this;
    return new Promise(function (res) {
      var a = fromEl.getBoundingClientRect();
      var b = toEl.getBoundingClientRect();
      var c = el('div', 'fly-coin');
      c.style.left = (a.left + a.width / 2 - 8) + 'px';
      c.style.top = (a.top + a.height / 2 - 8) + 'px';
      document.body.appendChild(c);
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          c.style.transform = 'translate(' +
            (b.left + b.width / 2 - (a.left + a.width / 2)) + 'px,' +
            (b.top + b.height / 2 - (a.top + a.height / 2)) + 'px) scale(.5)';
          c.style.opacity = '0.2';
        });
      });
      setTimeout(function () { c.remove(); res(); }, self.ms(650));
    });
  };

  OrlogUI.prototype.flyCoins = function (fromEls, toEl, n) {
    var self = this;
    if (!fromEls.length) fromEls = [toEl];
    var chain = Promise.resolve();
    var jobs = [];
    for (var i = 0; i < n; i++) {
      (function (i) {
        chain = chain.then(function () {
          jobs.push(self.flyCoin(fromEls[i % fromEls.length], toEl));
          return wait(self.ms(80));
        });
      })(i);
    }
    return chain.then(function () { return Promise.all(jobs); });
  };

  // ---- Mensajería visual ----

  OrlogUI.prototype.setBanner = function (html) {
    this.bannerEl.classList.remove('banner-in');
    void this.bannerEl.offsetWidth;
    this.bannerEl.innerHTML = html;
    this.bannerEl.classList.add('banner-in');
  };

  OrlogUI.prototype.log = function (text) {
    var line = el('div', 'log-line', text);
    this.logEl.insertBefore(line, this.logEl.firstChild);
    while (this.logEl.children.length > 3) {
      this.logEl.removeChild(this.logEl.lastChild);
    }
  };

  OrlogUI.prototype.toast = function (text, kind) {
    var self = this;
    var t = el('div', 'toast ' + (kind || ''));
    t.textContent = text;
    document.body.appendChild(t);
    return wait(this.ms(1150)).then(function () {
      t.classList.add('out');
      return wait(self.ms(260));
    }).then(function () { t.remove(); });
  };

  OrlogUI.prototype.floatNote = function (p, html, color) {
    var side = this.side(p);
    var n = el('div', 'float-note', html);
    if (color) n.style.setProperty('--note-color', color);
    side.tray.appendChild(n);
    setTimeout(function () { n.remove(); }, this.ms(1500));
  };

  OrlogUI.prototype.ghostDice = function (p, face, n) {
    var side = this.side(p);
    var g = el('div', 'ghost-dice');
    for (var i = 0; i < Math.min(n, 6); i++) {
      g.appendChild(el('span', 'ghost-die', ICONS[face] || ''));
    }
    side.tray.appendChild(g);
    setTimeout(function () { g.remove(); }, this.ms(1700));
  };

  OrlogUI.prototype.flashSide = function (p, kind) {
    var root = this.side(p).root;
    var cls = 'flash-' + kind;
    root.classList.remove(cls);
    void root.offsetWidth;
    root.classList.add(cls);
    setTimeout(function () { root.classList.remove(cls); }, this.ms(700));
  };

  OrlogUI.prototype.flashVignette = function () {
    var v = this.vignetteEl;
    v.classList.remove('on');
    void v.offsetWidth;
    v.classList.add('on');
    setTimeout(function () { v.classList.remove('on'); }, this.ms(500));
  };

  OrlogUI.prototype.shakeSide = function (p) {
    var root = this.side(p).root;
    root.classList.remove('shake');
    void root.offsetWidth;
    root.classList.add('shake');
    setTimeout(function () { root.classList.remove('shake'); }, this.ms(600));
  };

  OrlogUI.prototype.markArmed = function (p, on) {
    this.side(p).armed.style.display = on ? '' : 'none';
  };

  OrlogUI.prototype.revealArmed = function (p, godId) {
    this.markArmed(p, false);
    var card = this.side(p).godCards[godId];
    if (card) card.classList.add('invoked');
  };

  OrlogUI.prototype.clearInvoked = function () {
    for (var p = 0; p < 2; p++) {
      var cards = this.side(p).godCards, k;
      for (k in cards) cards[k].classList.remove('invoked');
      this.markArmed(p, false);
    }
  };

  OrlogUI.prototype.godName = function (id) {
    var g = this.GODS.get(id);
    return g ? g.name : id;
  };

  OrlogUI.prototype.showInvokeBanner = function (god, level, p) {
    var self = this;
    var o = el('div', 'invoke-banner');
    o.style.setProperty('--god-color', god.color);
    o.innerHTML =
      '<div class="invoke-flash"></div>' +
      '<div class="invoke-rune">' + god.rune + '</div>' +
      '<div class="invoke-name">' + god.name + '</div>' +
      '<div class="invoke-level">Nivel ' + ROMAN[(level || 1) - 1] + ' · ' +
      (p === 0 ? 'tu invocación' : this.aiName) + '</div>';
    document.body.appendChild(o);
    this.sound.play('invoke');
    return wait(this.ms(1200)).then(function () {
      o.classList.add('out');
      return wait(self.ms(280));
    }).then(function () { o.remove(); });
  };

  // ---- Acciones (botones del centro) ----

  OrlogUI.prototype.waitAction = function (defs) {
    var self = this;
    return new Promise(function (res) {
      self.actionsEl.innerHTML = '';
      defs.forEach(function (d) {
        var b = el('button', 'btn ' + (d.cls || ''), d.label);
        b.addEventListener('click', function () {
          self.sound.play('click');
          self.actionsEl.innerHTML = '';
          res(d.id);
        });
        self.actionsEl.appendChild(b);
      });
    });
  };

  // ---- Bucle de juego ----

  OrlogUI.prototype.runGame = function () {
    var self = this;
    var tok = ++this.gameToken;

    function step() {
      if (tok !== self.gameToken) return Promise.resolve();
      var st = self.engine.getState();
      self.roundEl.textContent = 'Ronda ' + st.round;
      self.stats.rounds = st.round;

      var next;
      if (st.phase === 'roll') {
        next = (st.activePlayer === 0) ? self.humanRollTurn() : self.aiRollTurn();
      } else if (st.phase === 'favor') {
        next = self.playFavorPhase();
      } else if (st.phase === 'resolution') {
        return self.playResolution().then(function (over) {
          if (over || tok !== self.gameToken) return;
          return step();
        });
      } else if (st.phase === 'gameover') {
        self.showEndScreen(st.winner);
        return Promise.resolve();
      } else {
        return Promise.reject(new Error('Fase desconocida: ' + st.phase));
      }
      return next.then(step);
    }

    step().catch(function (err) {
      console.error('ORLOG:', err);
      self.log('⚠ ' + (err && err.message ? err.message : err));
    });
  };

  OrlogUI.prototype.humanRollTurn = function () {
    var self = this;
    var st = this.engine.getState();
    this.setBanner('Ronda ' + st.round + ' · Tirada ' + st.rollNum +
      '/3 · <b>Te toca</b> — lanza los dados');
    return this.waitAction([{ id: 'roll', label: 'Tirar los dados', cls: 'btn-primary' }])
      .then(function () {
        self.engine.roll();
        return self.animateRollBatch(0);
      })
      .then(function () {
        var st2 = self.engine.getState();
        var last = st2.rollNum >= 3;
        self.setBanner('Ronda ' + st2.round + ' · Tirada ' + st2.rollNum +
          '/3 · <b>Te toca</b> — ' +
          (last ? 'última tirada: todo queda bloqueado' : 'elige qué dados te quedas'));
        self.keepSelectable = true;
        var opts = [{ id: 'keep', label: last ? 'Continuar' : 'Quedarse estos', cls: 'btn-primary' }];
        if (!last) opts.push({ id: 'all', label: 'Quedárselo todo' });
        return self.waitAction(opts);
      })
      .then(function (choice) {
        self.keepSelectable = false;
        if (choice === 'all') self.engine.keepAll();
        else self.engine.endTurn();
        self.syncDice(0);
        return wait(self.ms(380));
      });
  };

  OrlogUI.prototype.aiRollTurn = function () {
    var self = this;
    var st = this.engine.getState();
    this.setBanner('Ronda ' + st.round + ' · Tirada ' + st.rollNum + '/3 · <b>' +
      this.aiName + '</b> lanza sus dados…');
    return wait(this.ms(600))
      .then(function () {
        self.engine.roll();
        return self.animateRollBatch(1);
      })
      .then(function () { return wait(self.ms(550)); })
      .then(function () {
        var dec = null;
        try {
          dec = window.OrlogAI.decideKeeps(self.engine.getState(), self.difficulty);
        } catch (e) { console.error('ORLOG IA decideKeeps:', e); }
        var keeps = (dec && dec.keep) ? dec.keep.slice() : [];
        var chain = Promise.resolve();
        keeps.forEach(function (id) {
          chain = chain.then(function () {
            try { self.engine.toggleKeep(id); } catch (e) { return; }
            var d = self.dieEl(1, id);
            if (d) d.classList.add('pre-kept');
            self.sound.play('tick');
            return wait(self.ms(260));
          });
        });
        return chain.then(function () {
          return wait(self.ms(350)).then(function () {
            if (dec && dec.stopRolling) self.engine.keepAll();
            else self.engine.endTurn();
            self.syncDice(1);
            if (keeps.length) {
              self.log('El ' + self.aiName + ' se queda ' + keeps.length +
                (keeps.length === 1 ? ' dado.' : ' dados.'));
            }
            return wait(self.ms(400));
          });
        });
      });
  };

  OrlogUI.prototype.playFavorPhase = function () {
    var self = this;
    var st = this.engine.getState();
    this.setBanner('Ronda ' + st.round + ' · <b>Favor de los dioses</b> — elige tu ofrenda');

    // La IA decide primero, en secreto
    var aiFav = null;
    try {
      aiFav = window.OrlogAI.decideFavor(st, this.difficulty, 1);
    } catch (e) { console.error('ORLOG IA decideFavor:', e); }

    return wait(this.ms(600)).then(function () {
      try {
        if (aiFav && aiFav.godId) {
          self.engine.selectFavor(1, aiFav.godId, aiFav.level || 1);
          self.markArmed(1, true);
          self.log('El ' + self.aiName + ' ha sellado un favor en secreto.');
        } else {
          self.engine.selectFavor(1, null, 1);
          self.log('El ' + self.aiName + ' no invoca a los dioses.');
        }
      } catch (e) {
        // si la IA eligió algo impagable, pasa
        try { self.engine.selectFavor(1, null, 1); } catch (e2) { }
        self.log('El ' + self.aiName + ' no invoca a los dioses.');
      }
      return self.openFavorPanel();
    }).then(function (pick) {
      if (pick) {
        self.engine.selectFavor(0, pick.godId, pick.level);
        self.markArmed(0, true);
        self.log('Tu favor queda armado, boca abajo.');
      } else {
        self.engine.selectFavor(0, null, 1);
        self.log('No invocas a los dioses esta ronda.');
      }
      return wait(self.ms(400));
    });
  };

  OrlogUI.prototype.openFavorPanel = function () {
    var self = this;
    return new Promise(function (res) {
      var st = self.engine.getState();
      var tokens = st.players[0].tokens;

      var ov = el('div', 'overlay favor-overlay');
      var panel = el('div', 'favor-panel');
      panel.appendChild(el('h3', 'favor-head', 'Invoca el favor de un dios'));
      panel.appendChild(el('p', 'favor-tokens',
        'Favor disponible: <span class="cost">✦' + tokens + '</span>'));

      var row = el('div', 'favor-row');
      st.players[0].gods.forEach(function (gid) {
        var g = self.GODS.get(gid);
        var card = el('div', 'favor-card');
        card.style.setProperty('--god-color', g.color);
        card.innerHTML =
          '<span class="g-rune">' + g.rune + '</span>' +
          '<span class="g-title">' + g.name + '</span>' +
          '<span class="g-desc">' + g.desc + '</span>';
        var lvls = el('div', 'favor-levels');
        g.levels.forEach(function (lv, i) {
          var afford = tokens >= lv.cost;
          var b = el('button', 'favor-lvl' + (afford ? '' : ' locked'),
            '<span class="fl-name">Nivel ' + ROMAN[i] + '</span>' +
            '<span class="cost">✦' + lv.cost + '</span>' +
            '<span class="fl-desc">' + g.levelDesc(lv.value) + '</span>');
          if (afford) {
            b.addEventListener('click', function () {
              self.sound.play('click');
              ov.remove();
              res({ godId: gid, level: i + 1 });
            });
          } else {
            b.disabled = true;
          }
          lvls.appendChild(b);
        });
        card.appendChild(lvls);
        row.appendChild(card);
      });
      panel.appendChild(row);

      var pass = el('button', 'btn btn-ghost', 'No invocar');
      pass.addEventListener('click', function () {
        self.sound.play('click');
        ov.remove();
        res(null);
      });
      panel.appendChild(pass);
      ov.appendChild(panel);
      document.body.appendChild(ov);
    });
  };

  OrlogUI.prototype.openOdinDialog = function (max) {
    var self = this;
    return new Promise(function (res) {
      var ov = el('div', 'overlay odin-overlay');
      var box = el('div', 'odin-box');
      box.innerHTML =
        '<div class="invoke-rune small">ᚬ</div>' +
        '<h3>Sacrificio de Odín</h3>' +
        '<p>¿Cuánta vida ofreces al Padre de Todo?</p>';
      var stepper = el('div', 'stepper');
      var minus = el('button', 'btn step-btn', '−');
      var val = el('span', 'step-val', '0');
      var plus = el('button', 'btn step-btn', '+');
      var n = 0;
      function paint() { val.textContent = n; }
      minus.addEventListener('click', function () { n = Math.max(0, n - 1); paint(); self.sound.play('tick'); });
      plus.addEventListener('click', function () { n = Math.min(max, n + 1); paint(); self.sound.play('tick'); });
      stepper.appendChild(minus); stepper.appendChild(val); stepper.appendChild(plus);
      box.appendChild(stepper);
      box.appendChild(el('p', 'odin-hint', 'Máximo: ' + max + ' (nunca hasta la muerte)'));
      var ok = el('button', 'btn btn-primary', 'Ofrecer sangre');
      ok.addEventListener('click', function () {
        self.sound.play('click');
        ov.remove();
        res(n);
      });
      box.appendChild(ok);
      ov.appendChild(box);
      document.body.appendChild(ov);
    });
  };

  // ---- Resolución ----

  OrlogUI.prototype.playResolution = function () {
    var self = this;
    var st = this.engine.getState();
    this.setBanner('Ronda ' + st.round + ' · <b>Resolución</b> — los dioses juzgan');
    this.syncDice(0, st);
    this.syncDice(1, st);

    var pre;
    var np = null;
    try { np = this.engine.needsOdinPrompt(); } catch (e) { }
    var sac = {};
    if (np && np.player === 0) {
      pre = this.openOdinDialog(np.maxSacrifice).then(function (n) { sac[0] = n; });
    } else if (np && np.player === 1) {
      try {
        sac[1] = window.OrlogAI.decideOdinSacrifice(this.engine.getState(), 1);
      } catch (e) { sac[1] = 0; }
      pre = Promise.resolve();
    } else {
      pre = Promise.resolve();
    }

    return pre.then(function () {
      var report = self.engine.resolve({ odinSacrifice: sac });
      var events = (report && report.events) ? report.events : [];
      var over = false, winner = null;
      var chain = Promise.resolve();
      events.forEach(function (ev) {
        chain = chain.then(function () {
          if (ev.type === 'gameOver') { over = true; winner = ev.winner; }
          return self.playEvent(ev);
        });
      });
      return chain.then(function () {
        if (over) {
          return wait(self.ms(700)).then(function () {
            self.showEndScreen(winner);
            return true;
          });
        }
        self.engine.nextRound();
        self.newRoundCleanup();
        return false;
      });
    });
  };

  OrlogUI.prototype.newRoundCleanup = function () {
    var st = this.engine.getState();
    this.clearInvoked();
    this.syncDice(0, st);
    this.syncDice(1, st);
    for (var p = 0; p < 2; p++) {
      this.setHealth(p, st.players[p].health);
      this.setTokens(p, st.players[p].tokens);
      this.diceOf(p).forEach(function (d) {
        d.classList.remove('banned', 'neutralized', 'pre-kept');
      });
    }
    this.roundEl.textContent = 'Ronda ' + st.round;
    this.log('— Ronda ' + st.round + ' —');
  };

  OrlogUI.prototype.playEvent = function (ev) {
    var self = this;
    var GODS = this.GODS;

    switch (ev.type) {

      case 'goldTokens': {
        if (!ev.amount) return Promise.resolve();
        var els = (ev.diceIds || [])
          .map(function (id) { return self.dieEl(ev.player, id); })
          .filter(Boolean);
        els.forEach(function (e) { e.classList.add('gold-burst'); });
        this.sound.play('coin');
        var target = this.side(ev.player).tokenEl;
        return this.flyCoins(els.length ? els : [target], target, Math.min(ev.amount, 6))
          .then(function () {
            self.addTokens(ev.player, ev.amount);
            self.log(ev.player === 0
              ? 'Ganas ' + ev.amount + ' de favor por tus caras doradas.'
              : 'El ' + self.aiName + ' gana ' + ev.amount + ' de favor dorado.');
            els.forEach(function (e) { e.classList.remove('gold-burst'); });
            return wait(self.ms(250));
          });
      }

      case 'favorInvoked': {
        var god = GODS.get(ev.godId);
        this.revealArmed(ev.player, ev.godId);
        return this.showInvokeBanner(god, ev.level, ev.player).then(function () {
          self.log((ev.player === 0 ? 'Invocas ' : 'El ' + self.aiName + ' invoca ') +
            god.name + ' (nivel ' + ROMAN[(ev.level || 1) - 1] + ').');
        });
      }

      case 'favorFailed': {
        var godF = GODS.get(ev.godId);
        this.revealArmed(ev.player, ev.godId);
        this.sound.play('fail');
        var why = ev.reason === 'cancelled'
          ? 'cancelado por Thrymr'
          : 'favor insuficiente';
        return this.toast(
          (ev.player === 0 ? 'Tu favor ' : 'El favor rival ') +
          (godF ? '(' + godF.name + ') ' : '') + 'falla: ' + why, 'fail');
      }

      case 'favorEffect':
        return this.playFavorEffect(ev);

      case 'steal': {
        if (!ev.amount) return Promise.resolve();
        var thief = ev.player, victim = 1 - ev.player;
        this.sound.play('coin');
        return this.flyCoins([this.side(victim).tokenEl], this.side(thief).tokenEl,
          Math.min(ev.amount, 5))
          .then(function () {
            self.addTokens(victim, -ev.amount);
            self.addTokens(thief, ev.amount);
            self.log(thief === 0
              ? 'Tus manos roban ' + ev.amount + ' de favor.'
              : 'El ' + self.aiName + ' te roba ' + ev.amount + ' de favor.');
            return wait(self.ms(250));
          });
      }

      case 'damage':
        return this.playDamage(ev);

      case 'heal': {
        if (!ev.amount) return Promise.resolve();
        return this.playHeal(ev.player, ev.amount, ev.source || null);
      }

      case 'tokens': {
        if (!ev.amount) return Promise.resolve();
        var p2 = ev.player;
        var srcName = (ev.source && ev.source !== 'steal') ? this.godName(ev.source) : null;
        if (ev.amount > 0) {
          this.sound.play('coin');
          var from = (ev.source && this.side(p2).godCards[ev.source]) || this.side(p2).tokenEl;
          return this.flyCoins([from], this.side(p2).tokenEl, Math.min(ev.amount, 5))
            .then(function () {
              self.addTokens(p2, ev.amount);
              self.log((p2 === 0 ? 'Ganas ' : 'El ' + self.aiName + ' gana ') +
                ev.amount + ' de favor' + (srcName ? ' (' + srcName + ')' : '') + '.');
              return wait(self.ms(250));
            });
        }
        this.addTokens(p2, ev.amount);
        this.log((p2 === 0 ? 'Pierdes ' : 'El ' + this.aiName + ' pierde ') +
          (-ev.amount) + ' de favor' + (srcName ? ' (' + srcName + ')' : '') + '.');
        return wait(this.ms(450));
      }

      case 'death': {
        var sideD = this.side(ev.player);
        sideD.root.classList.add('dead');
        this.sound.play('gong');
        while (this.mirror.health[ev.player] > 0 && this.breakStone(ev.player)) { /* rompe todo */ }
        this.setHealth(ev.player, 0);
        this.log(ev.player === 0
          ? 'Caes. Los cuervos descienden.'
          : 'El ' + this.aiName + ' cae. Los cuervos descienden.');
        return wait(self.ms(900));
      }

      case 'roundEnd': {
        var sum = ev.summary || {};
        if (sum.healths) {
          this.setHealth(0, sum.healths[0]);
          this.setHealth(1, sum.healths[1]);
        }
        if (sum.tokens) {
          this.setTokens(0, sum.tokens[0]);
          this.setTokens(1, sum.tokens[1]);
        }
        this.log('La ronda termina. Los dioses observan.');
        return wait(this.ms(650));
      }

      case 'gameOver':
        return wait(this.ms(300));

      default:
        console.warn('ORLOG: evento desconocido', ev);
        return wait(this.ms(200));
    }
  };

  OrlogUI.prototype.playHeal = function (p, amount, sourceGod) {
    var self = this;
    this.sound.play('heal');
    this.flashSide(p, 'heal');
    var chain = Promise.resolve();
    var healed = 0;
    for (var i = 0; i < amount; i++) {
      chain = chain.then(function () {
        if (self.restoreStone(p)) healed++;
        return wait(self.ms(130));
      });
    }
    return chain.then(function () {
      var src = sourceGod ? ' (' + self.godName(sourceGod) + ')' : '';
      self.log((p === 0 ? 'Recuperas ' : 'El ' + self.aiName + ' recupera ') +
        amount + ' de vida' + src + '.');
      return wait(self.ms(300));
    });
  };

  OrlogUI.prototype.playDamage = function (ev) {
    var self = this;
    var p = ev.player, atk = 1 - p;
    var bd = ev.breakdown || {};

    if (!ev.amount) {
      this.sound.play('block');
      this.flashSide(p, 'block');
      this.log(p === 0
        ? 'Bloqueas todo el ataque.'
        : 'El ' + this.aiName + ' bloquea todo el ataque.');
      return wait(this.ms(650));
    }

    var attackers = this.diceOf(atk).filter(function (e) {
      var f = e.dataset.face;
      return (f === 'axe' || f === 'arrow') &&
        !e.classList.contains('banned') && !e.classList.contains('neutralized');
    });
    var dir = atk === 1 ? 'lunge-down' : 'lunge-up';
    attackers.forEach(function (e) { e.classList.add(dir); });

    return wait(this.ms(230)).then(function () {
      self.sound.play('thud');
      self.shakeSide(p);
      if (p === 0) self.flashVignette();
      else self.flashSide(1, 'hit');

      self.stats.dmg[p] += ev.amount;
      var step = clamp(Math.floor(self.ms(700) / ev.amount), 60, 170);
      var chain = Promise.resolve();
      for (var i = 0; i < ev.amount; i++) {
        chain = chain.then(function () {
          self.breakStone(p);
          self.sound.play('crack');
          return wait(step);
        });
      }
      return chain;
    }).then(function () {
      var bits = [];
      if (ev.blocked) bits.push(ev.blocked + ' bloqueado');
      if (bd.pierced) bits.push(bd.pierced + (bd.pierced === 1 ? ' flecha perfora' : ' flechas perforan') + ' escudos');
      var extra = bits.length ? ' (' + bits.join(', ') + ')' : '';
      self.log((p === 0 ? 'Sufres ' : 'El ' + self.aiName + ' sufre ') +
        ev.amount + ' de daño' + extra + '.');
      attackers.forEach(function (e) { e.classList.remove(dir); });
      return wait(self.ms(380));
    });
  };

  OrlogUI.prototype.playFavorEffect = function (ev) {
    var self = this;
    var god = this.GODS.get(ev.godId);
    var d = ev.detail || {};
    var p = ev.player, foe = 1 - p;
    var chain = Promise.resolve();

    if (d.banned && d.banned.length) {
      chain = chain.then(function () {
        self.sound.play('ban');
        d.banned.forEach(function (id) {
          var e = self.dieEl(foe, id);
          if (e) e.classList.add('banned');
        });
        self.log(self.godName(ev.godId) + ' anula ' + d.banned.length +
          (d.banned.length === 1 ? ' dado' : ' dados') +
          (p === 0 ? ' rivales.' : ' tuyos.'));
        return wait(self.ms(750));
      });
    }

    if (d.rerolled && d.rerolled.length) {
      chain = chain.then(function () {
        self.sound.play('dice');
        var maxDur = 0;
        d.rerolled.forEach(function (r) {
          var e = self.dieEl(foe, r.id);
          if (!e) return;
          e.classList.remove('gold', 'landed');
          var dur = self.animateDieRoll(e, r.to, r.gold);
          if (dur > maxDur) maxDur = dur;
        });
        return wait(maxDur + 80).then(function () {
          d.rerolled.forEach(function (r) {
            var e = self.dieEl(foe, r.id);
            if (e) {
              e.classList.add('landed');
              e.classList.toggle('gold', !!r.gold);
            }
          });
          self.log(self.godName(ev.godId) + ' vuelve a tirar ' + d.rerolled.length +
            (d.rerolled.length === 1 ? ' dado.' : ' dados.'));
          return wait(self.ms(350));
        });
      });
    }

    if (d.extraDice && d.extraDice.length) {
      chain = chain.then(function () {
        self.sound.play('dice');
        var maxDur = 0;
        d.extraDice.forEach(function (x) {
          var die = self.ensureDie(p, { id: x.id, face: x.face });
          die.classList.add('kept', 'spawn');
          self.flipMove(die, self.side(p).locked);
          var dur = self.animateDieRoll(die, x.face, x.gold);
          if (dur > maxDur) maxDur = dur;
        });
        return wait(maxDur + 80).then(function () {
          d.extraDice.forEach(function (x) {
            var e = self.dieEl(p, x.id);
            if (e) {
              e.classList.add('landed');
              e.classList.toggle('gold', !!x.gold);
            }
          });
          self.log(self.godName(ev.godId) + ' concede ' + d.extraDice.length +
            (d.extraDice.length === 1 ? ' dado extra.' : ' dados extra.'));
          return wait(self.ms(350));
        });
      });
    }

    if (d.removedHelmets) {
      chain = chain.then(function () {
        var n = d.removedHelmets;
        var helms = self.diceOf(foe).filter(function (e) {
          return e.dataset.face === 'helmet' &&
            !e.classList.contains('banned') && !e.classList.contains('neutralized');
        });
        for (var i = 0; i < Math.min(n, helms.length); i++) {
          helms[i].classList.add('neutralized');
        }
        self.sound.play('crack');
        self.log(self.godName(ev.godId) + ' destruye ' + n +
          (n === 1 ? ' casco.' : ' cascos.'));
        return wait(self.ms(700));
      });
    }

    if (d.healed) {
      chain = chain.then(function () {
        return self.playHeal(p, d.healed, ev.godId);
      });
    }

    if (d.tokensDestroyed) {
      chain = chain.then(function () {
        self.sound.play('fail');
        self.addTokens(foe, -d.tokensDestroyed);
        self.log(self.godName(ev.godId) + ' destruye ' + d.tokensDestroyed +
          ' de favor ' + (p === 0 ? 'rival.' : 'tuyo.'));
        return wait(self.ms(600));
      });
    }

    if (d.tokensGained) {
      chain = chain.then(function () {
        self.sound.play('coin');
        var from = self.side(p).godCards[ev.godId] || self.side(p).tokenEl;
        return self.flyCoins([from], self.side(p).tokenEl, Math.min(d.tokensGained, 5))
          .then(function () {
            self.addTokens(p, d.tokensGained);
            self.log((p === 0 ? 'Ganas ' : 'El ' + self.aiName + ' gana ') +
              d.tokensGained + ' de favor (' + self.godName(ev.godId) + ').');
            return wait(self.ms(250));
          });
      });
    }

    if (d.multiplied) {
      chain = chain.then(function () {
        self.floatNote(p, 'Hachas ' + d.multiplied.from + ' → ' + d.multiplied.to,
          god ? god.color : null);
        self.ghostDice(p, 'axe', d.multiplied.to - d.multiplied.from);
        self.sound.play('tick');
        self.log(self.godName(ev.godId) + ': hachas ' + d.multiplied.from +
          ' → ' + d.multiplied.to + '.');
        return wait(self.ms(850));
      });
    }

    if (d.added) {
      chain = chain.then(function () {
        var fname = FACE_PLURAL[d.added.face] || d.added.face;
        self.floatNote(p, '+' + d.added.n + ' ' + fname, god ? god.color : null);
        self.ghostDice(p, d.added.face, d.added.n);
        self.sound.play('tick');
        self.log(self.godName(ev.godId) + ' añade +' + d.added.n + ' ' + fname + '.');
        return wait(self.ms(850));
      });
    }

    // detalle desconocido: al menos deja constancia
    var known = ['banned', 'rerolled', 'extraDice', 'removedHelmets', 'healed',
      'tokensDestroyed', 'tokensGained', 'multiplied', 'added'];
    var hasKnown = known.some(function (k) { return d[k] != null; });
    if (!hasKnown) {
      chain = chain.then(function () {
        self.log(self.godName(ev.godId) + ' despliega su poder.');
        return wait(self.ms(500));
      });
    }

    return chain;
  };

  // ---- Final ----

  OrlogUI.prototype.showEndScreen = function (winner) {
    var self = this;
    this.gameToken++; // corta cualquier bucle pendiente
    var s = this.screens.end;
    s.innerHTML = '';

    var word, sub, cls;
    if (winner === 0) {
      word = 'VICTORIA'; cls = 'end-win';
      sub = 'Los escaldos cantarán esta hazaña.';
      this.sound.play('win');
    } else if (winner === 1) {
      word = 'DERROTA'; cls = 'end-lose';
      sub = 'Tus huesos alimentarán a los cuervos.';
      this.sound.play('lose');
    } else {
      word = 'EMPATE'; cls = 'end-draw';
      sub = 'Valhalla os espera a ambos.';
      this.sound.play('gong');
    }

    s.appendChild(el('div', 'end-word ' + cls, word));
    s.appendChild(el('p', 'end-sub', sub));
    s.appendChild(el('div', 'end-summary',
      '<span>Rondas: <b>' + this.stats.rounds + '</b></span>' +
      '<span>Daño infligido: <b>' + this.stats.dmg[1] + '</b></span>' +
      '<span>Daño recibido: <b>' + this.stats.dmg[0] + '</b></span>'));

    var row = el('div', 'end-actions');
    var again = el('button', 'btn btn-primary', 'Revancha');
    again.addEventListener('click', function () {
      self.sound.play('click');
      self.startMatch();
    });
    var menu = el('button', 'btn btn-ghost', 'Menú');
    menu.addEventListener('click', function () {
      self.sound.play('click');
      self.showScreen('title');
    });
    row.appendChild(again);
    row.appendChild(menu);
    s.appendChild(row);

    this.showScreen('end');
  };

  if (typeof window !== 'undefined') window.OrlogUI = OrlogUI;
  if (typeof module !== 'undefined') module.exports = { OrlogUI: OrlogUI };
})();
