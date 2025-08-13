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
    const group = new THREE.Group();

    // 店の基準 x（左は負、右は正）
    const baseX = side === "left"
      ? - (CORRIDOR_HALF - BOOTH_DEPTH * 0.5)
      : + (CORRIDOR_HALF - BOOTH_DEPTH * 0.5);

    // ベース（床のひさし）
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(7, 0.18, 4.2),
      new THREE.MeshStandardMaterial({ color: 0x8fa3b3, roughness: 1 })
    );
    base.position.set(baseX, 0.09, z);
    base.receiveShadow = true;
    group.add(base);

    // 正面の壁（中心へ向けて回転）
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(7, 3.2, 0.18),
      new THREE.MeshStandardMaterial({ color: 0x0f131a, roughness: 1 })
    );
    wall.position.set(baseX, 1.7, z);
    wall.rotation.y = side === "left" ? Math.PI/2 : -Math.PI/2;
    wall.castShadow = wall.receiveShadow = true;
    group.add(wall);

    // 看板
    const label = labelSprite(name);
    label.position.set(baseX, LABEL_HEIGHT, z + (side === "left" ? 0.02 : -0.02));
    label.center.set(0.5, 0); // 下基準
    label.material.rotation = side === "left" ? Math.PI/2 : -Math.PI/2;
    group.add(label);

    // 商品パネル（壁面に貼る）
    const loader = new THREE.TextureLoader();
    const spacing = 7 / (items.length + 1);
    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 1.6),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped:false })
      );

      // 壁の局所座標に合わせてオフセット配置
      const u = -3.5 + spacing * (i + 1);
      // 左側は +X 方向へ面、右側は -X 方向へ面
      if (side === "left") {
        quad.position.set(baseX + 0.11, 1.6, z + u);
        quad.rotation.y = Math.PI/2;
      } else {
        quad.position.set(baseX - 0.11, 1.6, z - u);
        quad.rotation.y = -Math.PI/2;
      }
      quad.userData = it;
      clickable.push(quad);
      group.add(quad);
    });

    scene.add(group);

    // この店の「正面から見る」時の注視点（壁の中央）
    const front = new THREE.Vector3(baseX, 1.6, z);
    BUILT.push({ name, side, z, front });
  }

  // 既存 BOOTHS をそのまま突っ込む（z だけ綺麗に整列してる前提）
  BOOTHS.forEach(addBooth);

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
