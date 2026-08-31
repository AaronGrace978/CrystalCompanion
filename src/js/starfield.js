(function () {
  const canvas = document.getElementById('starfield');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  let stars = [];
  let w = 0;
  let h = 0;
  let dpr = 1;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth;
    h = window.innerHeight;
    canvas.width = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    canvas.style.width = w + 'px';
    canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (stars.length === 0) spawn();
  }

  function spawn() {
    const count = Math.floor((w * h) / 9000);
    stars = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      z: Math.random(),
      s: Math.random() * 1.6 + 0.2,
      tw: Math.random() * Math.PI * 2,
      sp: 0.4 + Math.random() * 1.2
    }));
  }

  function frame(t) {
    ctx.clearRect(0, 0, w, h);

    // deep nebula wash
    const g = ctx.createRadialGradient(w * 0.35, h * 0.4, 0, w * 0.35, h * 0.4, w * 0.55);
    g.addColorStop(0, 'rgba(20, 50, 90, 0.22)');
    g.addColorStop(0.5, 'rgba(10, 25, 50, 0.1)');
    g.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    const g2 = ctx.createRadialGradient(w * 0.7, h * 0.7, 0, w * 0.7, h * 0.7, w * 0.4);
    g2.addColorStop(0, 'rgba(60, 40, 80, 0.12)');
    g2.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, w, h);

    for (const s of stars) {
      const twinkle = 0.45 + 0.55 * Math.sin(t * 0.001 * s.sp + s.tw);
      const a = (0.25 + s.z * 0.75) * twinkle;
      ctx.beginPath();
      ctx.fillStyle = `rgba(${180 + s.z * 60}, ${210 + s.z * 40}, 255, ${a})`;
      ctx.arc(s.x, s.y, s.s * (0.6 + s.z), 0, Math.PI * 2);
      ctx.fill();
      // drift slowly
      s.y += 0.015 * s.z;
      if (s.y > h) {
        s.y = 0;
        s.x = Math.random() * w;
      }
    }

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', resize);
  resize();
  requestAnimationFrame(frame);
})();
