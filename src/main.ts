// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

/* ------------ レイアウト初期 ------------ */
type Params = {
  aisleW: number;      // 通路幅
  curbW: number;       // 縁石幅
  shopDepth: number;   // 店の奥行
  shopWidthZ: number;  // 店の幅(Z方向)
  shopGap: number;     // 店舗間隔（Z）
  signH: number;       // 看板高さ
  signTilt: number;    // 看板傾き（度）
  ceilH: number;       // 天井高さ
  aisleLen: number;    // 通路長
  camH: number;        // カメラ高さ（固定）
};
const params: Params = {
  aisleW: 8.9,
  curbW: 0.5,
  shopDepth: 8,
  shopWidthZ: 16,
  shopGap: 10,
  signH: 3.9,
  signTilt: 0,
  ceilH: 9.9,
  aisleLen: 83,
  camH: 5,
};

/* ------------ 基本セットアップ ------------ */
const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.shadowMap.enabled = true;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xffffff); // 白背景

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
// 高さ固定で入口寄りからスタート
camera.position.set(0, params.camH, params.aisleLen * 0.48);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
// 上下を完全に固定（水平のみ回転）
controls.minPolarAngle = Math.PI / 2;
controls.maxPolarAngle = Math.PI / 2;
// 誤操作を減らす
controls.enablePan = false;
controls.enableZoom = false;
// ターゲットも常に同じ高さにする（水平視線）
controls.target.set(0, params.camH, 0);

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(12, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const clock = new THREE.Clock();
const mallRoot = new THREE.Group();
scene.add(mallRoot);

const loader = new THREE.TextureLoader();
const setSRGB = (t: THREE.Texture) => {
  (t as any).colorSpace = (THREE as any).SRGBColorSpace ?? (THREE as any).sRGBEncoding;
  return t;
};

/* ------------ Click/Touch to Move（高さ固定版） ------------ */
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const WALK = {
  speed: 6,       // m/s相当
  stopDist: 0.15, // 停止距離
};

let walkTarget: THREE.Vector3 | null = null;

// 歩ける面を保持（buildMall() で差し替える）
const floorMeshes: THREE.Object3D[] = [];

// レイアウトから毎回クランプ値を計算（形状変更に追従）
function getClampX() {
  const totalW = params.aisleW + 2 * (params.curbW + params.shopDepth);
  const margin = 1.0;
  return { min: -totalW * 0.5 + margin, max: totalW * 0.5 - margin };
}
function getClampZ() {
  const margin = 1.0;
  return { min: -params.aisleLen * 0.5 + margin, max: params.aisleLen * 0.5 - margin };
}

function setPointerNdc(ev: MouseEvent | TouchEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = ev instanceof TouchEvent ? ev.changedTouches[0].clientX : (ev as MouseEvent).clientX;
  const y = ev instanceof TouchEvent ? ev.changedTouches[0].clientY : (ev as MouseEvent).clientY;
  pointerNdc.x = ((x - rect.left) / rect.width) * 2 - 1;
  pointerNdc.y = -((y - rect.top) / rect.height) * 2 + 1;
}

function trySetWalkTarget(ev: MouseEvent | TouchEvent) {
  setPointerNdc(ev);
  raycaster.setFromCamera(pointerNdc, camera);
  const hits = raycaster.intersectObjects(floorMeshes, false);
  if (!hits.length) return;

  const p = hits[0].point.clone();
  const cx = getClampX(), cz = getClampZ();
  p.x = THREE.MathUtils.clamp(p.x, cx.min, cx.max);
  p.z = THREE.MathUtils.clamp(p.z, cz.min, cz.max);
  p.y = params.camH; // 高さを固定
  walkTarget = p;
}

// イベント登録（重複禁止）
renderer.domElement.addEventListener("click", (e) => trySetWalkTarget(e));
renderer.domElement.addEventListener("touchend", (e) => { trySetWalkTarget(e); e.preventDefault(); }, { passive: false });

/* ------------ ユーティリティ ------------ */
function clearGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children.pop()!;
    c.traverse((o: any) => {
      o.geometry?.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
        else o.material.dispose?.();
      }
    });
  }
}
function makeSign(text: string) {
  const W = 1024, H = 280;
  const cvs = document.createElement("canvas");
  cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext("2d")!;
  ctx.fillStyle = "#cfd5dd"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#202633";
  ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic'";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  ctx.fillText(text, W / 2, H / 2);
  const t = new THREE.CanvasTexture(cvs);
  setSRGB(t);
  return new THREE.Mesh(
    new THREE.PlaneGeometry(6, 1.6),
    new THREE.MeshBasicMaterial({ map: t, transparent: true })
  );
}

/* ------------ デモ店舗データ（共有） ------------ */
const demoBooths: { name: string; images: string[] }[] = [
  {
    name: "Fashion",
    images: [
      "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1491553895911-0055eca6402d?q=80&w=800&auto=format&fit=crop",
    ],
  },
  {
    name: "Gadgets",
    images: [
      "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1527443154391-507e9dc6c5cc?q=80&w=800&auto=format&fit=crop",
    ],
  },
  {
    name: "Books",
    images: [
      "https://images.unsplash.com/photo-1457694587812-e8bf29a43845?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1519681393784-d120267933ba?q=80&w=800&auto=format&fit=crop",
      "https://images.unsplash.com/photo-1526318472351-c75fcf070305?q=80&w=800&auto=format&fit=crop",
    ],
  },
];

/* ------------ モール構築（仕切りあり・モール風内装） ------------ */
function buildMall() {
  clearGroup(mallRoot);

  const { aisleW, curbW, shopDepth, shopWidthZ, shopGap, signH, signTilt, ceilH, aisleLen } = params;
  const halfW = aisleW * 0.5;
  const halfLen = aisleLen * 0.5;

  const totalW = aisleW + 2 * (curbW + shopDepth);

  // 床（全幅）
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(totalW, aisleLen),
    new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mallRoot.add(floor);

  // クリック当たり面の登録を更新
  floorMeshes.length = 0;
  floorMeshes.push(floor);

  // 通路の帯（3本）
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0xcfd3d8, roughness: 1 });
  [-0.25, 0, 0.25].forEach((k) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(aisleW * 0.26, aisleLen), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(aisleW * k, 0.002, 0);
    s.receiveShadow = true;
    mallRoot.add(s);
  });

  // 縁石
  const curbMat = new THREE.MeshStandardMaterial({ color: 0xb8bec6, roughness: 1 });
  const curbGeo = new THREE.PlaneGeometry(curbW, aisleLen);
  const curbL = new THREE.Mesh(curbGeo, curbMat);
  curbL.rotation.x = -Math.PI / 2;
  curbL.position.set(-halfW - curbW * 0.5, 0.004, 0);
  curbL.receiveShadow = true;
  const curbR = curbL.clone();
  curbR.position.x = halfW + curbW * 0.5;
  mallRoot.add(curbL, curbR);

  // 通路沿いの低い壁
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 1 });
  const wallGeo = new THREE.BoxGeometry(curbW, 1.0, aisleLen + 2);
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.position.set(-halfW - curbW, 0.5, 0);
  wallL.castShadow = true; wallL.receiveShadow = true;
  const wallR = wallL.clone();
  wallR.position.x = halfW + curbW;
  mallRoot.add(wallL, wallR);

  // 天井 + 帯ライト
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(totalW, aisleLen),
    new THREE.MeshStandardMaterial({ color: 0xf4f6f8, roughness: 1 })
  );
  ceil.position.set(0, ceilH, 0);
  ceil.rotation.x = Math.PI / 2;
  ceil.receiveShadow = true;
  mallRoot.add(ceil);

  const rows = 4;
  for (let i = 0; i < rows; i++) {
    const z = -halfLen + (i + 1) * (aisleLen / (rows + 1));
    const bar = new THREE.Mesh(
      new THREE.PlaneGeometry(aisleW * 0.58, 0.6),
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    bar.position.set(0, ceilH - 0.02, z);
    bar.rotation.x = Math.PI / 2;
    mallRoot.add(bar);

    const rect = new THREE.RectAreaLight(0xffffff, 6, aisleW * 0.58, 0.6);
    rect.position.set(0, ceilH - 0.06, z);
    rect.rotation.x = -Math.PI / 2;
    mallRoot.add(rect);
  }

  // ブース生成ヘルパ
  function makeBooth(name: string, side: "L" | "R", z: number, imgs: string[]) {
    const root = new THREE.Group();

    const deckX = side === "L"
      ? -(halfW + params.curbW + params.shopDepth * 0.5)
      : (halfW + params.curbW + params.shopDepth * 0.5);

    // 店前フロア
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(params.shopDepth + params.curbW * 1.4, params.shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0xeff2f5, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    patch.position.set(deckX, 0.001, z);
    patch.receiveShadow = true;
    root.add(patch);

    // 店の床
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(params.shopDepth, 0.15, params.shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0xdadfe6, roughness: 1 })
    );
    deck.position.set(deckX, 0.075, z);
    deck.receiveShadow = true;
    root.add(deck);

    // 背面壁
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.0, params.shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 1 })
    );
    back.position.set(
      side === "L" ? deckX - (params.shopDepth * 0.5 - 0.1) : deckX + (params.shopDepth * 0.5 - 0.1),
      1.5,
      z
    );
    back.castShadow = true; back.receiveShadow = true;
    root.add(back);

    // U字の腰壁
    const lowH = 0.9;
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, lowH, params.shopWidthZ - 0.6),
      new THREE.MeshStandardMaterial({ color: 0x343b44, roughness: 1 })
    );
    const parX = side === "L" ? deckX + (params.shopDepth * 0.5 - 0.1) : deckX - (params.shopDepth * 0.5 - 0.1);
    parapet.position.set(parX, lowH / 2, z);
    parapet.castShadow = true; parapet.receiveShadow = true;

    const cheekGeo = new THREE.BoxGeometry(0.15, lowH + 0.2, 2.2);
    const cheekMat = parapet.material as THREE.Material;
    const cheek1 = new THREE.Mesh(cheekGeo, cheekMat);
    const cheek2 = new THREE.Mesh(cheekGeo, cheekMat);
    const cx = parX;
    cheek1.position.set(cx, (lowH + 0.2) / 2, z - (params.shopWidthZ / 2 - 1.25));
    cheek2.position.set(cx, (lowH + 0.2) / 2, z + (params.shopWidthZ / 2 - 1.25));
    cheek1.castShadow = cheek2.castShadow = true;
    root.add(parapet, cheek1, cheek2);

    // 看板（通路向き）
    const sign = makeSign(name);
    sign.position.set(parX + (side === "L" ? 0.01 : -0.01), params.signH, z);
    sign.rotation.y = side === "L" ? Math.PI / 2 : -Math.PI / 2;
    if (params.signTilt !== 0) sign.rotation.x = THREE.MathUtils.degToRad(params.signTilt);
    root.add(sign);

    // 展示パネル（通路向き）
    const panelW = 1.1, panelH = 1.1;
    const px = side === "L" ? deckX + (params.shopDepth * 0.5 - 0.35) : deckX - (params.shopDepth * 0.5 - 0.35);
    const ry = side === "L" ? Math.PI / 2 : -Math.PI / 2;
    imgs.slice(0, 3).forEach((url, i) => {
      const t = setSRGB(loader.load(url));
      const m = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
      );
      m.position.set(px, 1.25, z - 2 + i * 2);
      m.rotation.y = ry;
      m.castShadow = true;
      root.add(m);
    });

    // 簡易棚
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3b424b, roughness: 1, metalness: 0.1 });
    const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.6), shelfMat);
    const shelf2 = shelf1.clone();
    const sgn = side === "L" ? -1 : 1;
    shelf1.position.set(deckX + sgn * -0.6, 0.55, z - 2.2);
    shelf2.position.set(deckX + sgn * -0.8, 0.55, z + 2.2);
    shelf1.castShadow = shelf2.castShadow = true;
    root.add(shelf1, shelf2);

    mallRoot.add(root);
  }

  // 左右に配置（★ startZ / pitch はここで一度だけ定義 ★）
  const startZLocal = -halfLen * 0.7;
  const pitchLocal = Math.max(params.shopGap, 6);

  for (let i = 0; i < demoBooths.length; i++) {
    const z = startZLocal + i * pitchLocal;
    const b = demoBooths[i % demoBooths.length];
    makeBooth(b.name, "L", z, b.images);
  }
  for (let i = 0; i < demoBooths.length; i++) {
    const z = startZLocal + i * pitchLocal;
    const b = demoBooths[i % demoBooths.length];
    makeBooth(b.name, "R", z, b.images);
  }
}

buildMall();

/* ------------ UIボタン（任意） ------------ */
function jumpEntrance() {
  camera.position.set(0, params.camH, params.aisleLen * 0.48);
  controls.target.set(0, params.camH, 0);
  controls.update();
}
function jumpLeft() {
  camera.position.set(-(params.aisleW * 0.7), params.camH, 0);
  controls.target.set(0, params.camH, 0);
  controls.update();
}
function jumpRight() {
  camera.position.set(params.aisleW * 0.7, params.camH, 0);
  controls.target.set(0, params.camH, 0);
  controls.update();
}
(document.getElementById("goEntrance") as HTMLButtonElement | null)?.addEventListener("click", jumpEntrance);
(document.getElementById("goBooks") as HTMLButtonElement | null)?.addEventListener("click", jumpLeft);
(document.getElementById("reset") as HTMLButtonElement | null)?.addEventListener("click", () => {
  camera.position.set(0, params.camH, params.aisleLen * 0.2);
  controls.target.set(0, params.camH, 0);
  controls.update();
});

/* ------------ GUI（camH変更時も高さ維持） ------------ */
const gui = new GUI({ title: "Mall Layout" });
gui.add(params, "aisleW", 5, 16, 0.1).name("通路幅").onFinishChange(buildMall);
gui.add(params, "curbW", 0, 2, 0.1).name("縁石幅").onFinishChange(buildMall);
gui.add(params, "shopDepth", 4, 14, 0.1).name("店の奥行").onFinishChange(buildMall);
gui.add(params, "shopWidthZ", 8, 24, 1).name("店の幅(z)").onFinishChange(buildMall);
gui.add(params, "shopGap", 6, 20, 0.5).name("店舗間隔").onFinishChange(buildMall);
gui.add(params, "signH", 2, 6, 0.1).name("看板高さ").onFinishChange(buildMall);
gui.add(params, "signTilt", -20, 20, 1).name("看板傾き").onFinishChange(buildMall);
gui.add(params, "ceilH", 6, 14, 0.1).name("天井高さ").onFinishChange(buildMall);
gui.add(params, "aisleLen", 40, 120, 1).name("通路長").onFinishChange(() => { jumpEntrance(); buildMall(); });
gui.add(params, "camH", 2, 8, 0.1).name("カメラ高さ(固定)").onChange(() => {
  camera.position.y = params.camH;
  controls.target.y = params.camH;
  controls.update();
});

/* ------------ ループ/リサイズ ------------ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function loop() {
  requestAnimationFrame(loop);

  // 高さ固定（どこかで変わってもここで矯正）
  if (camera.position.y !== params.camH) camera.position.y = params.camH;
  if (controls.target.y !== params.camH) controls.target.y = params.camH;

  // クリック/タップ移動（水平のみ）
  if (walkTarget) {
    const delta = clock.getDelta();

    const cur = new THREE.Vector3(camera.position.x, params.camH, camera.position.z);
    const to = new THREE.Vector3().subVectors(walkTarget, cur);
    const dist = to.length();

    if (dist < WALK.stopDist) {
      camera.position.set(walkTarget.x, params.camH, walkTarget.z);
      walkTarget = null;
    } else {
      const step = Math.min(dist, WALK.speed * delta);
      const next = cur.add(to.normalize().multiplyScalar(step));
      const cx = getClampX(), cz = getClampZ();
      next.x = THREE.MathUtils.clamp(next.x, cx.min, cx.max);
      next.z = THREE.MathUtils.clamp(next.z, cz.min, cz.max);
      camera.position.set(next.x, params.camH, next.z);
    }

    // 注視点は常に同じ高さ・少し先へ
    const ahead = walkTarget ?? controls.target;
    controls.target.lerp(new THREE.Vector3(ahead.x, params.camH, ahead.z), 0.12);
  }

  controls.update();
  renderer.render(scene, camera);
})();
