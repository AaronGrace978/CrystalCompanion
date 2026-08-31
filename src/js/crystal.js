/**
 * Living crystal — raymarched octahedral lattice.
 * Speaks in light: each message flares a new spectrum hue
 * (and invents wild, never-before-seen blends).
 */
(function () {
  const canvas = document.getElementById('crystal-canvas');
  if (!canvas) return;

  const gl = canvas.getContext('webgl', {
    alpha: true,
    antialias: true,
    premultipliedAlpha: false
  });
  if (!gl) {
    console.warn('WebGL unavailable');
    return;
  }

  const VERT = `
    attribute vec2 a_pos;
    void main() {
      gl_Position = vec4(a_pos, 0.0, 1.0);
    }
  `;

  const FRAG = `
    precision highp float;

    uniform vec2 u_res;
    uniform float u_time;
    uniform float u_pulse;
    uniform float u_energy;
    uniform vec2 u_mouse;
    uniform float u_hue;
    uniform float u_hueB;
    uniform float u_wild;
    uniform float u_glowBoost;

    #define MAX_STEPS 96
    #define MAX_DIST 40.0
    #define SURF 0.0012
    #define TAU 6.28318530718

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    float sdOctahedron(vec3 p, float s) {
      p = abs(p);
      return (p.x + p.y + p.z - s) * 0.57735027;
    }

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    // Classic spectrum
    vec3 hsl2rgb(float h, float s, float l) {
      float r = abs(h * 6.0 - 3.0) - 1.0;
      float g = 2.0 - abs(h * 6.0 - 2.0);
      float b = 2.0 - abs(h * 6.0 - 4.0);
      vec3 rgb = clamp(vec3(r, g, b), 0.0, 1.0);
      return mix(vec3(l), rgb, s);
    }

    // Invented / "new" colors — phase-warped RGB that doesn't sit on a normal wheel
    vec3 wildHue(float h, float w) {
      vec3 a = 0.5 + 0.5 * cos(TAU * (vec3(h) + vec3(0.0, 0.33, 0.67)));
      vec3 b = 0.5 + 0.5 * cos(TAU * (vec3(h * 1.7 + w) + vec3(0.1, 0.55, 0.82) * (1.0 + w)));
      vec3 c = 0.5 + 0.5 * cos(TAU * (h * 2.3 + vec3(0.0, 0.21, 0.47) + w * 0.4));
      // hyper-chroma push + soft clamp
      vec3 mixed = mix(a, b, 0.45 + 0.35 * w);
      mixed = mix(mixed, c, 0.25 * w);
      mixed = pow(clamp(mixed, 0.0, 1.0), vec3(0.85));
      return mixed;
    }

    vec3 crystalTint(float h, float hb, float wild, float t, float fres) {
      vec3 spectrum = hsl2rgb(fract(h), 0.85, 0.55);
      vec3 accent = hsl2rgb(fract(hb), 0.9, 0.6);
      vec3 invented = wildHue(h, wild);
      vec3 inventedB = wildHue(hb + 0.17, 1.0 - wild * 0.5);
      vec3 base = mix(spectrum, invented, clamp(wild, 0.0, 1.0));
      base = mix(base, mix(accent, inventedB, wild), 0.35 + 0.25 * fres);
      // iridescent shimmer across facets
      base += 0.12 * cos(TAU * (h + t * 0.08 + fres) + vec3(0.0, 2.0, 4.0));
      return clamp(base, 0.0, 1.4);
    }

    float map(vec3 p) {
      float t = u_time;
      float breathe = 1.0 + 0.04 * sin(t * 1.3) + 0.05 * u_pulse + 0.03 * u_glowBoost;

      vec3 q = p;
      q.xz *= rot(t * 0.22);
      q.xy *= rot(sin(t * 0.15) * 0.25);
      q.y += sin(t * 0.8) * 0.08;

      float core = sdOctahedron(q, 1.15 * breathe);

      vec3 q2 = q;
      q2.xz *= rot(1.047);
      float shell = abs(sdOctahedron(q2, 1.45 * breathe)) - 0.018;

      vec3 q3 = p;
      q3.xz *= rot(-t * 0.35);
      float shards = 1e5;
      for (int i = 0; i < 6; i++) {
        float fi = float(i);
        vec3 sp = q3;
        float ang = fi * 1.047 + t * 0.1;
        sp.xz *= rot(ang);
        sp.y -= 0.15 * sin(fi + t);
        sp -= vec3(1.85 + 0.12 * sin(t + fi), 0.2 * cos(t * 0.7 + fi), 0.0);
        sp.xy *= rot(t * 0.5 + fi);
        shards = min(shards, sdOctahedron(sp, 0.22 + 0.04 * sin(t + fi)));
      }

      vec3 lp = q * 3.2;
      float lat = length(mod(lp + 0.5, 1.0) - 0.5) - 0.08;
      lat = max(core + 0.08, -lat);

      float d = min(core, shell);
      d = min(d, shards);
      d = min(d, max(core, lat * 0.4));

      float floorD = p.y + 2.4;
      d = min(d, floorD);

      return d;
    }

    vec3 calcNormal(vec3 p) {
      vec2 e = vec2(0.0015, 0.0);
      return normalize(vec3(
        map(p + e.xyy) - map(p - e.xyy),
        map(p + e.yxy) - map(p - e.yxy),
        map(p + e.yyx) - map(p - e.yyx)
      ));
    }

    float calcAO(vec3 p, vec3 n) {
      float occ = 0.0;
      float sca = 1.0;
      for (int i = 0; i < 5; i++) {
        float h = 0.01 + 0.12 * float(i);
        float d = map(p + n * h);
        occ += (h - d) * sca;
        sca *= 0.85;
      }
      return clamp(1.0 - 2.5 * occ, 0.0, 1.0);
    }

    float softShadow(vec3 ro, vec3 rd) {
      float res = 1.0;
      float t = 0.05;
      for (int i = 0; i < 24; i++) {
        float h = map(ro + rd * t);
        res = min(res, 12.0 * h / t);
        t += clamp(h, 0.02, 0.2);
        if (res < 0.01 || t > 12.0) break;
      }
      return clamp(res, 0.0, 1.0);
    }

    vec3 render(vec2 uv) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv;
      p.x *= aspect;

      float camZ = 5.2 - u_energy * 0.35 - u_glowBoost * 0.15;
      vec3 ro = vec3(0.15 + u_mouse.x * 0.4, 0.35 + u_mouse.y * 0.25, camZ);
      vec3 ta = vec3(0.0, 0.1, 0.0);
      vec3 ww = normalize(ta - ro);
      vec3 uu = normalize(cross(ww, vec3(0.0, 1.0, 0.0)));
      vec3 vv = cross(uu, ww);
      vec3 rd = normalize(p.x * uu + p.y * vv + 1.7 * ww);

      float t = 0.0;
      float hit = 0.0;
      vec3 col = vec3(0.0);
      float glowAccum = 0.0;

      for (int i = 0; i < MAX_STEPS; i++) {
        vec3 pos = ro + rd * t;
        float d = map(pos);
        glowAccum += (0.018 + 0.012 * u_glowBoost) / (0.04 + abs(d));
        if (d < SURF) {
          hit = 1.0;
          break;
        }
        if (t > MAX_DIST) break;
        t += d * 0.85;
      }

      vec3 tint = crystalTint(u_hue, u_hueB, u_wild, u_time, 0.5);
      vec3 bg = vec3(0.01, 0.02, 0.05);
      float stars = pow(hash(vec3(floor(uv * u_res * 0.4), 1.0)), 40.0);
      bg += stars * mix(vec3(0.6, 0.8, 1.0), tint, 0.55) * 0.35;
      bg += tint * 0.04 * (0.4 + u_glowBoost);

      if (hit > 0.5) {
        vec3 pos = ro + rd * t;
        vec3 nor = calcNormal(pos);
        vec3 ref = reflect(rd, nor);

        float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);
        vec3 base = crystalTint(u_hue + pos.y * 0.08, u_hueB, u_wild, u_time, fres);
        base = mix(base, vec3(1.0), fres * 0.25);

        vec3 light1 = normalize(vec3(0.6, 0.9, 0.4));
        vec3 light2 = normalize(vec3(-0.8, 0.3, -0.2));
        float dif1 = max(dot(nor, light1), 0.0);
        float dif2 = max(dot(nor, light2), 0.0) * 0.45;
        float spe = pow(max(dot(ref, light1), 0.0), 48.0);
        float sh = softShadow(pos + nor * 0.02, light1);
        float ao = calcAO(pos, nor);

        float inner = exp(-abs(map(pos - nor * 0.15)) * 8.0);
        vec3 fire = mix(tint, crystalTint(u_hueB, u_hue, 1.0 - u_wild, u_time, 1.0), 0.4);
        fire *= (0.45 + 0.7 * u_pulse + 0.85 * u_glowBoost);

        col = base * (0.14 + dif1 * sh * 0.9 + dif2) * ao;
        col += spe * mix(vec3(1.0), tint, 0.4) * sh * (1.0 + u_glowBoost * 0.5);
        col += fres * tint * 0.65;
        col += fire * inner * (0.6 + u_energy * 0.9 + u_glowBoost * 0.8);

        if (pos.y < -2.2) {
          float fog = smoothstep(-2.4, -1.8, pos.y);
          col = mix(bg, col * 0.3, fog);
        }

        float fogAmt = 1.0 - exp(-0.012 * t * t);
        col = mix(col, bg, fogAmt * 0.45);
      } else {
        col = bg;
      }

      vec3 glowCol = mix(tint, crystalTint(u_hueB, u_hue, u_wild, u_time, 1.0), 0.35);
      float bloom = (0.022 + 0.03 * u_glowBoost + 0.018 * u_pulse) * (0.4 + 0.6 * hit);
      col += glowCol * glowAccum * bloom;

      float vig = smoothstep(1.4, 0.2, length(uv * vec2(aspect * 0.6, 1.0)));
      col *= 0.55 + 0.45 * vig;

      col = col / (1.0 + col * 0.28);
      col = pow(max(col, 0.0), vec3(0.9));

      return col;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
      uv.x += (u_res.x > u_res.y * 1.1) ? 0.22 : 0.0;
      uv.y += 0.08;

      vec3 col = render(uv);
      float alpha = clamp(length(col) * 1.35 + u_glowBoost * 0.15, 0.0, 1.0);
      gl_FragColor = vec4(col, alpha);
    }
  `;

  function compile(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.error(gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.error(gl.getProgramInfoLog(prog));
    return;
  }
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'a_pos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uRes = gl.getUniformLocation(prog, 'u_res');
  const uTime = gl.getUniformLocation(prog, 'u_time');
  const uPulse = gl.getUniformLocation(prog, 'u_pulse');
  const uEnergy = gl.getUniformLocation(prog, 'u_energy');
  const uMouse = gl.getUniformLocation(prog, 'u_mouse');
  const uHue = gl.getUniformLocation(prog, 'u_hue');
  const uHueB = gl.getUniformLocation(prog, 'u_hueB');
  const uWild = gl.getUniformLocation(prog, 'u_wild');
  const uGlowBoost = gl.getUniformLocation(prog, 'u_glowBoost');

  let pulse = 0;
  let energy = 0;
  let targetEnergy = 0;
  let glowBoost = 0;
  let targetGlow = 0;
  let hue = 0.55;
  let targetHue = 0.55;
  let hueB = 0.12;
  let targetHueB = 0.12;
  let wild = 0.15;
  let targetWild = 0.15;
  let mouse = [0, 0];
  let targetMouse = [0, 0];
  let start = performance.now();
  let speakCount = 0;

  const EXOTIC = [
    { h: 0.92, hb: 0.48, wild: 0.95 }, // rose-aurora
    { h: 0.78, hb: 0.18, wild: 1.0 }, // violet-ember
    { h: 0.42, hb: 0.88, wild: 0.9 }, // jade-magenta
    { h: 0.08, hb: 0.62, wild: 1.0 }, // solar-ultraviolet
    { h: 0.55, hb: 0.05, wild: 0.85 }, // ice-blood
    { h: 0.33, hb: 0.72, wild: 1.0 }, // chartreuse-indigo
    { h: 0.0, hb: 0.5, wild: 0.75 }, // crimson-cyan split
    { h: 0.66, hb: 0.33, wild: 0.95 } // electric orchid
  ];

  function hashText(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  function pickMood(seedText) {
    speakCount += 1;
    const seed = hashText(seedText + '|' + speakCount + '|' + performance.now());
    const roll = (seed * 7.13) % 1;

    // ~40% invent a wild new color blend; otherwise walk the spectrum
    if (roll > 0.6) {
      const exo = EXOTIC[Math.floor(seed * EXOTIC.length) % EXOTIC.length];
      // mutate so it's never the same twice
      return {
        hue: (exo.h + seed * 0.17 + speakCount * 0.07) % 1,
        hueB: (exo.hb + seed * 0.31) % 1,
        wild: Math.min(1, exo.wild * (0.85 + seed * 0.2))
      };
    }

    // Spectrum walk with golden-angle step + secondary complement
    const step = 0.38196601125; // golden conjugate
    const next = (targetHue + step + (seed - 0.5) * 0.12) % 1;
    return {
      hue: (next + 1) % 1,
      hueB: (next + 0.38 + seed * 0.2) % 1,
      wild: 0.1 + seed * 0.45
    };
  }

  function hueToRgb(h, s, l) {
    h = ((h % 1) + 1) % 1;
    const a = s * Math.min(l, 1 - l);
    const f = (n) => {
      const k = (n + h * 12) % 12;
      return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    };
    return [
      Math.round(f(0) * 255),
      Math.round(f(8) * 255),
      Math.round(f(4) * 255)
    ];
  }

  function syncAura() {
    const aura = document.getElementById('aura');
    const root = document.documentElement;
    const [r, g, b] = hueToRgb(hue, 0.85, 0.55);
    const [r2, g2, b2] = hueToRgb(hueB, 0.8, 0.5);
    const [rh, gh, bh] = hueToRgb((hue + 0.05) % 1, 0.7, 0.78);
    if (aura) {
      const a1 = 0.18 + glowBoost * 0.22;
      const a2 = 0.12 + glowBoost * 0.14;
      aura.style.background = `
        radial-gradient(ellipse 55% 45% at 50% 42%, rgba(${r},${g},${b},${a1}), transparent 60%),
        radial-gradient(ellipse 70% 50% at 35% 55%, rgba(${r2},${g2},${b2},${a2}), transparent 55%),
        radial-gradient(ellipse 80% 60% at 50% 100%, rgba(20, 40, 90, 0.55), transparent 55%),
        linear-gradient(180deg, rgba(3, 6, 15, 0.15) 0%, rgba(3, 6, 15, 0.55) 70%, rgba(3, 6, 15, 0.92) 100%)
      `;
      aura.style.transition = 'background 0.9s ease, opacity 0.6s ease';
      aura.style.opacity = String(0.85 + Math.min(0.15, glowBoost * 0.2));
    }
    root.style.setProperty('--glow', `rgb(${r},${g},${b})`);
    root.style.setProperty('--glow-soft', `rgba(${r},${g},${b},0.4)`);
    root.style.setProperty('--glow-hot', `rgb(${rh},${gh},${bh})`);
  }

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = Math.floor(canvas.clientWidth * dpr);
    const h = Math.floor(canvas.clientHeight * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  }

  window.addEventListener('mousemove', (e) => {
    targetMouse[0] = (e.clientX / window.innerWidth) * 2 - 1;
    targetMouse[1] = -((e.clientY / window.innerHeight) * 2 - 1);
  });

  function frame(now) {
    resize();
    const t = (now - start) / 1000;

    mouse[0] += (targetMouse[0] - mouse[0]) * 0.04;
    mouse[1] += (targetMouse[1] - mouse[1]) * 0.04;
    energy += (targetEnergy - energy) * 0.06;
    glowBoost += (targetGlow - glowBoost) * 0.08;
    // shortest-path hue lerp
    let dh = ((targetHue - hue + 1.5) % 1) - 0.5;
    hue = (hue + dh * 0.08 + 1) % 1;
    let dhb = ((targetHueB - hueB + 1.5) % 1) - 0.5;
    hueB = (hueB + dhb * 0.07 + 1) % 1;
    wild += (targetWild - wild) * 0.06;
    pulse *= 0.955;
    targetGlow *= 0.985;

    if (window.CrystalAudio && typeof window.CrystalAudio.getPulse === 'function') {
      const ap = window.CrystalAudio.getPulse();
      pulse = Math.max(pulse, ap);
    }

    if (Math.floor(now / 80) !== Math.floor((now - 16) / 80)) syncAura();

    gl.disable(gl.DEPTH_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);
    gl.clear(gl.COLOR_BUFFER_BIT);

    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.uniform1f(uTime, t);
    gl.uniform1f(uPulse, pulse);
    gl.uniform1f(uEnergy, energy);
    gl.uniform2f(uMouse, mouse[0], mouse[1]);
    gl.uniform1f(uHue, hue);
    gl.uniform1f(uHueB, hueB);
    gl.uniform1f(uWild, wild);
    gl.uniform1f(uGlowBoost, glowBoost);
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);
  syncAura();

  function flare(amount = 1) {
    pulse = Math.min(1.8, pulse + amount);
    targetGlow = Math.min(1.6, targetGlow + amount * 0.9);
    targetEnergy = Math.min(1.2, targetEnergy + amount * 0.55);
    setTimeout(() => {
      targetEnergy = Math.max(0.08, targetEnergy - amount * 0.4);
    }, 1400);
  }

  window.CrystalVisual = {
    strike(amount = 0.8) {
      flare(amount);
    },
    /** Speak to the crystal — glow hard and shift into a new (or invented) color */
    resonate(text = '', amount = 1.15) {
      const mood = pickMood(text);
      targetHue = mood.hue;
      targetHueB = mood.hueB;
      targetWild = mood.wild;
      flare(amount);
      syncAura();
      return mood;
    },
    setEnergy(v) {
      targetEnergy = Math.max(0, Math.min(1.2, v));
    },
    thinking(on) {
      targetEnergy = on ? 0.55 : 0.1;
      if (on) targetGlow = Math.max(targetGlow, 0.35);
    },
    getMood() {
      return { hue, hueB, wild, glowBoost };
    }
  };
})();
