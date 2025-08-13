// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/* ------------------------- small helpers ------------------------- */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

// Y だけカメラへ向ける（自然なビルボード）
function lookAtCameraY(obj: THREE.Object3D, camera: THREE.Camera) {
  const wp = obj.getWorldPosition(new THREE.Vector3());
  const v = new THREE.Vector3(camera.position.x, wp.y, camera.position.z);
  obj.lookAt(v);
}

// テクスチャ付き両面プレーン（ラベル）
function makeBillboardLabel(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#9aa3af"; // 明るめグレー台座
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#0b0f1a";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic', sans-serif";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;

  const mat = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, transparent: true });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 0.9), mat);
  (mesh as any).__billboard = true;
  return mesh;
}

/* ----------------------------- main ------------------------------ */
ready(() => {
  /* ---------- renderer / scene / camera ---------- */
  const app = document.getElementById("app")!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  const ENTRANCE_POS = new THREE.Vector3(0, 3.0, 26);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  /* ---------- env: lights ---------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(12, 16, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  dir.shadow.camera.near = 0.5;
  dir.shadow.camera.far = 100;
  scene.add(dir);

  /* ---------- env: floor, lanes, side-walls ---------- */
  const hallWidth = 28;
  const hallDepth = 90;

  // main floor
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(hallWidth, hallDepth),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  floor.position.set(0, 0, 0);
  scene.add(floor);

  // central darker carpet
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(6.5, hallDepth),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 1 })
  );
  carpet.rotation.x = -Math.PI / 2;
  carpet.position.set(0, 0.002, 0);
  carpet.receiveShadow = true;
  scene.add(carpet);

  // side lanes
  const laneMat = new THREE.MeshStandardMaterial({ color: 0x70757a, roughness: 1 });
  const laneW = 5.5;
  const laneL = new THREE.Mesh(new THREE.PlaneGeometry(laneW, hallDepth), laneMat);
  laneL.rotation.x = -Math.PI / 2;
  laneL.position.set(-8.5, 0.001, 0);
  laneL.receiveShadow = true;
  scene.add(laneL);

  const laneR = laneL.clone();
  laneR.position.x = 8.5;
  scene.add(laneR);

  // side walls (遠近の雰囲気)
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b1220, roughness: 1, metalness: 0 });
  const wallL = new THREE.Mesh(new THREE.PlaneGeometry(hallDepth, 6), wallMat);
  wallL.rotation.y = Math.PI / 2;
  wallL.rotation.z = Math.PI / 2;
  wallL.position.set(-hallWidth / 2 - 0.01, 3, 0);
  wallL.receiveShadow = true;
  scene.add(wallL);

  const wallR = wallL.clone();
  wallR.position.x = hallWidth / 2 + 0.01;
  wallR.rotation.y = -Math.PI / 2;
  scene.add(wallR);

  // simple benches (オブジェクトに陰影)
  function addBench(z: number) {
    const w = 2.2, h = 0.35, d = 0.7;
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.7 })
    );
    seat.castShadow = true; seat.receiveShadow = true;
    seat.position.set(0, h / 2, z);
    scene.add(seat);
  }
  [-24, -12, 0, 12, 24].forEach(addBench);

  /* ---------- shops ---------- */
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  let booksTeleport = { pos: ENTRANCE_POS.clone(), tgt: ENTRANCE_TGT.clone() };

  function addShop({ side, z, name, items }: Booth) {
    // サイドレーンのX位置
    const x = side === "left" ? -8.5 : 8.5;
    const group = new THREE.Group();
    group.position.set(x, 0, z);

    // 壁台（ショーウィンドウ）
    const platform = new THREE.Mesh(
      new THREE.BoxGeometry(6.2, 0.25, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 0.6 })
    );
    platform.position.set(0, 0.125, side === "left" ? 2.2 : -2.2);
    platform.castShadow = true; platform.receiveShadow = true;
    group.add(platform);

    // 柱
    const pillarHeight = 3.6;
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(0.6, pillarHeight, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x374151, roughness: 0.8 })
    );
    pillar.position.set(0, pillarHeight / 2, 0.0);
    pillar.castShadow = true; pillar.receiveShadow = true;
    group.add(pillar);

    // 看板（両面）+ 枠 + 看板用ライト
    const labelFront = makeBillboardLabel(name);
    labelFront.position.set(0, pillarHeight * 0.95, side === "left" ? 0.3 : -0.3);
    group.add(labelFront);

    const labelBack = makeBillboardLabel(name);
    labelBack.position.set(0, pillarHeight * 0.95, side === "left" ? -0.3 : 0.3);
    group.add(labelBack);

    const frame = new THREE.Mesh(
      new THREE.PlaneGeometry(3.8, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x111827, emissive: 0x0c111b, metalness: 0.2, roughness: 0.7 })
    );
    frame.position.copy(labelFront.position);
    frame.position.z += side === "left" ? -0.01 : 0.01;
    group.add(frame);

    const signLight = new THREE.SpotLight(0xffffff, 0.35, 6, Math.PI / 5, 0.4);
    signLight.position.set(0, pillarHeight, side === "left" ? 0.9 : -0.9);
    signLight.target = frame;
    group.add(signLight, signLight.target);

    // 商品パネル（壁と平行）
    const loader = new THREE.TextureLoader();
    const spacing = 6.0 / (items.length + 1);
    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(1.8, 1.8),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      // 壁面に平行（左=+90°, 右=-90°）
      quad.rotation.set(0, side === "left" ? Math.PI / 2 : -Math.PI / 2, 0);
      quad.position.set(
        -3 + spacing * (i + 1),
        1.55,
        side === "left" ? 2.25 : -2.25
      );
      quad.userData = it;
      quad.castShadow = true;
      clickable.push(quad);
      group.add(quad);
    });

    scene.add(group);

    if (name === "Books") {
      const pos = new THREE.Vector3(side === "left" ? -7.0 : 7.0, 2.8, z + (side === "left" ? 6.5 : -6.5));
      const tgt = new THREE.Vector3(x, 1.6, z);
      booksTeleport = { pos, tgt };
    }
  }

  BOOTHS.forEach(addShop);

  /* ---------- right side info panel ---------- */
  function openDetail({ title, price, desc, image, url }: Item) {
    const wrap = document.getElementById("detail");
    if (!wrap) return;
    (document.getElementById("dTitle") as HTMLHeadingElement).textContent = title || "Item";
    (document.getElementById("dImg") as HTMLImageElement).src = image || "";
    (document.getElementById("dPrice") as HTMLParagraphElement).textContent = price || "価格未設定";
    (document.getElementById("dDesc") as HTMLParagraphElement).textContent = desc || "説明";
    (document.getElementById("dLink") as HTMLAnchorElement).href = url || "#";
    wrap.style.transform = "translateX(0%)";
  }
  (document.getElementById("closeDetail") as HTMLButtonElement)?.addEventListener("click", () => {
    (document.getElementById("detail") as HTMLElement).style.transform = "translateX(100%)";
  });

  function pick(ev: MouseEvent | TouchEvent) {
    const isTouch = (ev as TouchEvent).changedTouches?.length;
    const px = isTouch
      ? (ev as TouchEvent).changedTouches[0].clientX
      : (ev as MouseEvent).clientX;
    const py = isTouch
      ? (ev as TouchEvent).changedTouches[0].clientY
      : (ev as MouseEvent).clientY;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length) openDetail(hits[0].object.userData as Item);
  }
  renderer.domElement.addEventListener("click", pick);
  renderer.domElement.addEventListener("touchend", (e) => { pick(e); e.preventDefault(); }, { passive: false });

  /* ---------- UI buttons ---------- */
  function jump(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }
  document.getElementById("goEntrance")?.addEventListener("click", () => jump(ENTRANCE_POS, ENTRANCE_TGT));
  document.getElementById("goBooks")?.addEventListener("click", () => jump(booksTeleport.pos, booksTeleport.tgt));
  document.getElementById("reset")?.addEventListener("click", () => {
    camera.position.set(0, 3.2, 12);
    controls.target.set(0, 1.6, 0);
    controls.update();
  });
  document.getElementById("viewLeft")?.addEventListener("click", () => {
    jump(new THREE.Vector3(-7.0, 2.8, 6), new THREE.Vector3(-7.0, 1.6, 0));
  });
  document.getElementById("viewRight")?.addEventListener("click", () => {
    jump(new THREE.Vector3(7.0, 2.8, 6), new THREE.Vector3(7.0, 1.6, 0));
  });

  // AI に聞く（CORS 設定済みの Vercel 側 /api/concierge を想定）
  document.getElementById("askAI")?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;
    const btn = document.getElementById("askAI") as HTMLButtonElement;
    btn.disabled = true; btn.textContent = "問い合わせ中…";
    try {
      const r = await fetch("https://vr-mall-api.vercel.app/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context: { where: "corridor" } }),
      });
      const data = await r.json();
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e: any) {
      alert("通信エラー: " + (e?.message || e));
    } finally {
      btn.disabled = false; btn.textContent = "AIに聞く";
    }
  });

  /* ---------- resize / loop ---------- */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (function animate() {
    requestAnimationFrame(animate);

    // ビルボード（ラベル）はYだけカメラへ向ける
    scene.traverse((obj) => {
      if ((obj as any).__billboard) lookAtCameraY(obj, camera);
    });

    controls.update();
    renderer.render(scene, camera);
  })();
});
