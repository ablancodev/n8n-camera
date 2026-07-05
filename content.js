// n8n Camera — cámara virtual sobre el canvas de n8n.
// No toca el estado interno de Vue Flow: aplica un transform CSS animado
// sobre el contenedor del canvas, como una cámara que se acerca al nodo.

(() => {
  'use strict';

  const ZOOM_LEVELS = [1.6, 2.2, 3.0, 4.0]; // escalas de cámara disponibles
  const DEFAULT_ZOOM_INDEX = 1;
  const TRANSITION = 'transform 0.7s cubic-bezier(0.25, 0.1, 0.25, 1)';
  const PAIR_FILL = 0.7;        // la pareja de nodos ocupa el 70% del encuadre
  const FOLLOW_POLL_MS = 400;

  const CANVAS_SELECTORS = [
    '.vue-flow__viewport',
    '.vue-flow__transformationpane',
    '[data-test-id="canvas"]',
    '#node-view',
  ].join(', ');

  // Heurística para detectar el nodo en ejecución (varía entre versiones de n8n)
  const RUNNING_SELECTORS =
    '[class*="executing"], [class*="running"], [data-node-status="running"], [class*="spinner"]';

  let currentIndex = -1;      // índice del nodo enfocado (-1 = sin foco)
  let zoomIndex = DEFAULT_ZOOM_INDEX;
  let hudEnabled = true;
  let spotlightEnabled = true;
  let followMode = false;
  let followTimer = null;
  let lastRunningEl = null;
  let hudEl = null;
  let hudTimer = null;
  let canvasAnnounced = false;

  console.log('[n8n Camera] content script cargado en', location.href);

  function getViewport() {
    return document.querySelector(CANVAS_SELECTORS);
  }

  function getContainer() {
    const vf = document.querySelector('.vue-flow');
    return vf ? vf.parentElement || vf : null;
  }

  function getCameraTarget() {
    return document.querySelector('.vue-flow');
  }

  // Lee "translate(Xpx, Ypx) scale(K)" del pane de Vue Flow
  function getPaneTransform() {
    const pane = document.querySelector('.vue-flow__transformationpane');
    if (!pane) return { x: 0, y: 0, k: 1 };
    const t = pane.style.transform || '';
    const tm = t.match(/translate\(\s*(-?[\d.]+)px[ ,]+(-?[\d.]+)px\s*\)/);
    const sm = t.match(/scale\(\s*(-?[\d.]+)\s*\)/);
    return {
      x: tm ? parseFloat(tm[1]) : 0,
      y: tm ? parseFloat(tm[2]) : 0,
      k: sm ? parseFloat(sm[1]) : 1,
    };
  }

  function getNodes() {
    const nodes = Array.from(document.querySelectorAll('.vue-flow__node'));
    // Orden de lectura: izquierda → derecha, y a igual columna, arriba → abajo
    return nodes
      .map((el) => {
        const m = (el.style.transform || '').match(
          /translate\(\s*(-?[\d.]+)px[ ,]+(-?[\d.]+)px\s*\)/
        );
        return {
          el,
          x: m ? parseFloat(m[1]) : 0,
          y: m ? parseFloat(m[2]) : 0,
        };
      })
      .sort((a, b) => (Math.abs(a.x - b.x) > 40 ? a.x - b.x : a.y - b.y));
  }

  function nodeName(node) {
    return (
      node.el.getAttribute('data-node-name') ||
      node.el.querySelector('[data-test-id="canvas-node-box-title"], .node-name, [class*="name"]')?.textContent?.trim() ||
      'nodo'
    );
  }

  // ---- Spotlight -----------------------------------------------------------

  function setSpotlight(focusEls) {
    const target = getCameraTarget();
    if (!target) return;
    document
      .querySelectorAll('.n8n-camera-focus')
      .forEach((el) => el.classList.remove('n8n-camera-focus'));
    if (spotlightEnabled && focusEls && focusEls.length) {
      target.classList.add('n8n-camera-dim');
      focusEls.forEach((el) => el.classList.add('n8n-camera-focus'));
    } else {
      target.classList.remove('n8n-camera-dim');
    }
  }

  // ---- Cámara --------------------------------------------------------------

  // Encuadra una caja en coordenadas del canvas (sin transform de Vue Flow)
  function frameBox(bx, by, bw, bh, scale) {
    const target = getCameraTarget();
    const container = getContainer();
    if (!target || !container) return;

    const pane = getPaneTransform();
    const rect = container.getBoundingClientRect();

    // Caja en coordenadas del contenedor
    const cx = pane.x + pane.k * (bx + bw / 2);
    const cy = pane.y + pane.k * (by + bh / 2);

    if (!scale) {
      // Escala para que la caja ocupe PAIR_FILL del encuadre
      scale = Math.min(
        (rect.width * PAIR_FILL) / (pane.k * bw),
        (rect.height * PAIR_FILL) / (pane.k * bh)
      );
      scale = Math.max(1.1, Math.min(scale, ZOOM_LEVELS[ZOOM_LEVELS.length - 1]));
    }

    const tx = rect.width / 2 - scale * cx;
    const ty = rect.height / 2 - scale * cy;

    container.style.overflow = 'hidden';
    target.style.transformOrigin = '0 0';
    target.style.transition = TRANSITION;
    target.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }

  function focusNode(node) {
    const nw = node.el.offsetWidth || 100;
    const nh = node.el.offsetHeight || 100;
    frameBox(node.x, node.y, nw, nh, ZOOM_LEVELS[zoomIndex]);
    setSpotlight([node.el]);
    showHud(nodeName(node));
  }

  function focusPair(a, b) {
    const ar = { w: a.el.offsetWidth || 100, h: a.el.offsetHeight || 100 };
    const br = { w: b.el.offsetWidth || 100, h: b.el.offsetHeight || 100 };
    const x1 = Math.min(a.x, b.x);
    const y1 = Math.min(a.y, b.y);
    const x2 = Math.max(a.x + ar.w, b.x + br.w);
    const y2 = Math.max(a.y + ar.h, b.y + br.h);
    frameBox(x1, y1, x2 - x1, y2 - y1);
    setSpotlight([a.el, b.el]);
    showHud(`${nodeName(a)} → ${nodeName(b)}`);
  }

  function resetCamera() {
    const target = getCameraTarget();
    if (!target) return;
    target.style.transition = TRANSITION;
    target.style.transform = '';
    currentIndex = -1;
    setSpotlight(null);
    showHud('vista general');
  }

  function step(dir) {
    const nodes = getNodes();
    if (!nodes.length) {
      showHud('no encuentro nodos en el canvas', true);
      return;
    }
    currentIndex =
      currentIndex === -1
        ? dir > 0 ? 0 : nodes.length - 1
        : (currentIndex + dir + nodes.length) % nodes.length;
    focusNode(nodes[currentIndex]);
  }

  function stepPair() {
    const nodes = getNodes();
    if (nodes.length < 2) {
      showHud('hacen falta al menos 2 nodos', true);
      return;
    }
    if (currentIndex === -1) currentIndex = 0;
    const next = (currentIndex + 1) % nodes.length;
    focusPair(nodes[currentIndex], nodes[next]);
  }

  function changeZoom(dir) {
    zoomIndex = Math.max(0, Math.min(ZOOM_LEVELS.length - 1, zoomIndex + dir));
    if (currentIndex !== -1) {
      const nodes = getNodes();
      if (nodes[currentIndex]) focusNode(nodes[currentIndex]);
    }
  }

  // ---- Seguir ejecución ----------------------------------------------------

  function findRunningNode() {
    const nodes = getNodes();
    return nodes.find(
      (n) =>
        n.el.matches(RUNNING_SELECTORS) || n.el.querySelector(RUNNING_SELECTORS)
    );
  }

  function toggleFollow() {
    followMode = !followMode;
    if (followMode) {
      showHud('siguiendo ejecución — dale a Execute', true);
      followTimer = setInterval(() => {
        const running = findRunningNode();
        if (running && running.el !== lastRunningEl) {
          lastRunningEl = running.el;
          currentIndex = getNodes().findIndex((n) => n.el === running.el);
          focusNode(running);
        }
      }, FOLLOW_POLL_MS);
    } else {
      clearInterval(followTimer);
      lastRunningEl = null;
      showHud('seguimiento desactivado', true);
    }
  }

  // ---- HUD -----------------------------------------------------------------

  // force=true muestra el mensaje aunque el HUD esté desactivado (diagnóstico)
  function showHud(text, force = false) {
    if (!hudEnabled && !force) return;
    if (!hudEl) {
      hudEl = document.createElement('div');
      hudEl.className = 'n8n-camera-hud';
      document.body.appendChild(hudEl);
    }
    hudEl.textContent = `🎥 ${text}`;
    hudEl.classList.add('visible');
    clearTimeout(hudTimer);
    hudTimer = setTimeout(() => hudEl.classList.remove('visible'), 2000);
  }

  function isTyping() {
    const el = document.activeElement;
    return (
      el &&
      (el.tagName === 'INPUT' ||
        el.tagName === 'TEXTAREA' ||
        el.isContentEditable)
    );
  }

  // Avisar visualmente cuando se detecta un canvas de n8n (SPA: puede tardar)
  const detectTimer = setInterval(() => {
    if (canvasAnnounced) return clearInterval(detectTimer);
    if (getViewport()) {
      canvasAnnounced = true;
      clearInterval(detectTimer);
      console.log('[n8n Camera] canvas de n8n detectado');
      showHud('n8n Camera activa — Alt/Option + → para enfocar', true);
    }
  }, 1000);
  setTimeout(() => clearInterval(detectTimer), 60000);

  // Estado para el popup de la extensión. El script corre en todos los frames
  // de la página y el popup se queda con la PRIMERA respuesta: el frame que
  // tiene el canvas responde al instante y los que no lo tienen esperan, para
  // que nunca gane un "no detectado" de un frame vacío.
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg && msg.type === 'n8n-camera-status') {
      const reply = () =>
        sendResponse({
          canvasDetected: !!getViewport(),
          nodeCount: getNodes().length,
          url: location.href,
        });
      if (getViewport()) {
        reply();
        return false;
      }
      setTimeout(reply, 400);
      return true; // respuesta asíncrona
    }
    return false;
  });

  document.addEventListener(
    'keydown',
    (e) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || isTyping()) return;

      const isOurKey = [
        'ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown',
        'Digit0', 'Numpad0', 'KeyH', 'KeyS', 'KeyC', 'KeyF',
      ].includes(e.code);
      if (!isOurKey) return;

      if (!getViewport()) {
        showHud('no se detecta el canvas de n8n en esta página', true);
        return;
      }

      switch (e.code) {
        case 'ArrowRight':
          step(1);
          break;
        case 'ArrowLeft':
          step(-1);
          break;
        case 'ArrowUp':
          changeZoom(1);
          break;
        case 'ArrowDown':
          changeZoom(-1);
          break;
        case 'Digit0':
        case 'Numpad0':
          resetCamera();
          break;
        case 'KeyC':
          stepPair();
          break;
        case 'KeyS':
          spotlightEnabled = !spotlightEnabled;
          setSpotlight(null);
          showHud(spotlightEnabled ? 'spotlight activado' : 'spotlight desactivado', true);
          break;
        case 'KeyF':
          toggleFollow();
          break;
        case 'KeyH':
          hudEnabled = !hudEnabled;
          showHud(hudEnabled ? 'HUD activado' : 'HUD desactivado', true);
          break;
      }
      e.preventDefault();
      e.stopPropagation();
    },
    true
  );
})();
