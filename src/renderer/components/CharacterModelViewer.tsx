import React, { useEffect, useRef, useState } from 'react';

interface CharacterModelViewerProps {
  src: string;
  label: string;
  mode: string;
}

export default function CharacterModelViewer({ src, label, mode }: CharacterModelViewerProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [state, setState] = useState<'standby' | 'loading' | 'ready' | 'error'>('standby');
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || shouldLoad) return undefined;

    if (!('IntersectionObserver' in window)) {
      setShouldLoad(true);
      return undefined;
    }

    const observer = new IntersectionObserver((entries) => {
      if (!entries.some((entry) => entry.isIntersecting)) return;
      setShouldLoad(true);
      observer.disconnect();
    }, { root: null, rootMargin: '160px 0px', threshold: 0.04 });

    observer.observe(host);
    return () => observer.disconnect();
  }, [shouldLoad]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !shouldLoad) return undefined;

    let cleanup: (() => void) | undefined;
    let disposed = false;
    setState('loading');

    void (async () => {
      const THREE = await import('three');
      const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
      if (disposed) return;

      let frame = 0;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
      camera.position.set(0, 1.02, 5.25);

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      renderer.domElement.setAttribute('aria-label', label);
      host.appendChild(renderer.domElement);

      const modelRoot = new THREE.Group();
      scene.add(modelRoot);
      scene.add(new THREE.HemisphereLight(0xd6fff6, 0x001417, 1.7));
      const key = new THREE.DirectionalLight(0xe0ff4f, 2.2);
      key.position.set(2.8, 4.2, 3.4);
      scene.add(key);
      const rim = new THREE.DirectionalLight(0x6e5bb0, 1.4);
      rim.position.set(-3.2, 2.2, -2.8);
      scene.add(rim);

      const resize = () => {
        const rect = host.getBoundingClientRect();
        const width = Math.max(1, Math.floor(rect.width));
        const height = Math.max(1, Math.floor(rect.height));
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        renderer.setSize(width, height, false);
      };
      const observer = new ResizeObserver(resize);
      observer.observe(host);
      resize();

      const loader = new GLTFLoader();
      loader.load(
        src,
        (gltf) => {
          if (disposed) return;
          const model = gltf.scene;
          const box = new THREE.Box3().setFromObject(model);
          const size = box.getSize(new THREE.Vector3());
          const center = box.getCenter(new THREE.Vector3());
          const maxAxis = Math.max(size.x, size.y, size.z, 0.001);
          model.position.sub(center);
          model.scale.setScalar(2.15 / maxAxis);
          model.rotation.y = -0.22;
          modelRoot.add(model);
          setState('ready');
        },
        undefined,
        () => {
          if (!disposed) setState('error');
        },
      );

      const animate = () => {
        if (disposed) return;
        modelRoot.rotation.y += 0.0035;
        modelRoot.position.y = Math.sin(performance.now() / 1500) * 0.035;
        renderer.render(scene, camera);
        frame = window.requestAnimationFrame(animate);
      };
      frame = window.requestAnimationFrame(animate);

      cleanup = () => {
        window.cancelAnimationFrame(frame);
        observer.disconnect();
        modelRoot.traverse((object) => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry?.dispose();
          const materials = Array.isArray(object.material) ? object.material : [object.material];
          materials.forEach((material) => material.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      };
    })().catch(() => {
      if (!disposed) setState('error');
    });

    return () => {
      disposed = true;
      cleanup?.();
    };
  }, [label, shouldLoad, src]);

  return (
    <>
      <div className="px-character-orbit" aria-hidden="true" />
      <div className="px-character-ground" aria-hidden="true" />
      <div ref={hostRef} className="px-character-glb" data-state={state} />
      {state !== 'ready' && (
        <div className="px-character-model px-character-model-fallback" aria-hidden="true">
          <span className="head" />
          <span className="torso" />
          <span className="arm left" />
          <span className="arm right" />
          <span className="leg left" />
          <span className="leg right" />
        </div>
      )}
      <div className="px-character-model-note">
        <span>{state === 'ready' ? 'GLB active' : state === 'loading' ? 'GLB loading' : state === 'standby' ? 'GLB standby' : 'GLB fallback'}</span>
        <strong>{mode}</strong>
      </div>
    </>
  );
}
