// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/* -------------------------------------------------------
  Boot when DOM is ready
------------------------------------------------------- */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

/* -------------------------------------------------------
  Scene setup
------------------------------------------------------- */
ready(() => {
  console.log("boot main.ts");

  const app = document.getElementById("app");
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  // 廊下の手前から奥（+Z）へ伸びる。初期はやや俯瞰
  const ENTRANCE_POS = new THREE.Vector3(0, 3.0, -12);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 12);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  /* -------------------------------------------------------
    Lights / ceiling
  ------------------------------------------------------- */
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223344, 0.6));

  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-6, 14, -6);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  scene.add(key);

  // 天井（暗め）+ 連続する蛍光灯パネル
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 240),
    new THREE.MeshStandardMaterial({ color: 0x1b2534, roughness: 1 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, 10, 60);
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 10; i++) {
    const lx = 0, ly = 9.9, lz = 12 + i * 18;
    const lamp = new THREE.Mesh(new THREE.PlaneGeometry(14, 1.6), lightMat);
    lamp.position.set(lx, ly, lz);
    lamp.rotation.x = Math.PI / 2;
    lamp.renderOrder = 2;
    scene.add(lamp);
  }

  /* -------------------------------------------------------
    Corridor (floor + runner + side slopes)
  ------------------------------------------------------- */
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 240),
    new THREE.MeshStandardMaterial({ color: 0x9aa0a6, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 60);
  floor.receiveShadow = true;
  scene.add(floor);

  // 中央の濃いランナー
  const runner = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 240),
    new THREE.MeshStandardMaterial({ color: 0x6e737a, roughness: 1 })
  );
  runner.rotation.x = -Math.PI / 2;
  runner.position.set(0, 0.001, 60);
  runner.receiveShadow = true;
  scene.add(runner);

  // ランナーの脇に薄い帯(視覚的な奥行き)
  for (const x of [-12, 12]) {
    const band = new THREE.Mesh(
      new THREE.PlaneGeometry(12, 240),
      new THREE.MeshStandardMaterial({ color: 0x7b8189, roughness: 1 })
    );
    band.rotation.x = -Math.PI / 2;
    band.position.set(x, 0.002, 60);
    band.receiveShadow = true;
    scene.add(band);
  }

  // 手すり/ベンチ（簡易）
  const benches: THREE.Mesh[] = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(
      new THREE.BoxGeometry(2.6, 0.2, 0.8),
      new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 0.8 })
    );
    b.castShadow = true;
    b.receiveShadow = true;
    const z = 18 + i * 24;
    b.position.set(0, 0.25, z);
    benches.push(b);
    scene.add(b);
  }

  /* -------------------------------------------------------
    Picking (クリックで右パネル)
  ------------------------------------------------------- */
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  function openDetail({ title, price, desc, image, url }: Item) {
    const wrap = document.getElementById("detail")!;
    (document.getElementById("dTitle") as HTMLHeadingElement).textContent = title || "Item";
    (document.getElementById("dImg") as HTMLImageElement).src = image || "";
    (document.getElementById("dPrice") as HTMLParagraphElement).textContent = price || "価格未設定";
    (document.getElementById("dDesc") as HTMLParagraphElement).textContent = desc || "説明";
    (document.getElementById("dLink") as HTMLAnchorElement).href = url || "#";
    wrap.style.transform = "translateX(0%)";
  }
  (document.getElementById("closeDetail") as HTMLButtonElement).onclick = () => {
    (document.getElementById("detail") as HTMLElement).style.transform = "translateX(100%)";
  };

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
  renderer.domElement.addEventListener(
    "touchend",
    (e) => {
      pick(e);
      e.preventDefault();
    },
    { passive: false }
  );

  /* -------------------------------------------------------
    Shop module (facing corridor)
    - どのブースも「ローカル +Z が正面」になるよう作成してから
      Y回転で通路向きに向ける（左=-90° / 右=+90°）
  ------------------------------------------------------- */
  type Teleport = { pos: THREE.Vector3; tgt: THREE.Vector3 };
  const TELEPORTS: Record<string, Teleport> = {};

  const loader = new THREE.TextureLoader();

  function makeLabel(text: string) {
    const cvs = document.createElement("canvas");
    cvs.width = 1024;
    cvs.height = 256;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#c9d0d8";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.font = "bold 120px system-ui, sans-serif";
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cvs.width / 2, cvs.height / 2);
    const tex = new THREE.CanvasTexture(cvs);
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(8, 2),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    mesh.position.set(0, 3.3, 1.6); // 正面上部（+Z）
    return mesh;
  }

  function addBooth({ side, z, name, items }: Booth) {
    const group = new THREE.Group();

    // モジュール寸法（ローカル +Z が通路正面）
    const W = 8; // 間口
    const D = 6; // 奥行
    const H = 3; // 壁高さ

    // ベース（タイル＋段差）
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(W, 0.25, D),
      new THREE.MeshStandardMaterial({ color: 0x6f7680, roughness: 1 })
    );
    base.position.set(0, 0.12, 0);
    base.receiveShadow = true;
    group.add(base);

    // 前縁の段
    const lip = new THREE.Mesh(
      new THREE.BoxGeometry(W + 2, 0.12, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x50555c, roughness: 1 })
    );
    lip.position.set(0, 0.06, D / 2 + 0.3);
    lip.receiveShadow = true;
    group.add(lip);

    // 壁（背面+左右） ―― 正面(+Z)は開けておく
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 1 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(W, H, 0.2), wallMat);
    back.position.set(0, H / 2, -D / 2);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    const left = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), wallMat);
    left.position.set(-W / 2, H / 2, 0);
    left.castShadow = true;
    left.receiveShadow = true;
    group.add(left);

    const right = new THREE.Mesh(new THREE.BoxGeometry(0.2, H, D), wallMat);
    right.position.set(W / 2, H / 2, 0);
    right.castShadow = true;
    right.receiveShadow = true;
    group.add(right);

    // 看板
    const label = makeLabel(name);
    group.add(label);

    // 展示パネル（背面に貼る）: ローカル +Z 正面に向いて配置
    const spacing = W / (items.length + 1);
    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.0, 2.0),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      panel.position.set(-W / 2 + spacing * (i + 1), 1.6, -D / 2 + 0.12); // 背面に密着
      // そのまま（ローカル +Z を向く）。グループ回転で通路へ向く
      panel.userData = it;
      panel.castShadow = true;
      clickable.push(panel);
      group.add(panel);
    });

    // グループの世界座標配置
    const x = side === "left" ? -14 : 14;
    group.position.set(x, 0, z);
    // 通路（中心 x=0）に顔を向ける：左=-90°, 右=+90°
    group.rotation.y = side === "left" ? -Math.PI / 2 : Math.PI / 2;

    scene.add(group);

    // テレポート座標（お店の少し前）
    const look = new THREE.Vector3(0, 1.6, 1.2).applyEuler(group.rotation).add(group.position);
    const pos = new THREE.Vector3(0, 2.2, -4.6).applyEuler(group.rotation).add(group.position);
    TELEPORTS[name.toLowerCase()] = { pos, tgt: look };
  }

  // すべて追加
  BOOTHS.forEach(addBooth);

  /* -------------------------------------------------------
    UI (teleport & AI)
  ------------------------------------------------------- */
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }

  (document.getElementById("goEntrance") as HTMLButtonElement).onclick = () =>
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT);

  (document.getElementById("goBooks") as HTMLButtonElement).onclick = () => {
    const t = TELEPORTS["books"];
    if (t) jumpTo(t.pos, t.tgt);
  };

  (document.getElementById("reset") as HTMLButtonElement).onclick = () => {
    camera.position.set(0, 3.0, 6);
    controls.target.set(0, 1.6, 24);
    controls.update();
  };

  (document.getElementById("seeLeft") as HTMLButtonElement | null)?.addEventListener("click", () => {
    jumpTo(new THREE.Vector3(-10, 2.4, 10), new THREE.Vector3(0, 1.6, 24));
  });
  (document.getElementById("seeRight") as HTMLButtonElement | null)?.addEventListener("click", () => {
    jumpTo(new THREE.Vector3(10, 2.4, 10), new THREE.Vector3(0, 1.6, 24));
  });

  // AI ボタン（Vercel の /api/concierge に POST）
  (document.getElementById("askAI") as HTMLButtonElement | null)?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;

    const ask = document.getElementById("askAI") as HTMLButtonElement;
    ask.disabled = true;
    ask.textContent = "問い合わせ中…";
    try {
      const r = await fetch("https://vr-mall-api.vercel.app/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context: { where: "corridor" } }),
      });
      const data = await r.json();
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e) {
      alert("通信エラー: " + (e as Error).message);
    } finally {
      ask.disabled = false;
      ask.textContent = "AIに聞く";
    }
  });

  /* -------------------------------------------------------
    Resize & loop
  ------------------------------------------------------- */
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (function animate() {
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
});
