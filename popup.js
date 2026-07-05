const dot = document.getElementById('dot');
const statusText = document.getElementById('statusText');

function setStatus(ok, text) {
  dot.className = 'dot ' + (ok ? 'ok' : 'ko');
  statusText.textContent = text;
}

chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  const tab = tabs[0];
  if (!tab || !tab.id) {
    setStatus(false, 'No hay pestaña activa');
    return;
  }
  chrome.tabs.sendMessage(tab.id, { type: 'n8n-camera-status' }, (res) => {
    if (chrome.runtime.lastError || !res) {
      setStatus(false, 'No cargada en esta pestaña — recarga la página');
      return;
    }
    if (res.canvasDetected) {
      setStatus(true, `Activa — ${res.nodeCount} nodos detectados`);
    } else {
      setStatus(false, 'Cargada, pero no veo un canvas de n8n');
    }
  });
});
