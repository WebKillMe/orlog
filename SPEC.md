# ORLOG — Especificación de diseño (v1)

Web app estática, sin dependencias externas ni build. Juego de dados Orlog (de Assassin's Creed Valhalla) contra la máquina con 3 niveles de dificultad. Idioma de la interfaz: **español**.

## Arquitectura

```
orlog/
  index.html        ← shell, carga scripts en orden con <script> clásicos (NO módulos ES; debe funcionar desde file://)
  css/styles.css    ← todo el estilo
  js/gods.js        ← window.ORLOG_GODS (datos de los 20 dioses)  [YA ESCRITO — leerlo, no tocarlo]
  js/engine.js      ← window.OrlogEngine (lógica pura, cero DOM)
  js/ai.js          ← window.OrlogAI (3 dificultades, cero DOM)
  js/ui.js          ← window.OrlogUI (todo el DOM/animaciones)
  js/main.js        ← bootstrap: crea UI y arranca
  tests/engine.test.mjs  ← tests con node (importa los .js con leerlos+eval o createRequire; los ficheros exponen también module.exports si typeof module !== 'undefined')
```

Orden de carga en index.html: `gods.js → engine.js → ai.js → ui.js → main.js`.

Cada fichero JS termina con el patrón dual:
```js
if (typeof module !== 'undefined') module.exports = { OrlogEngine }; // o lo que exporte
```

---

## REGLAS DEL JUEGO (fuente: juego original + wiki + clones verificados)

### Componentes
- 2 jugadores (humano = índice 0, IA = índice 1). Cada uno: **15 piedras de vida**, **0 tokens de favor** inicial, **6 dados**, **3 dioses** elegidos antes de la partida.
- La vida se cura como máximo hasta 15. Los tokens no tienen límite.

### Los dados
Los 6 dados son iguales en símbolos pero difieren en qué caras son doradas.
Caras de cada dado (índices 0–5): `['axe','shield','arrow','axe','helmet','steal']`.
Caras doradas por dado (las hachas NUNCA son doradas; 2 doradas por dado):

| dado | doradas |
|------|---------|
| 0 | arrow, steal |
| 1 | shield, steal |
| 2 | arrow, helmet |
| 3 | steal, helmet |
| 4 | shield, arrow |
| 5 | shield, helmet |

Una cara dorada otorga **+1 token de favor** en la resolución.

Significado: `axe` = 1 daño cuerpo a cuerpo (lo bloquea 1 `helmet`); `arrow` = 1 daño a distancia (lo bloquea 1 `shield`); `steal` (mano) = roba 1 token de favor al rival.

### Estructura de una ronda
1. **Fase de tirada** (3 tiradas). El *jugador inicial* tira sus dados no bloqueados, elige cuáles **se queda** (se bloquean) y pasa; luego el rival hace lo mismo. Eso es una tirada. Tras la 3ª tirada de cada uno, TODOS los dados quedan bloqueados automáticamente. Si un jugador se queda todos los dados, sus tiradas restantes se saltan.
   - El jugador inicial de la ronda 1 se decide con una moneda (aleatorio). En rondas siguientes **alterna**.
2. **Fase de favor**: cada jugador elige en secreto 1 favor de dios (uno de sus 3) y un nivel (1–3), o nada. Solo puede elegirse si tiene tokens ≥ coste en ese momento. El coste NO se descuenta aún: se paga en la resolución, y si para entonces no le quedan tokens suficientes (p. ej. se los robaron), **el favor falla**.
3. **Fase de resolución** (ver orden exacto abajo).
4. Si nadie ha muerto, nueva ronda.

### Orden exacto de la resolución
El motor la ejecuta entera y devuelve una **lista ordenada de eventos** que la UI reproduce con animaciones. Orden:

1. **Tokens dorados**: cada jugador gana +1 favor por cada dado bloqueado con cara dorada (los dados baneados por Loki no cuentan).
2. **Favores por prioridad**: los favores elegidos se ordenan por su campo `priority` (menor primero); a igual prioridad resuelve antes el jugador inicial de la ronda. Al llegar el turno de un favor se intenta **pagar el coste**: si el jugador no tiene tokens suficientes → evento `favorFailed` y no hace nada. Prioridades:
   - **P1**: Thrymr (reduce nivel del favor rival; si el nivel resultante < 1, el favor rival queda cancelado — el rival NO paga), Var (registra: cada token que pague el rival esta ronda te cura N).
   - **P2**: Loki (banea dados rivales), Frigg (re-tira dados rivales), Freyja (tira N dados extra propios, quedan bloqueados con lo que salga).
   - **P3**: Skuld (destruye tokens del rival por cada `arrow` propia).
   - **P4 (robo de manos)**: no es favor — cada `steal` bloqueado roba 1 token al rival. Simultáneo: se calcula sobre los tokens que cada uno tiene en ese momento, con tope en lo disponible.
   - **P5 (modificadores de dados/daño)**: Vidar (elimina helmets rivales), Ullr (N flechas ignoran shields), Baldr (+N helmet/shield por cada helmet/shield propio), Skadi (+N arrows por cada dado propio con arrow), Brunhild (multiplica axes), Freyr (+N al símbolo propio en mayoría; si hay empate en mayoría, gana el orden axe>arrow>helmet>shield>steal). Hel, Heimdall, Mimir y Bragi **registran** sus efectos para el paso 3.
3. **Daño simultáneo**: para cada jugador: `dañoRecibido = max(0, axesRival − helmetsPropios) + max(0, arrowsRivalNoIgnoradas − shieldsPropios) + arrowsRivalQueIgnoran`. Se aplica a ambos a la vez. En este paso:
   - Hel: el dueño cura N por cada axe SUYA que hizo daño (no bloqueada).
   - Heimdall: el dueño cura N por cada ataque rival que bloqueó (helmets usados + shields usados, con tope en ataques reales).
   - Mimir: el dueño gana N tokens por cada punto de daño recibido.
   - Bragi: el dueño gana N tokens por cada dado `steal` propio bloqueado (se registra en P5 pero se abona aquí).
4. **Chequeo de muerte** (si ambos ≤ 0 → empate; si uno → fin de partida, no se resuelven más favores).
5. **Favores post-resolución** por prioridad: Thor (P6: daño directo imparable), Tyr (P6: sacrificas 1/2/3 de vida, el rival pierde 2 tokens por cada vida sacrificada; no puedes suicidarte: si te dejaría a 0, sacrifica solo hasta dejarte a 1), Odin (P7: sacrificas vida a tu elección — la IA decide, al humano se le pregunta — y ganas N tokens por vida; mismo límite de no-suicidio), Idun (P7: cura). Tras cada favor que cambie vida → chequeo de muerte.
6. Evento `roundEnd` con resumen.

Nota Var: cura al dueño N por CADA token que el rival haya pagado en costes de favores esta resolución (no cuenta robos ni Skuld).

### Fin de partida
Vida rival = 0 → victoria. Ambos a 0 en el mismo paso → empate («Valhalla os espera a ambos»).

---

## DATOS DE DIOSES — js/gods.js (ya escrito)

`window.ORLOG_GODS` es un array de 20 objetos:
```js
{
  id: 'thor',
  name: "Golpe de Thor",
  god: "Thor",
  rune: 'ᚦ',              // runa decorativa
  priority: 6,
  desc: "Inflige daño directo tras la resolución",
  levels: [ {cost:4, value:2}, {cost:8, value:5}, {cost:12, value:8} ],
  levelDesc: (v) => `${v} de daño`,   // texto por nivel
}
```
IDs y números exactos: ver el fichero. El motor implementa los efectos por `id` (switch). La UI pinta cartas genéricamente desde estos datos.

Lista de los 20 ids: thor, idun, vidar, heimdall, ullr, baldr, freyja, freyr, hel, skadi, brunhild, skuld, frigg, loki, mimir, bragi, odin, var, thrymr, tyr.

Targeting automático (sin selección manual, para simplificar): Loki banea y Frigg re-tira los dados rivales «más peligrosos» con esta prioridad: axe > arrow > steal > helmet > shield (y entre iguales, dorados primero).

---

## API DEL MOTOR — js/engine.js

```js
class OrlogEngine {
  constructor({ names:[h,ia], gods:[[3 ids],[3 ids]], firstPlayer /*0|1|undefined=azar*/, rng /*opcional, ()=>[0,1) para tests*/ })

  getState()          // copia profunda del estado (ver forma abajo)

  // Fase de tirada — siempre actúa state.activePlayer:
  roll()              // tira los dados no kept del jugador activo → muta faces. Error si fase incorrecta.
  toggleKeep(dieId)   // marca/desmarca keep de un dado del jugador activo (solo dados recién tirados esta tirada)
  endTurn()           // fija los keeps, pasa al siguiente jugador/tirada. En la 3ª tirada bloquea todo.
                      // Cuando ambos terminan la 3ª tirada (o todo está kept) → phase='favor'
  keepAll()           // azúcar: marca todos y endTurn()

  // Fase de favor:
  selectFavor(playerIdx, godId|null, level /*1-3*/)  // valida tokens ≥ coste; ambos deben llamar (null = pasar)
                      // cuando ambos han elegido → phase='resolution'

  // Resolución:
  resolve({ odinSacrifice: {0: n, 1: n} } = {})  // ejecuta TODO y devuelve ResolutionReport
  needsOdinPrompt()   // {player, maxSacrifice} | null — la UI pregunta al humano ANTES de llamar resolve
  nextRound()         // limpia dados/favores, alterna firstPlayer, phase='roll' (error si gameover)
}
```

### Forma del estado
```js
{
  phase: 'roll'|'favor'|'resolution'|'gameover',
  round: 1..,
  rollNum: 1|2|3,          // tirada en curso del jugador activo
  firstPlayer: 0|1,
  activePlayer: 0|1,       // solo relevante en fase roll
  winner: null|0|1|'draw',
  players: [{
    name, health:0..15, tokens:0.., gods:[id,id,id],
    favor: null|{godId, level},       // el del rival se OCULTA a la UI hasta la resolución (la UI no debe mirarlo, pero no hace falta cifrarlo)
    dice: [{ id:0..8, dieType:0..5 /*fila de la tabla de doradas*/, face:'axe'|.., gold:bool, kept:bool, banned:bool, justRolled:bool }]
  }, {...}],
}
```
Dados extra de Freyja: se añaden a `dice` con `id` 6+ durante la resolución (evento lo refleja).

### ResolutionReport
`resolve()` devuelve `{ events: [...] }`, eventos en orden de reproducción. Tipos (todos llevan los campos necesarios para animar sin consultar más):

```js
{type:'goldTokens', player, amount, diceIds:[..]}
{type:'favorInvoked', player, godId, level}
{type:'favorFailed', player, godId, reason:'tokens'|'cancelled'}
{type:'favorEffect', player, godId, detail:{...}}   // p.ej. {banned:[ids]}, {rerolled:[{id,from,to,gold}]}, {extraDice:[{id,face,gold}]}, {removedHelmets:n}, {healed:n}, {tokensDestroyed:n}, {tokensGained:n}, {multiplied:{from,to}}, {added:{face,n}}
{type:'steal', player /*quien roba*/, amount}
{type:'damage', player /*quien la recibe*/, amount, blocked, breakdown:{axes, axesBlocked, arrows, arrowsBlocked, pierced}}
{type:'heal', player, amount, source:godId|null}
{type:'tokens', player, amount /*+/-*/, source:godId|'steal'}
{type:'death', player}
{type:'roundEnd', summary:{healths:[h0,h1], tokens:[t0,t1]}}
{type:'gameOver', winner:0|1|'draw'}
```

Reglas de implementación del motor: **cero DOM, cero setTimeout** — síncrono y determinista con `rng` inyectable. Cada método valida fase y lanza `Error` con mensaje claro si se usa mal.

---

## IA — js/ai.js

```js
const OrlogAI = {
  pickGods(difficulty /*'easy'|'normal'|'hard'*/) → [3 godIds],
  // decide keeps para el estado actual (la IA es el jugador state.activePlayer):
  decideKeeps(state, difficulty) → { keep:[dieIds], stopRolling:bool },
  decideFavor(state, difficulty, playerIdx) → {godId, level} | null,
  decideOdinSacrifice(state, playerIdx) → n,
}
```

- **Fácil («Descastado»)**: se queda dados casi al azar (ligera preferencia por axes), casi nunca re-piensa; usa favores solo a veces y a nivel bajo; dioses al azar.
- **Normal («Jarl»)**: heurística: valora axes cuando el rival tiene poca vida, helmets proporcionales a los axes visibles del rival, shields vs arrows, steals si el rival acumula tokens, dorados como desempate; usa favores cuando el beneficio esperado supera el coste; dioses de un pool sólido.
- **Difícil («Rey»)**: lo del Jarl **más**: cuenta exactamente los dados ya bloqueados del rival y los propios, calcula valor esperado de re-tirar vs plantarse, juega para letal (si daño esperado ≥ vida rival, maximiza ataque), guarda tokens para combos, elige set de dioses con sinergia (p. ej. thor+baldr+thrymr / ullr+skadi+idun / hel+brunhild+var) y elige nivel de favor óptimo, considera dejar de robar si Var rival está activo, etc.

Determinista dado un `rng`; sin DOM.

---

## UI — index.html + css/styles.css + js/ui.js + js/main.js

### Dirección de arte
- **Tema nórdico nocturno**: fondo #0b0f14 → #131a23 con viñeta radial; textura sutil de ruido/madera con CSS puro (gradients), NADA de imágenes externas. Todo autocontenido (sin CDNs, sin Google Fonts: usar `Georgia, 'Times New Roman', serif` para títulos con `letter-spacing` amplio y font-variant small-caps, y system-ui para texto).
- Paleta: oro viejo `#d4a94e` (acentos, bordes dorados, tokens), hueso `#e8e1d0` (texto), rojo sangre `#a83232` (daño/vida perdida), azul hielo `#7fb3c8` (jugador), verde musgo apagado para curas, gris piedra `#3a4450`.
- Runas unicode decorativas (ᚠᚢᚦᚨᚱᚲ…) en bordes/separadores con opacidad baja.
- Movimiento: transiciones generosas (200–400ms), keyframes para dados y golpes. `prefers-reduced-motion` respetado.

### Pantallas (secciones que se muestran/ocultan, una sola página)
1. **Título**: «ORLOG» enorme con glow dorado y runas; botón «Jugar». Fondo con brasas/partículas CSS flotando (puro CSS, ~15 nodos).
2. **Dificultad**: 3 cartas grandes — Descastado (fácil), Jarl (normal), Rey (difícil) — con descripción burlona corta y una runa; hover con elevación y glow.
3. **Draft de dioses**: rejilla con las 20 cartas de dios (runa grande + nombre + dios + desc + 3 niveles con coste en tokens). El jugador elige 3 (seleccionadas con borde dorado y check). Botón «Al combate» se activa con 3. Los 3 dioses de la IA se muestran después, en el tablero.
4. **Tablero** (layout vertical, IA arriba / humano abajo, zona central de estado):
   - Cada lado: nombre + **15 piedras de vida** (fichas ovaladas en 2 filas; perdidas = agrietadas/apagadas con animación de romperse), **contador de tokens de favor** (moneda dorada con número), sus **3 cartas de dios** en miniatura (clicables en fase de favor para el humano), y su **bandeja de dados**.
   - Dados: cubos CSS 3D (`transform-style:preserve-3d`, 6 caras con símbolos SVG inline). Al tirar: animación de volteo aleatorio ~0.8s con `cubic-bezier` y aterrizar en la cara resultado. Dados `kept` se desplazan a una fila superior «bloqueados» con candado sutil; dorados llevan borde punteado dorado brillante; baneados se cubren con runa de Loki y desaturan.
   - Centro: **banner de fase** («Ronda 3 — Tirada 2/3 — Te toca», etc.), botones contextuales («Tirar», «Quedarse estos», «Quedárselo todo», «Invocar favor / Pasar»), y el **log** de la ronda (2–3 líneas).
   - Turno de la IA: sus decisiones se ven con pausas (~600ms) y sus dados animan igual.
5. **Fase de favor (humano)**: sus 3 cartas se agrandan en un panel; cada carta muestra los 3 niveles como botones con coste; los que no puede pagar, apagados. Botón «No invocar». Lo elegido queda «armado» boca abajo hasta la resolución (el favor de la IA no se revela).
6. **Resolución**: la UI reproduce `report.events` en secuencia con ~500–900ms por evento: monedas doradas vuelan de los dados al contador; **banner de invocación** a pantalla completa (nombre del dios + runa gigante + flash del color del dios) al invocar; robos = moneda volando de un contador al otro; daño = los dados atacantes se lanzan hacia el rival, piedras se rompen, shake del lado dañado + viñeta roja breve; curas = glow verde; muerte/gameOver → pantalla final.
7. **Fin**: «VICTORIA» / «DERROTA» / «EMPATE» a pantalla completa con resumen (rondas, daño total) y botones «Revancha» (misma config) y «Menú».
8. Detalle: prompt de Odín (si el humano lo invoca): mini-diálogo con stepper 0..max para elegir vida a sacrificar.

### Contrato UI
```js
class OrlogUI {
  constructor(rootEl)   // construye todas las pantallas dentro de #app
  // main.js hace: new OrlogUI(document.getElementById('app')) y la UI gestiona todo el flujo:
  // dificultad → draft → crea OrlogEngine + usa OrlogAI para el jugador 1 → bucle de juego → fin.
}
```
La UI es dueña del bucle: llama al motor, y cuando toca la IA usa `OrlogAI` con timeouts para el ritmo. Reproduce eventos de resolución de forma **secuencial** (promesas encadenadas). Debe ser responsive: jugable desde 380px de ancho (dados más pequeños, misma disposición vertical) hasta escritorio.

### Sonido
Nada de ficheros: WebAudio sintetizado, MUY sutil: clack de dados (ruido corto filtrado), golpe grave al daño, campanilla al ganar tokens. Botón mute (🔊/🔇) arriba a la derecha, recuerda en localStorage (`orlog_muted`).

---

## Calidad
- `tests/engine.test.mjs`: partidas completas simuladas con rng fijo (IA vs IA en las 3 dificultades ×50 partidas sin lanzar errores), y tests unitarios de: bloqueo de daño, robo con tope, favor que falla por robo, Thrymr cancelando, Baldr/Skadi/Brunhild/Ullr/Freyr con números concretos, empate.
- Sin errores en consola. Sin dependencias. Debe funcionar abriendo index.html desde file:// y desde un server estático.
