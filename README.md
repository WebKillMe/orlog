# Orlog

Juego de dados **Orlog** (el de *Assassin's Creed Valhalla*) como web app estática, jugable contra la máquina con tres niveles de dificultad. Sin dependencias ni build: se abre `index.html` y a jugar.

![estado](https://img.shields.io/badge/estado-jugable-2ea44f) ![sin dependencias](https://img.shields.io/badge/dependencias-0-blue)

## Jugar

- **Opción rápida:** abre `index.html` en el navegador.
- **Con servidor local** (recomendado para que carguen bien las fuentes):
  ```
  npx serve .
  ```
  y entra en la URL que indique.

## Reglas

Cada jugador tiene 15 piedras de vida y 6 dados. Por ronda hay tres tiradas en las que te vas quedando dados. Las caras son:

- 🪓 **Hacha** — 1 de daño cuerpo a cuerpo (lo bloquea un casco).
- 🏹 **Flecha** — 1 de daño a distancia (lo bloquea un escudo).
- ⛑️ **Casco** / 🛡️ **Escudo** — bloqueo.
- ✋ **Mano** — roba un token de favor al rival.

Cada dado tiene dos caras doradas que otorgan un **token de favor**. Con esos tokens invocas **Favores de los Dioses**: 20 favores distintos con tres niveles cada uno (Golpe de Thor, Furia de Brunilda, Puntería de Ullr, Ardid de Loki…), que se resuelven en un orden de prioridad concreto.

## Dificultades

- **Descastado** — juega casi al azar.
- **Jarl** — heurísticas razonables.
- **Rey** — cuenta tus dados, juega para rematarte y elige combos de dioses con sinergia.

## Estructura

```
index.html        shell (carga los scripts en orden)
css/styles.css    estética nórdica, dados 3D en CSS
js/gods.js        datos de los 20 dioses
js/engine.js      motor de juego puro (sin DOM, determinista)
js/ai.js          IA (3 niveles)
js/ui.js          interfaz, animaciones y sonido
tests/test.html   batería de tests del motor (ábrela en el navegador)
SPEC.md           especificación de diseño completa
```

## Tests

Abre `tests/test.html` en el navegador: ejecuta la batería de pruebas del motor (reglas, favores, empates, y partidas simuladas IA contra IA).
