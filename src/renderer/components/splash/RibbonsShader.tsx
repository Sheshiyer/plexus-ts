import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
  Volumetric ribbon raymarch (decoded from a compact shadertoy form).
  NOTE: WebGL1 / GLSL ES 1.00 has no built-in tanh() — we supply tanh3().
*/
const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

#define T u_time
#define R u_resolution

vec3 tanh3(vec3 x){
  vec3 e = exp(-2.0 * x);
  return (1.0 - e) / (1.0 + e);
}

void main() {
  vec2 fragCoord = gl_FragCoord.xy;
  vec3 O = vec3(0.0);
  float z = 0.0;
  float d;

  for (int i = 0; i < 99; i++) {
    vec3 p = z * normalize(vec3(R.x, R.y, R.y) - 2.0 * vec3(fragCoord.x, fragCoord.y, 0.0));
    d = 2.0;

    for (int j = 0; j < 6; j++) {
      d /= 0.9;
      p = p.zxy + sin(p * d + d + T * 0.5) / d;
      z += d = 0.001 + abs(2.0 - mix(z, p.z, 0.4)) / 9.0;
    }

    O += (sin(z + 0.06 * float(i) + vec3(0.0, 1.0, 2.0)) + 1.0) / d;
  }

  O = tanh3(O / 30000.0);

  // Cambium grade: gun-metal teal shadows rising to chartreuse, mint glints on peaks.
  vec3 col = O * vec3(1.05, 1.35, 0.38);
  col += vec3(0.0, 0.10, 0.115);
  col = mix(col, vec3(0.88, 1.0, 0.92), pow(max(O.g - 0.45, 0.0), 1.2) * 0.85);
  col = pow(col, vec3(0.85));

  gl_FragColor = vec4(col, 1.0);
}
`;

interface Props {
  onComplete?: () => void;
  minDuration?: number;
  style?: React.CSSProperties;
}

export default function RibbonsShader({ onComplete, minDuration = 2000, style }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    // Splash callers complete on a timer; persistent backgrounds omit onComplete.
    const timer = onComplete ? setTimeout(onComplete, minDuration) : undefined;
    let resize = () => {};

    const canvas = canvasRef.current;
    const gl = canvas?.getContext('webgl', { antialias: false, alpha: false });

    if (canvas && gl) {
      resize = () => {
        const dpr = Math.min(window.devicePixelRatio, 1.5);
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        gl.viewport(0, 0, canvas.width, canvas.height);
      };
      resize();
      window.addEventListener('resize', resize);

      const compile = (type: number, src: string): WebGLShader | null => {
        const s = gl.createShader(type);
        if (!s) return null;
        gl.shaderSource(s, src);
        gl.compileShader(s);
        if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
          console.error('[RibbonsShader] compile error:', gl.getShaderInfoLog(s));
          gl.deleteShader(s);
          return null;
        }
        return s;
      };

      const vs = compile(gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);

      if (vs && fs) {
        const prog = gl.createProgram()!;
        gl.attachShader(prog, vs);
        gl.attachShader(prog, fs);
        gl.linkProgram(prog);

        if (gl.getProgramParameter(prog, gl.LINK_STATUS)) {
          gl.useProgram(prog);

          const buf = gl.createBuffer();
          gl.bindBuffer(gl.ARRAY_BUFFER, buf);
          gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
          const posLoc = gl.getAttribLocation(prog, 'position');
          gl.enableVertexAttribArray(posLoc);
          gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);

          const uTime = gl.getUniformLocation(prog, 'u_time');
          const uRes = gl.getUniformLocation(prog, 'u_resolution');
          startTimeRef.current = performance.now();

          const render = () => {
            // +9s offset so the raymarch is already evolved when the brief splash appears.
            const elapsed = (performance.now() - startTimeRef.current) / 1000 + 9.0;
            gl.uniform1f(uTime, elapsed);
            gl.uniform2f(uRes, canvas.width, canvas.height);
            gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
            rafRef.current = requestAnimationFrame(render);
          };
          rafRef.current = requestAnimationFrame(render);
        } else {
          console.error('[RibbonsShader] link error:', gl.getProgramInfoLog(prog));
        }
      }
    }

    return () => {
      cancelAnimationFrame(rafRef.current);
      if (timer) clearTimeout(timer);
      window.removeEventListener('resize', resize);
    };
  }, [onComplete, minDuration]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        zIndex: 9999,
        cursor: 'default',
        pointerEvents: 'none',
        ...style,
      }}
    />
  );
}
