// -------------------------------------------------------------
// VRショッピングモール – Corridor v2
// Three r160 / Vite / TypeScript
// 通路の左右にお店が並び、正面＝通路中央を向く構成
// -------------------------------------------------------------
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

// ============ 基本パラメータ ============
const FLOOR_W = 26;           // 通路の総幅
const AISLE_W = 8;            // 中央灰色帯の幅
const CORRIDOR_LEN = 180;     // 通路長（Z方向）
const BOOTH_DEPTH = 7.5;      // ブースの奥行
const BOOTH_WIDTH = 10.0;     // ブースの幅
const BOOTH_GAP = 22;         // ブース間のZ方向距離
const WALL_H = 3.2;           // 背面壁高さ
const SOFFIT_H = 3.8;         // 袖壁・看板高さ

// DOM ready
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  // ============ レンダラ / シーン / カメラ ============
  const app = document.getElementById("app") as HTMLDivElement | null;
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace as any;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 1000);
  const ENTRANCE_POS = new THREE.Vector3(0, 3.2, 52);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ============ ライティング ============
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.55));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(18, 24, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ============ 通路床・サイドウォール・天井っぽいライト ============
  addCorridor(scene);

  // ============ クリック判定 ============
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  // 本屋の目の前へテレポ位置
  let booksTeleport: { pos: THREE.Vector3; tgt: THREE.Vector3 } = {
    pos: ENTRANCE_POS.clone(),
    tgt: ENTRANCE_TGT.clone(),
  };

  // ============ ラベルスプライト ============
  function labelSprite(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 256;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#adb5c1";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#1f2937";
    ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic', sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    // 看板は横長
    spr.scale.set(10, 2.5, 1);
    return spr;
  }

  // ============ ブース作成 ============
  // お店は左右に並べ、**必ず通路中央(=x=0)の方を向く**ように配置します
  function addBooth({ side, z, name, items }: Booth) {
    const x = side === "left" ? -(FLOOR_W * 0.5 - 4.3) : +(FLOOR_W * 0.5 - 4.3);
    const group = new THREE.Group();

    // ブース基壇（店前の平台）
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(BOOTH_WIDTH + 3, 0.25, BOOTH_DEPTH + 2),
      new THREE.MeshStandardMaterial({ color: 0x70777f, roughness: 1 })
    );
    pad.position.set(x, 0.12, z);
    pad.castShadow = true;
    pad.receiveShadow = true;
    group.add(pad);

    // U字型の「店舗枠」：背面＋左右の袖壁。**開口は通路中央側**
    const material = new THREE.MeshStandardMaterial({ color: 0x171b21, roughness: 0.95 });

    // 背面
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(BOOTH_WIDTH, WALL_H, 0.3),
      material
    );
    // 通路中央から見て、背面は奥（左右どちらもxの外側）
    const backOffset = side === "left" ? +(BOOTH_DEPTH * 0.5) : -(BOOTH_DEPTH * 0.5);
    back.position.set(x + (side === "left" ? -0.01 : +0.01), WALL_H * 0.5, z + backOffset);
    back.castShadow = true;
    back.receiveShadow = true;
    group.add(back);

    // 左袖
    const sideL = new THREE.Mesh(
      new THREE.BoxGeometry(0.35, WALL_H, BOOTH_DEPTH),
      material
    );
    // 右袖
    const sideR = sideL.clone();

    const sx = x - (BOOTH_WIDTH * 0.5) + 0.2;
    const rx = x + (BOOTH_WIDTH * 0.5) - 0.2;
    sideL.position.set(sx, WALL_H * 0.5, z);
    sideR.position.set(rx, WALL_H * 0.5, z);
    sideL.castShadow = sideR.castShadow = true;
    sideL.receiveShadow = sideR.receiveShadow = true;
    group.add(sideL, sideR);

    // 庇（看板受け）
    const soffit = new THREE.Mesh(
      new THREE.BoxGeometry(BOOTH_WIDTH + 0.6, 0.25, 1.0),
      new THREE.MeshStandardMaterial({ color: 0x2b313a, roughness: 0.8 })
    );
    const soffitZ = z + (side === "left" ? -BOOTH_DEPTH * 0.5 + 0.5 : +BOOTH_DEPTH * 0.5 - 0.5);
    soffit.position.set(x, SOFFIT_H, soffitZ);
    soffit.castShadow = true;
    soffit.receiveShadow = true;
    group.add(soffit);

    // 看板（Sprite）…通路中央側を向く
    const label = labelSprite(name);
    label.position.set(x, SOFFIT_H + 0.7, soffitZ + (side === "left" ? 0.55 : -0.55));
    label.material.rotation = side === "left" ? 0 : Math.PI; // 文字が中央へ向く
    group.add(label);

    // 商品パネル（背面側の内壁に3枚）
    const loader = new THREE.TextureLoader();
    const slotZ = z + (side === "left" ? +BOOTH_DEPTH * 0.5 - 0.55 : -BOOTH_DEPTH * 0.5 + 0.55);
    const spacing = (BOOTH_WIDTH - 2.4) / (items.length + 1);

    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      tex.colorSpace = THREE.SRGBColorSpace;
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      panel.position.set(x - (BOOTH_WIDTH * 0.5) + spacing * (i + 1) + 1.2, 1.6, slotZ);
      // 通路中央から背面に向け置く（＝面は正面を通路側へ）
      panel.rotation.y = side === "left" ? Math.PI : 0;
      panel.userData = it;
      panel.castShadow = true;
      clickable.push(panel);
      group.add(panel);
    });

    // ちょっとした什器（店前の台）
    const table = new THREE.Mesh(
      new THREE.BoxGeometry(3.2, 0.7, 1.6),
      new THREE.MeshStandardMaterial({ color: 0x242931, roughness: 0.9 })
    );
    table.position.set(x + (side === "left" ? +2.0 : -2.0), 0.35, z + (side === "left" ? -2.2 : +2.2));
    table.castShadow = true;
    table.receiveShadow = true;
    group.add(table);

    scene.add(group);

    // 本屋のテレポ位置（看板が視界に入る距離）
    if (name === "Books") {
      const pos = new THREE.Vector3(
        x + (side === "left" ? -6.0 : +6.0),
        2.6,
        z + (side === "left" ? -6.0 : +6.0)
      );
      const tgt = new THREE.Vector3(x, 1.6, z);
      booksTeleport = { pos, tgt };
    }
  }

  // BOOTHS の z は手前(+)から奥(-)へ進む想定。必要に応じて反転してください。
  BOOTHS.forEach(addBooth);

  // ============ 右パネル（詳細） ============
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

  // ============ クリック / タップ ============
  function pick(ev: MouseEvent | TouchEvent) {
    const t = (ev as TouchEvent).changedTouches?.[0];
    const px = t ? t.clientX : (ev as MouseEvent).clientX;
    const py = t ? t.clientY : (ev as MouseEvent).clientY;

    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((py - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length) openDetail(hits[0].object.userData as Item);
  }
  renderer.domElement.addEventListener("click", pick);
  renderer.domElement.addEventListener("touchend", (e) => { pick(e); e.preventDefault(); }, { passive: false });

  // ============ テレポート ============
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }

  // ボタン
  const goEntrance = document.getElementById("goEntrance") as HTMLButtonElement | null;
  const goBooks = document.getElementById("goBooks") as HTMLButtonElement | null;
  const resetBtn = document.getElementById("reset") as HTMLButtonElement | null;
  const viewLeft = document.getElementById("viewLeft") as HTMLButtonElement | null;
  const viewRight = document.getElementById("viewRight") as HTMLButtonElement | null;
  const askBtn = document.getElementById("askAI") as HTMLButtonElement | null;

  goEntrance && (goEntrance.onclick = () => jumpTo(ENTRANCE_POS, ENTRANCE_TGT));
  goBooks && (goBooks.onclick = () => jumpTo(booksTeleport.pos, booksTeleport.tgt));
  resetBtn && (resetBtn.onclick = () => {
    camera.position.set(0, 4.0, 24);
    controls.target.set(0, 1.6, 0);
    controls.update();
  });
  viewLeft && (viewLeft.onclick = () => {
    camera.position.set(-FLOOR_W * 0.5 + 3, 3.2, 8);
    controls.target.set(0, 1.6, -6);
    controls.update();
  });
  viewRight && (viewRight.onclick = () => {
    camera.position.set(FLOOR_W * 0.5 - 3, 3.2, 8);
    controls.target.set(0, 1.6, -6);
    controls.update();
  });

  // AI問い合わせ（CORSで失敗しても落ちないように）
  askBtn?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;
    askBtn.disabled = true;
    askBtn.textContent = "問い合わせ中…";
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
      askBtn.disabled = false;
      askBtn.textContent = "AIに聞く";
    }
  });

  // ============ レイアウト更新 / ループ ============
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

  // ====== 通路の床/壁/天井ライト ======
  function addCorridor(target: THREE.Scene) {
    // メイン床（広い台形風グラデはストライプで表現）
    const baseMat = new THREE.MeshStandardMaterial({ color: 0x8a9096, roughness: 1 });
    const base = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_W, CORRIDOR_LEN),
      baseMat
    );
    base.rotation.x = -Math.PI / 2;
    base.position.set(0, 0, 0);
    base.receiveShadow = true;
    target.add(base);

    // 中央の帯
    const mid = new THREE.Mesh(
      new THREE.PlaneGeometry(AISLE_W, CORRIDOR_LEN),
      new THREE.MeshStandardMaterial({ color: 0x757c83, roughness: 1 })
    );
    mid.rotation.x = -Math.PI / 2;
    mid.position.set(0, 0.001, 0);
    mid.receiveShadow = true;
    target.add(mid);

    // ストライプ（薄暗い帯をさらに左右に）
    const stripeMat = new THREE.MeshStandardMaterial({ color: 0x646a71, roughness: 1 });
    [-1, +1].forEach((s) => {
      const stripe = new THREE.Mesh(new THREE.PlaneGeometry((FLOOR_W - AISLE_W) * 0.5 - 1.2, CORRIDOR_LEN), stripeMat);
      stripe.rotation.x = -Math.PI / 2;
      stripe.position.set((AISLE_W * 0.5 + ((FLOOR_W - AISLE_W) * 0.25)) * s, 0.0005, 0);
      stripe.receiveShadow = true;
      target.add(stripe);
    });

    // サイド壁（通路を囲う低い壁）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0e12, roughness: 1 });
    const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, CORRIDOR_LEN + 40), wallMat);
    const sideWallR = sideWallL.clone();
    sideWallL.position.set(-FLOOR_W / 2, 1.1, 0);
    sideWallR.position.set(+FLOOR_W / 2, 1.1, 0);
    sideWallL.castShadow = sideWallR.castShadow = true;
    sideWallL.receiveShadow = sideWallR.receiveShadow = true;
    target.add(sideWallL, sideWallR);

    // 天井ライト風のパネル（実際は発光しない白パネル＋ライト）
    const panelMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    for (let i = 0; i < 7; i++) {
      const lightZ = -10 - i * 20;
      const plate = new THREE.Mesh(new THREE.PlaneGeometry(AISLE_W * 0.9, 2.0), panelMat);
      plate.rotation.x = Math.PI / 2; // 上向き
      plate.position.set(0, 6.0, lightZ);
      target.add(plate);

      const lt = new THREE.RectAreaLight(0xffffff, 2.2, AISLE_W * 0.85, 1.2);
      lt.position.set(0, 5.8, lightZ);
      lt.rotation.x = -Math.PI / 2;
      target.add(lt);
    }

    // ベンチ（中央に数個）
    const benchMat = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 1 });
    for (let i = 0; i < 6; i++) {
      const z = 8 - i * 14;
      const bench = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 0.9), benchMat);
      bench.position.set(0, 0.18, z);
      bench.castShadow = true;
      bench.receiveShadow = true;
      target.add(bench);
    }
  }
});
