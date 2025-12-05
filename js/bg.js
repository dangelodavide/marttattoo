(function initTrianglesBackground() {
  const container = document.getElementById('bgTriangles');
  if (!container) return;

  const TOTAL = 200;

  for (let i = 0; i < TOTAL; i++) {
    const tri = document.createElement('div');
    tri.className = 'tri';

    const size = 10 + Math.random() * 40;
    const rot = Math.random() * 360;
    const x = (Math.random() * 2 - 1) * 900;
    const y = (Math.random() * 2 - 1) * 900;
    const duration = 20 + Math.random() * 15;
    const delay = -Math.random() * duration;

    tri.style.setProperty('--tri-size', size + 'px');
    tri.style.setProperty('--tri-rot', rot + 'deg');
    tri.style.setProperty('--tri-x', x + 'px');
    tri.style.setProperty('--tri-y', y + 'px');
    tri.style.animationDuration = duration + 's';
    tri.style.animationDelay = delay + 's';

    container.appendChild(tri);
  }
})();
