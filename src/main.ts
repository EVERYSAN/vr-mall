// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

// -----------------------------------------------------
// 画面準備
// -----------------------------------------------------
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  console.log("boot main.ts");

  // DOM
  const app = document.getElementById("app");
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  // Renderer
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  app.appendChild(renderer.domElement);
  console.log("canvas appended", renderer.domElement);

  // Scene / Camera / Controls
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 3000);
  const ENTRANCE_POS = new THREE.Vector3(0, 3.2, 45);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // -----------------------------------------------------
  // 環境ライティング
  // -----------------------------------------------------
  const hemi = new THREE.HemisphereLight(0xffffff, 0x223, 0.5);
  scene.add(hemi);

  const dir = new THREE.DirectionalLight(0xffffff, 0.8);
  dir.position.set(15, 25, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // -----------------------------------------------------
  // 床・通路・天井
  // -----------------------------------------------------
  const CORRIDOR_LEN = 200;   // 通路の長さ
  const CORRIDOR_W = 22;      // 通路の幅
  const STRIP_W = 4;          // 中央帯幅

  // 床（大きなフロア）
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(CORRIDOR_W * 2.5, CORRIDOR_LEN * 1.5),
    new THREE.MeshStandardMaterial({ color: 0x9ca3af, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 通路中央の帯
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(STRIP_W, CORRIDOR_LEN),
    new THREE.MeshStandardMaterial({ color: 0x6b7280, roughness: 1 })
  );
  strip.rotation.x = -Math.PI / 2;
  strip.position.set(0, 0.002, 0);
  strip.receiveShadow = true;
  scene.add(strip);

  // サイドの薄い帯（歩行帯イメージ）
  const sideL = new THREE.Mesh(
    new THREE.PlaneGeometry(STRIP_W, CORRIDOR_LEN),
    new THREE.MeshStandardMaterial({ color: 0x7d8592, roughness: 1 })
  );
  sideL.rotation.x = -Math.PI / 2;
  sideL.position.set(-STRIP_W - 3, 0.0015, 0);
  sideL.receiveShadow = true;
  scene.add(sideL);

  const sideR = sideL.clone();
  sideR.position.x = STRIP_W + 3;
  scene.add(sideR);

  // 天井
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(CORRIDOR_W * 2.5, CORRIDOR_LEN * 1.5),
    new THREE.MeshStandardMaterial({ color: 0x636a74, roughness: 0.9 })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.y = 10;
  ceiling.receiveShadow = false;
  scene.add(ceiling);

  // 天井照明（ソフトなスポット）
  for (let i = -80; i <= 80; i += 40) {
    const light = new THREE.SpotLight(0xffffff, 0.65, 60, Math.PI / 5, 0.6, 1.5);
    light.position.set(0, 10, i);
    light.target.position.set(0, 0, i);
    scene.add(light);
    scene.add(light.target);
  }

  // ベンチ
  function addBench(x: number, z: number) {
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(2.5, 0.2, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x4b5563, roughness: 0.8 })
    );
    base.position.set(x, 0.1, z);
    base.castShadow = true;
    base.receiveShadow = true;
    scene.add(base);

    const legL = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 0.4, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x475569 })
    );
    legL.position.set(x - 1, 0.3, z);
    const legR = legL.clone();
    legR.position.x = x + 1;
    scene.add(legL, legR);
  }
  for (let z = -60; z <= 60; z += 20) addBench(0, z);

  // -----------------------------------------------------
  // 店舗ユーティリティ
  // -----------------------------------------------------
  // 看板スプライト（縦長の柱＋横読みテキスト）
  function makePillarLabel(text: string, height: number) {
    // 柱
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.2, height, 1.2),
      new THREE.MeshStandardMaterial({ color: 0x667080, roughness: 1 })
    );
    pillar.castShadow = true;
    pillar.receiveShadow = true;

    // 文字（縦に表示：スプライト）
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 512;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#667080";
    ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = "#e5e7eb";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.save();
    ctx.translate(128, 256);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 0, 0);
    ctx.restore();
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(2.4, 4.8, 1);
    spr.position.set(0, height * 0.55, 0); // 柱の少し上

    const grp = new THREE.Group();
    grp.add(pillar, spr);
    return grp;
  }

  // 商品パネル（壁掛け）
  const textureLoader = new THREE.TextureLoader();
  function makeItemPanel(it: Item, leftSide: boolean) {
    const t = textureLoader.load(it.image);
    (t as any).colorSpace = (THREE as any).SRGBColorSpace;
    const panel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
    );
    // 通路中央に面を向ける（左右で内向き）
    panel.rotation.y = leftSide ? -Math.PI / 2 : Math.PI / 2;
    panel.userData = it;
    panel.castShadow = true;
    return panel;
  }

  // 一時保存
  const clickable: THREE.Object3D[] = [];
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  // 目標地点（本屋）
  let booksTeleport = {
    pos: ENTRANCE_POS.clone(),
    tgt: ENTRANCE_TGT.clone(),
  };

  // 店舗生成：通路の左右（left/right）に等間隔で配置
  const LANE_X = 10.5;          // 店の奥行方向の位置（左右）
  const FIRST_Z = -60;          // 最初の店のZ
  const STEP_Z = 24;            // 店と店の間隔
  const BASE_PAD = { w: 8, d: 4 };

  function addShop(i: number, booth: Booth) {
    const leftSide = booth.side === "left";
    const x = leftSide ? -LANE_X : LANE_X;
    const z = FIRST_Z + STEP_Z * i;

    const group = new THREE.Group();

    // 店舗の床ベース
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(BASE_PAD.w, 0.25, BASE_PAD.d),
      new THREE.MeshStandardMaterial({ color: 0x808996, roughness: 1 })
    );
    base.position.set(x, 0.125, z);
    base.receiveShadow = true;
    group.add(base);

    // 看板の柱（高さは少し差をつけるとモールっぽい）
    const pillarH = 4 + (i % 2) * 2;
    const label = makePillarLabel(booth.name, pillarH);
    label.position.set(x + (leftSide ? 1.6 : -1.6), pillarH / 2, z);
    group.add(label);

    // 商品パネル（柱の通路側に 3つ）
    const spacing = BASE_PAD.w / (booth.items.length + 1);
    booth.items.forEach((it, idx) => {
      const px = x + (leftSide ? 2.2 : -2.2); // 柱の外側
      const pz = z - BASE_PAD.d / 2 + spacing * (idx + 1);
      const panel = makeItemPanel(it, leftSide);
      panel.position.set(px, 1.5, pz);
      clickable.push(panel);
      group.add(panel);
    });

    // Books の目の前テレポ座標
    if (booth.name.toLowerCase() === "books") {
      const pos = new THREE.Vector3(leftSide ? -2 : 2, 2.6, z + (leftSide ? 7 : -7));
      const tgt = new THREE.Vector3(x, 1.6, z);
      booksTeleport = { pos, tgt };
    }

    scene.add(group);
  }

  // 並べる（左→右→左→右…のように BOOTHS 側で side を決めておけばOK）
  BOOTHS.forEach((b, i) => addShop(i, b));

  // -----------------------------------------------------
  // 右サイド詳細パネル（既存のHTML要素を使用）
  // -----------------------------------------------------
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

  // クリック（タップ）で商品ヒット
  function pick(ev: MouseEvent | TouchEvent) {
    const isTouch = (ev as TouchEvent).changedTouches?.length;
    const px = isTouch ? (ev as TouchEvent).changedTouches[0].clientX : (ev as MouseEvent).clientX;
    const py = isTouch ? (ev as TouchEvent).changedTouches[0].clientY : (ev as MouseEvent).clientY;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length) openDetail(hits[0].object.userData as Item);
  }
  renderer.domElement.addEventListener("click", pick);
  renderer.domElement.addEventListener("touchend", (e) => { pick(e); e.preventDefault(); }, { passive: false });

  // -----------------------------------------------------
  // テレポート系ボタン
  // -----------------------------------------------------
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }

  (document.getElementById("goEntrance") as HTMLButtonElement)?.addEventListener("click", () => {
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  });
  (document.getElementById("goBooks") as HTMLButtonElement)?.addEventListener("click", () => {
    jumpTo(booksTeleport.pos, booksTeleport.tgt);
  });
  (document.getElementById("reset") as HTMLButtonElement)?.addEventListener("click", () => {
    camera.position.set(0, 4, 18);
    controls.target.set(0, 1.6, 0);
    controls.update();
  });

  // 左右を見る（少しだけ横に移動）
  (document.getElementById("viewLeft") as HTMLButtonElement)?.addEventListener("click", () => {
    const offset = new THREE.Vector3(-6, 0, 0);
    jumpTo(camera.position.clone().add(offset), controls.target.clone().add(offset));
  });
  (document.getElementById("viewRight") as HTMLButtonElement)?.addEventListener("click", () => {
    const offset = new THREE.Vector3(6, 0, 0);
    jumpTo(camera.position.clone().add(offset), controls.target.clone().add(offset));
  });

  // -----------------------------------------------------
  // 「AIに聞く」ボタン（Vercel API）
  // -----------------------------------------------------
  (document.getElementById("askAI") as HTMLButtonElement)?.addEventListener("click", async () => {
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
      const data = await r.json().catch(() => null);
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e) {
      alert("通信エラー: " + (e as Error).message);
    } finally {
      btn.disabled = false; btn.textContent = "AIに聞く";
    }
  });

  // -----------------------------------------------------
  // ループ & リサイズ
  // -----------------------------------------------------
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
