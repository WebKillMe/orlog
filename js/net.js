// ORLOG — Capa de red (Supabase Realtime). Sin lógica de juego.
// Modelo: paso sincronizado (lockstep). Solo viajan decisiones, nunca el estado:
// ambos clientes ejecutan el mismo motor con la misma semilla y llegan al mismo sitio.
(function () {
  'use strict';

  var SB_URL = 'https://vknwuevlvnavkgvtguku.supabase.co';
  // Clave pública (anon): está pensada para vivir en el cliente. Las tablas tienen RLS.
  var SB_KEY = 'sb_publishable_f7q0PeemTaEwN9XFotSSEA_kA_rqtz7';
  var SB_CDN = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

  // Alfabeto sin caracteres confundibles (ni O/0, ni I/1/L) para dictar el código por voz.
  var ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

  function codigoSala() {
    var s = '', a = new Uint32Array(6);
    (window.crypto || window.msCrypto).getRandomValues(a);
    for (var i = 0; i < 6; i++) s += ALFABETO[a[i] % ALFABETO.length];
    return s;
  }

  function normalizaCodigo(txt) {
    return String(txt || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6);
  }

  // PRNG con semilla (mulberry32): mismo número → misma partida en ambos clientes.
  function rngConSemilla(semilla) {
    var a = semilla >>> 0;
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function semillaAleatoria() {
    var a = new Uint32Array(1);
    (window.crypto || window.msCrypto).getRandomValues(a);
    return a[0];
  }

  function OrlogNet() {
    this.cliente = null;
    this.canal = null;
    this.sala = null;
    this.soyAnfitrion = false;
    this.handlers = {};
    this._buzon = [];      // mensajes recibidos aún no consumidos
    this._esperas = [];    // { filtro, resolve }
    this.rivalPresente = false;
  }

  OrlogNet.prototype._cargaSDK = function () {
    if (window.__sbCreateClient) return Promise.resolve(window.__sbCreateClient);
    return import(SB_CDN).then(function (mod) {
      window.__sbCreateClient = mod.createClient;
      return mod.createClient;
    });
  };

  // handlers: { onRival(presente), onMensaje(msg), onError(err) }
  OrlogNet.prototype.conectar = function (sala, soyAnfitrion, handlers) {
    var self = this;
    this.sala = sala;
    this.soyAnfitrion = soyAnfitrion;
    this.handlers = handlers || {};
    var rol = soyAnfitrion ? 'anfitrion' : 'invitado';

    return this._cargaSDK().then(function (createClient) {
      self.cliente = createClient(SB_URL, SB_KEY);
      self.canal = self.cliente.channel('orlog:' + sala, {
        config: { presence: { key: rol }, broadcast: { self: false } }
      });

      self.canal.on('broadcast', { event: 'accion' }, function (m) {
        self._recibe(m.payload);
      });

      self.canal.on('presence', { event: 'sync' }, function () {
        var estado = self.canal.presenceState();
        var otro = soyAnfitrion ? 'invitado' : 'anfitrion';
        var presente = !!estado[otro];
        if (presente !== self.rivalPresente) {
          self.rivalPresente = presente;
          if (self.handlers.onRival) self.handlers.onRival(presente);
        }
      });

      return new Promise(function (res, rej) {
        var listo = false;
        var tope = setTimeout(function () {
          if (!listo) rej(new Error('No se pudo conectar con la sala (tiempo agotado)'));
        }, 12000);
        self.canal.subscribe(function (estado) {
          if (estado === 'SUBSCRIBED') {
            listo = true;
            clearTimeout(tope);
            self.canal.track({ rol: rol }).then(function () { res(); }, function () { res(); });
          } else if (estado === 'CHANNEL_ERROR' || estado === 'TIMED_OUT') {
            clearTimeout(tope);
            rej(new Error('Error de conexión con la sala: ' + estado));
          }
        });
      });
    });
  };

  OrlogNet.prototype._recibe = function (msg) {
    if (!msg || !msg.tipo) return;
    // ¿alguien esperaba justo este mensaje?
    for (var i = 0; i < this._esperas.length; i++) {
      if (this._esperas[i].filtro(msg)) {
        var e = this._esperas.splice(i, 1)[0];
        e.resolve(msg);
        return;
      }
    }
    this._buzon.push(msg);
    if (this.handlers.onMensaje) this.handlers.onMensaje(msg);
  };

  OrlogNet.prototype.enviar = function (msg) {
    if (!this.canal) return Promise.reject(new Error('Sin canal'));
    return this.canal.send({ type: 'broadcast', event: 'accion', payload: msg });
  };

  // Espera un mensaje de cierto tipo. Revisa primero lo ya recibido (evita carreras).
  OrlogNet.prototype.espera = function (tipo, msTope) {
    var self = this;
    var filtro = function (m) { return m.tipo === tipo; };
    for (var i = 0; i < this._buzon.length; i++) {
      if (filtro(this._buzon[i])) return Promise.resolve(this._buzon.splice(i, 1)[0]);
    }
    return new Promise(function (res, rej) {
      var reg = { filtro: filtro, resolve: res };
      self._esperas.push(reg);
      if (msTope) {
        setTimeout(function () {
          var ix = self._esperas.indexOf(reg);
          if (ix >= 0) {
            self._esperas.splice(ix, 1);
            rej(new Error('El rival no respondió a tiempo (' + tipo + ')'));
          }
        }, msTope);
      }
    });
  };

  OrlogNet.prototype.salir = function () {
    var self = this;
    this._esperas.length = 0;
    this._buzon.length = 0;
    if (!this.cliente) return Promise.resolve();
    var c = this.cliente;
    this.cliente = null; this.canal = null;
    return c.removeAllChannels().catch(function () { });
  };

  var API = {
    Net: OrlogNet,
    codigoSala: codigoSala,
    normalizaCodigo: normalizaCodigo,
    rngConSemilla: rngConSemilla,
    semillaAleatoria: semillaAleatoria
  };

  if (typeof window !== 'undefined') window.OrlogRed = API;
  if (typeof module !== 'undefined') module.exports = API;
})();
