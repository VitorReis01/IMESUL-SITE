"use client";

// Camada 3D carregada sob demanda pelo ProjectSelector.
// Usa GLBs de public/models/3d e fica oculta em mobile ou com movimento reduzido.
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { scroll3dObjects } from "../data/scroll3dObjects";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

// Pontos visuais do 3D nas secoes: sempre ao lado/acima do texto, com folga para leitura.
const scrollTargets = [
  { anchorId: "project-path", modelId: "telha-metalica", xRatio: 0.86, yOffset: 72, scale: 0.58 },
  { anchorId: "catalog-showcase", modelId: "telha-metalica", xRatio: 0.86, yOffset: 86, scale: 0.56 },
  { anchorId: "material-path", modelId: "perfil-u-simples", xRatio: 0.86, yOffset: 76, scale: 0.6 },
  { anchorId: "quote-steps", modelId: "tubo-quadrado", xRatio: 0.84, yOffset: 78, scale: 0.58 },
];

const getWorldPositionFromViewport = (camera, screenX, screenY) => {
  const visibleHeight = 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.position.z;
  const visibleWidth = visibleHeight * camera.aspect;

  return {
    x: (screenX / window.innerWidth - 0.5) * visibleWidth,
    y: (0.5 - screenY / window.innerHeight) * visibleHeight,
  };
};

const setModelOpacity = (model, opacity) => {
  model.traverse((node) => {
    if (!node.isMesh || !node.material) return;
    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      material.transparent = opacity < 0.98;
      material.opacity = opacity;
      material.depthWrite = opacity > 0.35;
      material.needsUpdate = true;
    });
  });
};

// Centraliza e normaliza cada GLB para que todos ocupem uma escala parecida no scroll.
const normalizeLoadedModel = (model, targetSize) => {
  const box = new THREE.Box3().setFromObject(model);
  const size = new THREE.Vector3();
  const center = new THREE.Vector3();
  box.getSize(size);
  box.getCenter(center);

  const largestSide = Math.max(size.x, size.y, size.z) || 1;
  const scale = targetSize / largestSide;
  model.position.sub(center);
  model.scale.setScalar(scale);
};

// Fallback leve usado apenas se algum GLB falhar, evitando sumiço do efeito.
const createFallbackModel = (targetSize = 3) => {
  const group = new THREE.Group();
  const geometry = new THREE.BoxGeometry(targetSize, targetSize * 0.22, targetSize * 0.22);
  const material = new THREE.MeshStandardMaterial({
    color: 0xb8c0c8,
    metalness: 0.88,
    roughness: 0.32,
  });
  const mesh = new THREE.Mesh(geometry, material);
  group.add(mesh);
  return group;
};

// Camada WebGL dos produtos 3D: fica atrás do conteúdo e troca modelos conforme o scroll.
export default function SteelScrollObject() {
  const layerRef = useRef(null);
  const canvasRef = useRef(null);
  const frameRef = useRef(null);
  const modelsRef = useRef({});
  const modelOpacityRef = useRef({});
  const targetStateRef = useRef({ modelId: null, x: 0, y: 0, scale: 0.8, opacity: 0, strength: 0 });
  const easedStateRef = useRef({ x: 0, y: 0, scale: 0.8, opacity: 0 });
  const idleRotationRef = useRef(0);
  const reducedMotionRef = useRef(false);

  useEffect(() => {
    const layer = layerRef.current;
    const canvas = canvasRef.current;
    if (!layer || !canvas) return undefined;

    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    reducedMotionRef.current = media.matches;

    if (media.matches || window.innerWidth < 1024) {
      layer.style.display = "none";
      return undefined;
    }

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
    camera.position.set(0, 0.2, 7.4);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const root = new THREE.Group();
    scene.add(root);

    const ambient = new THREE.AmbientLight(0xffffff, 1.05);
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.1);
    keyLight.position.set(3.5, 4, 5);
    const redRim = new THREE.PointLight(0xd42b2b, 1.1, 12);
    redRim.position.set(-4, 1.8, 3.5);
    const blueRim = new THREE.PointLight(0x2a5c97, 1.25, 12);
    blueRim.position.set(4.2, -1.2, 3);
    scene.add(ambient, keyLight, redRim, blueRim);

    const loader = new GLTFLoader();
    const loadControllers = [];

    scroll3dObjects.forEach((item) => {
      const group = new THREE.Group();
      group.visible = false;
      root.add(group);
      modelsRef.current[item.id] = group;
      modelOpacityRef.current[item.id] = 0;

      const controller = new AbortController();
      loadControllers.push(controller);

      loader.load(
        item.path,
        (gltf) => {
          if (controller.signal.aborted) return;
          const model = gltf.scene;
          normalizeLoadedModel(model, item.targetSize);
          model.traverse((node) => {
            if (!node.isMesh || !node.material) return;
            node.castShadow = false;
            node.receiveShadow = false;
            if (Array.isArray(node.material)) {
              node.material = node.material.map((material) => {
                const clonedMaterial = material.clone();
                if ("metalness" in clonedMaterial) clonedMaterial.metalness = Math.max(clonedMaterial.metalness ?? 0, 0.74);
                if ("roughness" in clonedMaterial) clonedMaterial.roughness = Math.min(clonedMaterial.roughness ?? 0.42, 0.46);
                return clonedMaterial;
              });
            } else {
              const clonedMaterial = node.material.clone();
              if ("metalness" in clonedMaterial) clonedMaterial.metalness = Math.max(clonedMaterial.metalness ?? 0, 0.74);
              if ("roughness" in clonedMaterial) clonedMaterial.roughness = Math.min(clonedMaterial.roughness ?? 0.42, 0.46);
              node.material = clonedMaterial;
            }
          });
          group.clear();
          group.add(model);
          setModelOpacity(group, 0);
        },
        undefined,
        () => {
          if (controller.signal.aborted) return;
          group.clear();
          group.add(createFallbackModel(item.targetSize));
          setModelOpacity(group, 0);
        }
      );
    });

    // Posiciona o GLB perto dos textos-alvo, mantendo a camada atrás do conteúdo.
    const updateTargetState = () => {
      const viewportHeight = window.innerHeight || 1;
      const focusLine = viewportHeight * 0.42;

      const candidates = scrollTargets
        .map((target) => {
          const anchor = document.getElementById(target.anchorId);
          if (!anchor) return null;

          const rect = anchor.getBoundingClientRect();
          const screenY = rect.top + target.yOffset;
          const screenX = window.innerWidth * target.xRatio;
          const distance = Math.abs(screenY - focusLine);
          const strength = clamp(1 - distance / (viewportHeight * 0.55), 0, 1);
          const world = getWorldPositionFromViewport(camera, screenX, screenY);

          return {
            ...target,
            ...world,
            distance,
            strength,
          };
        })
        .filter(Boolean)
        .sort((left, right) => left.distance - right.distance);

      const active = candidates[0];
      if (!active) {
        targetStateRef.current = { modelId: null, x: 0, y: 0, scale: 0.8, opacity: 0, strength: 0 };
        return;
      }

      const sectionFade = clamp(active.strength * 1.45, 0, 1);
      targetStateRef.current = {
        modelId: active.modelId,
        x: active.x,
        y: active.y,
        scale: active.scale,
        opacity: sectionFade,
        strength: active.strength,
      };
    };

    const resize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.65));
      renderer.setSize(window.innerWidth, window.innerHeight, false);
      updateTargetState();
    };

    const animate = () => {
      const target = targetStateRef.current;
      const eased = easedStateRef.current;
      eased.x += (target.x - eased.x) * 0.08;
      eased.y += (target.y - eased.y) * 0.08;
      eased.scale += (target.scale - eased.scale) * 0.08;
      eased.opacity += (target.opacity - eased.opacity) * 0.08;
      idleRotationRef.current += 0.006;

      layer.style.opacity = String(eased.opacity * 0.5);
      root.position.set(eased.x, eased.y, -0.08);
      root.rotation.set(
        THREE.MathUtils.degToRad(-10 + target.strength * 14),
        THREE.MathUtils.degToRad(-24 + target.strength * 46) + idleRotationRef.current,
        THREE.MathUtils.degToRad(-5 + target.strength * 8)
      );
      root.scale.setScalar(eased.scale);

      scroll3dObjects.forEach((item) => {
        const model = modelsRef.current[item.id];
        if (!model) return;
        const desiredOpacity = item.id === target.modelId ? eased.opacity : 0;
        const currentOpacity = modelOpacityRef.current[item.id] || 0;
        const opacity = currentOpacity + (desiredOpacity - currentOpacity) * 0.12;
        modelOpacityRef.current[item.id] = opacity;
        model.visible = opacity > 0.01;
        setModelOpacity(model, opacity);
      });

      renderer.render(scene, camera);
      frameRef.current = window.requestAnimationFrame(animate);
    };

    updateTargetState();
    window.addEventListener("scroll", updateTargetState, { passive: true });
    window.addEventListener("resize", resize);
    media.addEventListener("change", resize);
    frameRef.current = window.requestAnimationFrame(animate);

    return () => {
      loadControllers.forEach((controller) => controller.abort());
      window.removeEventListener("scroll", updateTargetState);
      window.removeEventListener("resize", resize);
      media.removeEventListener("change", resize);
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      renderer.dispose();
      scene.traverse((node) => {
        if (!node.isMesh) return;
        node.geometry?.dispose();
        const materials = Array.isArray(node.material) ? node.material : [node.material];
        materials.forEach((material) => material?.dispose?.());
      });
      modelsRef.current = {};
      modelOpacityRef.current = {};
    };
  }, []);

  return (
    <div
      ref={layerRef}
      className="steel-scroll-layer pointer-events-none fixed inset-0 z-[1] hidden opacity-0 lg:block"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="h-full w-full" />
      <span className="sr-only">
        {scroll3dObjects.map((item) => item.label).join(", ")}
      </span>
    </div>
  );
}
