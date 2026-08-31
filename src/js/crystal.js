/**
 * Living crystal — raymarched octahedral lattice with reactive glow.
 * Pulse / hue driven by audio & chat energy.
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

    #define MAX_STEPS 96
    #define MAX_DIST 40.0
    #define SURF 0.0012

    mat2 rot(float a) {
      float c = cos(a), s = sin(a);
      return mat2(c, -s, s, c);
    }

    float sdOctahedron(vec3 p, float s) {
      p = abs(p);
      return (p.x + p.y + p.z - s) * 0.57735027;
    }

    float sdBox(vec3 p, vec3 b) {
      vec3 q = abs(p) - b;
      return length(max(q, 0.0)) + min(max(q.x, max(q.y, q.z)), 0.0);
    }

    float hash(vec3 p) {
      p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
      p *= 17.0;
      return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
    }

    float map(vec3 p) {
      float t = u_time;
      float breathe = 1.0 + 0.04 * sin(t * 1.3) + 0.03 * u_pulse;

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

      // inner lattice
      vec3 lp = q * 3.2;
      float lat = length(mod(lp + 0.5, 1.0) - 0.5) - 0.08;
      lat = max(core + 0.08, -lat);

      float d = min(core, shell);
      d = min(d, shards);
      d = min(d, max(core, lat * 0.4));

      // floor reflection hint
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

    vec3 palette(float x) {
      vec3 a = vec3(0.15, 0.35, 0.55);
      vec3 b = vec3(0.45, 0.55, 0.35);
      vec3 c = vec3(1.0, 1.0, 1.0);
      vec3 d = vec3(0.15, 0.35, 0.55);
      return a + b * cos(6.28318 * (c * x + d));
    }

    vec3 render(vec2 uv) {
      float aspect = u_res.x / u_res.y;
      vec2 p = uv;
      p.x *= aspect;

      // camera — crystal sits mid-left visually on wide layouts
      float camZ = 5.2 - u_energy * 0.35;
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

        // volumetric glow near surface
        glowAccum += 0.018 / (0.04 + abs(d));
        if (d < SURF) {
          hit = 1.0;
          break;
        }
        if (t > MAX_DIST) break;
        t += d * 0.85;
      }

      vec3 bg = vec3(0.01, 0.02, 0.05);
      float stars = pow(hash(vec3(floor(uv * u_res * 0.4), 1.0)), 40.0);
      bg += stars * vec3(0.6, 0.8, 1.0) * 0.35;

      if (hit > 0.5) {
        vec3 pos = ro + rd * t;
        vec3 nor = calcNormal(pos);
        vec3 ref = reflect(rd, nor);

        // material — crystalline ice-gold
        float fres = pow(1.0 - max(dot(nor, -rd), 0.0), 3.0);
        vec3 base = mix(vec3(0.25, 0.7, 0.95), vec3(0.95, 0.78, 0.45), fres * 0.65);
        base = mix(base, palette(pos.y * 0.35 + u_time * 0.05 + u_pulse * 0.2), 0.35);

        vec3 light1 = normalize(vec3(0.6, 0.9, 0.4));
        vec3 light2 = normalize(vec3(-0.8, 0.3, -0.2));
        float dif1 = max(dot(nor, light1), 0.0);
        float dif2 = max(dot(nor, light2), 0.0) * 0.45;
        float spe = pow(max(dot(ref, light1), 0.0), 48.0);
        float sh = softShadow(pos + nor * 0.02, light1);
        float ao = calcAO(pos, nor);

        // inner fire
        float inner = exp(-abs(map(pos - nor * 0.15)) * 8.0);
        vec3 fire = vec3(0.3, 0.85, 1.0) * (0.4 + 0.6 * u_pulse) + vec3(1.0, 0.7, 0.3) * u_energy * 0.5;

        col = base * (0.12 + dif1 * sh * 0.85 + dif2) * ao;
        col += spe * vec3(1.0, 0.95, 0.85) * sh;
        col += fres * vec3(0.6, 0.9, 1.0) * 0.55;
        col += fire * inner * (0.55 + u_energy * 0.8);

        // floor fade
        if (pos.y < -2.2) {
          float fog = smoothstep(-2.4, -1.8, pos.y);
          col = mix(bg, col * 0.3, fog);
        }

        // distance fog
        float fogAmt = 1.0 - exp(-0.012 * t * t);
        col = mix(col, bg, fogAmt * 0.45);
      } else {
        col = bg;
      }

      // bloom-ish outer glow
      vec3 glowCol = mix(vec3(0.2, 0.7, 1.0), vec3(1.0, 0.75, 0.35), u_energy);
      col += glowCol * glowAccum * (0.02 + 0.015 * u_pulse) * (0.35 + 0.65 * hit);

      // vignette soft
      float vig = smoothstep(1.4, 0.2, length(uv * vec2(aspect * 0.6, 1.0)));
      col *= 0.55 + 0.45 * vig;

      // tonemap
      col = col / (1.0 + col * 0.35);
      col = pow(col, vec3(0.92));

      return col;
    }

    void main() {
      vec2 uv = (gl_FragCoord.xy - 0.5 * u_res) / u_res.y;
      // slight offset so crystal sits left of chat on desktop
      uv.x += (u_res.x > u_res.y * 1.1) ? 0.22 : 0.0;
      uv.y += 0.08;

      vec3 col = render(uv);

      // soft alpha for blend mode
      float alpha = clamp(length(col) * 1.4, 0.0, 1.0);
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

  let pulse = 0;
  let energy = 0;
  let targetEnergy = 0;
  let mouse = [0, 0];
  let targetMouse = [0, 0];
  let start = performance.now();

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
    energy += (targetEnergy - energy) * 0.05;
    pulse *= 0.96;

    // audio pulse from CrystalAudio if present
    if (window.CrystalAudio && typeof window.CrystalAudio.getPulse === 'function') {
      const ap = window.CrystalAudio.getPulse();
      pulse = Math.max(pulse, ap);
    }

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
    gl.drawArrays(gl.TRIANGLES, 0, 3);

    requestAnimationFrame(frame);
  }

  requestAnimationFrame(frame);

  window.CrystalVisual = {
    strike(amount = 0.8) {
      pulse = Math.min(1.5, pulse + amount);
      targetEnergy = Math.min(1, targetEnergy + amount * 0.4);
      setTimeout(() => {
        targetEnergy = Math.max(0, targetEnergy - amount * 0.35);
      }, 1200);
    },
    setEnergy(v) {
      targetEnergy = Math.max(0, Math.min(1, v));
    },
    thinking(on) {
      targetEnergy = on ? 0.55 : 0.08;
    }
  };
})();
