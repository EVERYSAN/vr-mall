// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/** DOM が描画されてから初期化する */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  console.log("boot main.ts");

  // ---------- 基本セットアップ ----------
  const app = document.getElementById("app");
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // three r160 以降
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);
  // デバッグ: キャンバスが付いたことを確認
  console.log("canvas appended", renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
  // 入口（通路手前）から開始
  const ENTRANCE_POS = new THREE.Vector3(0, 3.2, 30);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ---------- ライト ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10, 16, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ---------- 床・通路 ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(50, 80),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  const aisle = new THREE.Mesh(
    new THREE.PlaneGeometry(8, 80),
    new THREE.MeshStandardMaterial({ color: 0xd1d5db, roughness: 1 })
  );
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.001, 0);
  aisle.receiveShadow = true;
  scene.add(aisle);

  // ---------- クリック判定 ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  // 本屋の目の前へテレポ
  let booksTeleport: { pos: THREE.Vector3; tgt: THREE.Vector3 } = {
    pos: ENTRANCE_POS.clone(),
    tgt: ENTRANCE_TGT.clone(),
  };

  // ---------- ラベル（店名） ----------
  function labelSprite(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#0b0f1a";
    ctx.fillRect(0, 0, 512, 128);
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.fillStyle = "#e5e7eb";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(7, 1.7, 1);
    return spr;
  }

  // ---------- ブース生成 ----------
  function addBooth({ side, z, name, items }: Booth) {
    const x = side === "left" ? -10 : 10;
    const group = new THREE.Group();

    const base = new THREE.Mesh(
      new THREE.BoxGeometry(12, 0.25, 5),
      new THREE.MeshStandardMaterial({ color: 0x94a3b8, roughness: 1 })
    );
    base.position.set(x, 0.125, z);
    base.receiveShadow = true;
    group.add(base);

    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(12, 3.5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x1f2937, roughness: 1 })
    );
    wall.position.set(x, 1.8, z - (side === "left" ? -2.3 : 2.3)); // 通路側へ
    wall.castShadow = true;
    wall.receiveShadow = true;
    group.add(wall);

    const label = labelSprite(name);
    label.position.set(x, 3.7, z - (side === "left" ? -2.5 : 2.5));
    group.add(label);

    const loader = new THREE.TextureLoader();
    const spacing = 12 / (items.length + 1);

    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2.4, 2.4),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );

      const faceZ = side === "left" ? 2.05 : -2.05;
      const labelOffset = side === "left" ? 0.15 : -0.15;

      quad.position.set(x - 6 + spacing * (i + 1), 1.6, z + faceZ);
      quad.rotation.y = side === "left" ? Math.PI : 0; // 左側は反転して通路に向ける
      quad.userData = it; // {title, price, desc, image, url}
      quad.castShadow = true;
      clickable.push(quad);
      group.add(quad);

      label.position.z = z + faceZ + labelOffset;
    });

    scene.add(group);

    if (name === "Books") {
      const pos = new THREE.Vector3(side === "left" ? -4 : 4, 2.6, z + (side === "left" ? 6.8 : -6.8));
      const tgt = new THREE.Vector3(x, 1.6, z + (side === "left" ? 2.0 : -2.0));
      booksTeleport = { pos, tgt };
    }
  }

  BOOTHS.forEach(addBooth);

  // ---------- 右パネル ----------
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

  // ---------- クリック・タップ ----------
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

  // ---------- テレポート ----------
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }
  (document.getElementById("goEntrance") as HTMLButtonElement).onclick = () =>
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  (document.getElementById("goBooks") as HTMLButtonElement).onclick = () =>
    jumpTo(booksTeleport.pos, booksTeleport.tgt);
  (document.getElementById("reset") as HTMLButtonElement).onclick = () => {
    camera.position.set(0, 4, 14);
    controls.target.set(0, 1.6, 0);
    controls.update();
  };

  // ---------- リサイズ & ループ ----------
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
  // ---- AIに聞く（VercelのAPIへPOST） ----
  const askBtn = document.getElementById("askAI") as HTMLButtonElement | null;
  askBtn?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;
  
    askBtn.disabled = true;
    askBtn.textContent = "問い合わせ中…";
    try {
      const r = await fetch("https://vr-mall-api.vercel.app/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: q,
          context: { where: "entrance" }, // 位置など任意
        }),
      });
      const data = await r.json();
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e) {
      alert("通信エラー: " + (e as Error).message);
    } finally {
      askBtn.disabled = false;
      askBtn.textContent = "AIに聞く";
    }
  });

});
