# n8n Camera 🎥

> Convierte el canvas de n8n en un plató: enfoca y amplía nodos del workflow
> con atajos de teclado mientras grabas, sin hacer zooms en edición.

[Read it in English](README.md)

Pensada para cualquiera que explique workflows de n8n en cámara: tutoriales,
demos para un cliente, walkthroughs con el equipo o un Loom rápido. En vez de
arrastrar y hacer scroll-zoom por el canvas mientras hablas, pulsas `Alt + →`
y la cámara se desliza al siguiente nodo con una transición suave.

<!-- GIF de demo aquí -->

## Qué hace

- **Navegación nodo a nodo** — recorre el workflow en orden de lectura
  (izquierda → derecha) con las flechas.
- **Transiciones cinematográficas** — movimientos de cámara suaves de 0,7 s,
  sin saltos.
- **Spotlight** — atenúa todo excepto el nodo enfocado.
- **Encuadre de conexiones** — encuadra el nodo actual y el siguiente juntos
  para explicar cómo se conectan.
- **Modo seguimiento** — dale a Execute y la cámara salta sola al nodo que
  se está ejecutando.
- **No destructiva** — nunca toca el estado interno de n8n. Al resetear
  vuelves exactamente a la vista que tenías.

## Cómo funciona

No toca el zoom real de n8n (no modifica el estado interno de Vue Flow).
Aplica una transformación CSS animada sobre el contenedor del canvas: una
*cámara virtual* que se mueve sobre el workflow. Ese es todo el truco, y por
eso no puede romperte el editor.

## Instalación

Todavía no está en la Chrome Web Store. Cárgala como extensión descomprimida:

1. Abre `chrome://extensions`
2. Activa el **Modo desarrollador** (arriba a la derecha)
3. **Cargar descomprimida** → selecciona esta carpeta

Funciona con n8n Cloud y self-hosted — se activa solo cuando detecta un
canvas de n8n en la página.

## Atajos

> 🍎 **En Mac, la tecla `Alt` es `⌥ Option`.** Por ejemplo, `Alt + →`
> significa `Option + flecha derecha`.

| Atajo | Acción |
|---|---|
| `Alt + →` | Enfocar el siguiente nodo (orden izquierda → derecha) |
| `Alt + ←` | Enfocar el nodo anterior |
| `Alt + ↑` | Más zoom sobre el nodo actual |
| `Alt + ↓` | Menos zoom |
| `Alt + 0` | Volver a la vista general |
| `Alt + C` | Encuadrar la conexión: nodo actual + siguiente (X → Y) |
| `Alt + S` | Spotlight on/off (atenúa los nodos no enfocados) |
| `Alt + F` | Seguir ejecución on/off (la cámara salta al nodo en ejecución) |
| `Alt + H` | Mostrar/ocultar el indicador con el nombre del nodo |

El indicador (HUD) con el nombre del nodo desaparece solo tras 2 segundos
para que no salga en la grabación; puedes desactivarlo del todo con `Alt + H`.

Los atajos se ignoran mientras escribes en un campo de texto, así que no
interfieren con el editor de n8n.

## Consejos para grabar

- Empieza desde la vista general (`Alt + 0`) para dar contexto.
- Los nodos se recorren en orden de lectura (izquierda → derecha), que suele
  coincidir con la lógica del workflow.
- Puedes seguir hablando con la cámara ampliada y avanzar con `Alt + →`; la
  transición es lo bastante suave como para narrar por encima.
- Para demos en directo, activa el seguimiento (`Alt + F`) antes de darle a
  Execute y deja que la cámara trabaje sola.

## Por qué

Grababa vídeos explicando workflows de n8n y cada toma era la misma pelea:
scroll-zoom, arrastrar, pasarse de largo, recentrar — o arreglarlo todo luego
en edición. Esto fue una tarde de trabajo que eliminó esa fricción para
siempre.

Hecho por [Antonio Blanco](https://ablancodev.com) — escribo sobre
herramientas como esta en [ablancodev.com](https://ablancodev.com).

## Licencia

[MIT](LICENSE)
