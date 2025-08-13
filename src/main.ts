import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/** ====== レイアウト定数（好みで調整） ====== */
const CORRIDOR_HALF = 7.5;     // 通路の片側幅（中心から壁まで）
const BOOTH_DEPTH   = 3.2;     // 店の奥行き
const LABEL_HEIGHT  = 3.3;
const CAM_HEIGHT    = 2.8;
const CAM_CENTER_X  = 0;       // 通路センター
const VIEW_OFFSET_X = 2.8;     // 左右の店を見るとき、通路中心からの横ズレ
const APPROACH      = 3.8;     // 店に近づく距離（正面から見る距離）

/** DOM ready */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  // ====== Three.js 基本 ======
  const app = document.getElementById("app")!;
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 2000);
  camera.position.set(0, CAM_HEIGHT, 26);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.set(0, 1.8, 0);

  // ====== ライト & 床 ======
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(10,16,8);
  scene.add(dir);

  // 床（中央カーペット＋サイド）
  const floorAll = new THREE.Mesh(
    new THREE.PlaneGeometry(60, 180),
    new THREE.MeshStandardMaterial({ color: 0xbec3c7, roughness: 1 })
  );
  floorAll.rotation.x = -Math.PI/2;
  floorAll.position.z = -10;
  scene.add(floorAll);

  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 170),
    new THREE.MeshStandardMaterial({ color: 0x9aa2a9, roughness: 1 })
  );
  carpet.rotation.x = -Math.PI/2;
  carpet.position.set(0, 0.01, -10);
  scene.add(carpet);

  // ====== クリック判定（商品） ======
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  // ====== 店の追加 ======
  type Built = { name: string; side: "left"|"right"; z: number; front: THREE.Vector3 };
  const BUILT: Built[] = [];

  function labelSprite(text: string) {
    const cvs = document.createElement("canvas");
    cvs.width = 512; cvs.height = 128;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#1f2937"; ctx.fillRect(0,0,512,128);
    ctx.font = "bold 46px system-ui, sans-serif";
    ctx.fillStyle = "#e5e7eb"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(cvs);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
    spr.scale.set(7, 1.7, 1);
    return spr;
  }

  /**
   * 通路の左右に、正面を通路中心へ向けて店を作る
   * x は固定、z で前後。壁（正面）は常に中心 x=0 向き。
   */
  function addBooth({ side, z, name, items }: Booth) {
    // 左右のレーン：左=-10, 右=+10 に配置
    const x = side === "left" ? -10 : 10;
    const group = new THREE.Group();
  
    // 台座
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(10, 0.2, 4),
      new THREE.MeshStandardMaterial({ color: 0x8b98a7, roughness: 1 })
    );
    base.position.set(x, 0.1, z);
    base.receiveShadow = true;
    group.add(base);
  
    // 柱
    const pillar = new THREE.Mesh(
      new THREE.BoxGeometry(1.1, 6, 1.1),
      new THREE.MeshStandardMaterial({ color: 0x5f6d7a, roughness: 1 })
    );
    pillar.position.set(x, 3, z);
    pillar.castShadow = true;
    pillar.receiveShadow = true;
    group.add(pillar);
  
    // ── 看板（全ブース同じ向きに） ─────────────────────
    // Canvas で横書き→板ポリを90度回して縦っぽく見せます
    const labelCanvas = document.createElement("canvas");
    labelCanvas.width = 512;
    labelCanvas.height = 128;
    const lctx = labelCanvas.getContext("2d")!;
    lctx.fillStyle = "#5f6d7a";
    lctx.fillRect(0, 0, labelCanvas.width, labelCanvas.height);
    lctx.font = "bold 80px system-ui, sans-serif";
    lctx.fillStyle = "#ffffff";
    lctx.textAlign = "center";
    lctx.textBaseline = "middle";
    lctx.fillText(name, labelCanvas.width / 2, labelCanvas.height / 2);
  
    const labelTex = new THREE.CanvasTexture(labelCanvas);
    labelTex.colorSpace = THREE.SRGBColorSpace;
    const label = new THREE.Mesh(
      new THREE.PlaneGeometry(2.8, 7.2),
      new THREE.MeshBasicMaterial({ map: labelTex, toneMapped: false, side: THREE.DoubleSide })
    );
    // 柱の手前（通路側）に寄せる
    const towardCenterX = side === "left" ? x + 0.8 : x - 0.8;
    label.position.set(towardCenterX, 3.4, z);
  
    // ★ ポイント：向きを全ブースで統一（通路方向＝+Zに向ける）
    // すべて同じ向き：通路に沿って縦置き（横から見たときに文字が読める）
    // 横向きに板を回して縦看板っぽく
    label.rotation.y = Math.PI / 2;   // ← 左右どちらでも固定で同じ向き
    group.add(label);
  
    // ── 商品パネル（通路の中心に向ける＝両側で対称） ────────
    const loader = new THREE.TextureLoader();
    const imgPanel = new THREE.Mesh(
      new THREE.PlaneGeometry(2.2, 2.2),
      new THREE.MeshBasicMaterial({ color: 0x000000 })
    );
    // パネルの土台（見栄え）
    const panelBack = new THREE.Mesh(
      new THREE.BoxGeometry(0.25, 2.6, 2.6),
      new THREE.MeshStandardMaterial({ color: 0x111519, roughness: 0.6 })
    );
  
    const panelX = side === "left" ? x + 2.2 : x - 2.2;
    imgPanel.position.set(panelX, 1.6, z);
    panelBack.position.set(panelX, 1.6, z);
  
    // ★ ポイント：パネルは通路の中心に向ける（左右で対称）
    imgPanel.rotation.y = side === "left" ? -Math.PI / 2 : Math.PI / 2;
    panelBack.rotation.y = imgPanel.rotation.y;
  
    // 1枚目だけ表示（複数にしたければ forEach で）
    if (items[0]) {
      const tex = loader.load(items[0].image);
      tex.colorSpace = THREE.SRGBColorSpace;
      (imgPanel.material as THREE.MeshBasicMaterial).map = tex;
      (imgPanel.material as THREE.MeshBasicMaterial).toneMapped = false;
      imgPanel.userData = items[0]; // クリック用
    }
  
    clickable.push(imgPanel);
    group.add(panelBack, imgPanel);
  
    scene.add(group);
  
    // 本屋のテレポ位置（入口/本屋ボタン用）
    if (name === "Books") {
      booksTeleport = {
        pos: new THREE.Vector3(0, 2.8, z - 10),
        tgt: new THREE.Vector3(x, 2.2, z),
      };
    }
  }


  // ====== 商品ディテールパネル ======
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

  // ====== クリックで商品を拾う ======
  function pick(ev: MouseEvent | TouchEvent) {
    const t = (ev as TouchEvent).changedTouches?.[0];
    const px = t ? t.clientX : (ev as MouseEvent).clientX;
    const py = t ? t.clientY : (ev as MouseEvent).clientY;
    const r = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - r.left) / r.width) * 2 - 1;
    mouse.y = -((py - r.top) / r.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length) openDetail(hits[0].object.userData as Item);
  }
  renderer.domElement.addEventListener("click", pick);
  renderer.domElement.addEventListener("touchend", e => { pick(e); e.preventDefault(); }, { passive:false });

  // ====== 左右の店を正面から見る ======
  function findNearest(side: "left"|"right") {
    // 現在の z に一番近い同サイドの店
    let best: Built | null = null;
    let bestDz = Infinity;
    for (const b of BUILT) {
      if (b.side !== side) continue;
      const dz = Math.abs(b.z - camera.position.z);
      if (dz < bestDz) { best = b; bestDz = dz; }
    }
    return best;
  }

  function viewSide(side: "left"|"right") {
    const tgt = findNearest(side);
    if (!tgt) return;

    // 視点位置：通路中心から少し寄せ、店の正面から
    const aim = tgt.front.clone();
    const camX = side === "left" ? CAM_CENTER_X - VIEW_OFFSET_X : CAM_CENTER_X + VIEW_OFFSET_X;
    // 店の正面まで近づく
    const dirToCenter = new THREE.Vector3(
      side === "left" ? +1 : -1, 0, 0
    ).normalize();

    camera.position.set(camX, CAM_HEIGHT, aim.z - 0); // 同じ z
    // さらに店へ近づく（x を店側へ）
    camera.position.addScaledVector(dirToCenter, APPROACH);
    controls.target.copy(aim);
    controls.update();
  }

  (document.getElementById("viewLeft")  as HTMLButtonElement)?.addEventListener("click", () => viewSide("left"));
  (document.getElementById("viewRight") as HTMLButtonElement)?.addEventListener("click", () => viewSide("right"));

  // 既存の入口/本屋/リセットボタンはそのまま動作させるならここに接続

  // ====== ループ & リサイズ ======
  addEventListener("resize", () => {
    camera.aspect = innerWidth/innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });

  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();
});
