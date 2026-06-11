import React, { useEffect, useRef } from 'react';

const VERTEX_SHADER = `
attribute vec2 position;
void main() {
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/*
  Original compact form:
  f z,d,i
  @(99) {
    f3 p = z * nor(R.xyy-2*C.rgb)
    d=2
    @(6)
    d /= .9,
    p = p.zxy+sin(p*d+d+T/2) / d
    z += d = .001+abs(2.-mix(z,p.z,.4))/9
    O += (sin(z+.06*i+++f4(,1,2,)) + 1) / d
  }
  O = tanh(O / 3e4)

  Decoded to standard GLSL:
  - f = float
  - f3 = vec3
  - f4 = vec4
  - nor = normalize
  - R = iResolution
  - C = fragCoord
  - T = iTime
  - O = fragColor
  - @(N) = for loop N times
*/

const FRAGMENT_SHADER = `
precision highp float;

uniform float u_time;
uniform vec2 u_resolution;

#define T u_time
#define R u_resolution

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
  
  O = tanh(O / 30000.0);
  
  // Color grade for Plexus dark theme
  vec3 col = O * vec3(0.12, 0.32, 0.55);
  col += vec3(0.015, 0.025, 0.045);
  col = pow(col, vec3(0.92));
  
  gl_FragColor = vec4(col, 1.0);
}
`;

interface Props {
  onComplete: () => void;
  minDuration?: number;
}

export default function RibbonsShader({ onComplete, minDuration = 2000 }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { antialias: false, alpha: false });
    if (!gl) return;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio, 2);
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!;
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(s));
      }
      return s;
    };

    const prog = gl.createProgram()!;
    gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERTEX_SHADER));
    gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAGMENT_SHADER));
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(prog));
    }
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
      const elapsed = (performance.now() - startTimeRef.current) / 1000;
      gl.uniform1f(uTime, elapsed);
      gl.uniform2f(uRes, canvas.width, canvas.height);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      rafRef.current = requestAnimationFrame(render);
    };
    rafRef.current = requestAnimationFrame(render);

    const timer = setTimeout(() => {
      onComplete();
    }, minDuration);

    return () => {
      cancelAnimationFrame(rafRef.current);
      clearTimeout(timer);
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
      }}
    />
  );
}
