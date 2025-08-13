// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

/* ------------ レイアウト初期値（スクショで決めた値） ------------ */
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
  camH: number;        // カメラ高さ
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
scene.background = new THREE.Color(0xffffff);


const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, params.camH, params.aisleLen * 0.48);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(12, 18, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

const mallRoot = new THREE.Group();
scene.add(mallRoot);

const loader = new THREE.TextureLoader();
const setSRGB = (t: THREE.Texture) => {
  (t as any).colorSpace =
    (THREE as any).SRGBColorSpace ?? (THREE as any).sRGBEncoding;
  return t;
};

/* ------------ ユーティリティ ------------ */
function clearGroup(g: THREE.Group) {
  while (g.children.length) {
    const c = g.children.pop()!;
    c.traverse((o: any) => {
      if (o.geometry) o.geometry.dispose?.();
      if (o.material) {
        if (Array.isArray(o.material)) o.material.forEach((m: any) => m.dispose?.());
        else o.material.dispose?.();
      }
      if (o.texture) o.texture.dispose?.();
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

/* ------------ モール構築 ------------ */
function buildMall() {
  clearGroup(mallRoot);

  const { aisleW, curbW, shopDepth, shopWidthZ, shopGap, signH, signTilt, ceilH, aisleLen } = params;
  const halfW = aisleW * 0.5;
  const halfLen = aisleLen * 0.5;

  // 床
  const totalW = aisleW + 2 * (curbW + shopDepth);
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(totalW, aisleLen),
    new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mallRoot.add(floor);

  // === Click/Touch to Move: 設定 ===
const raycaster = new THREE.Raycaster();
const pointerNdc = new THREE.Vector2();

const WALK = {
  speed: 6,          // 移動速度（m/s 相当）…GUIで変えたければ好きに
  stopDist: 0.15,    // 目標にこれ以下まで近づいたら停止
  clampX: { min: - (FLOOR_W*0.5 - 1.0), max: (FLOOR_W*0.5 - 1.0) }, // 通路左右のはみ出し制限（床幅に合わせて調整）
  clampZ: { min: - (MALL_LEN*0.5) + 1.0, max: (MALL_LEN*0.5) - 1.0 }, // 通路前後のはみ出し制限
};

let walkTarget: THREE.Vector3 | null = null;

// 視点の高さは既存のカメラYを使う（GUIの「カメラ高さ」に連動している前提）
const getCamY = () => camera.position.y;

// 床メッシュを覚えておく（あなたの床メッシュ変数名に合わせて）
// 例: const floor = new THREE.Mesh(...);
// すでに floor がある想定:
const floorMeshes: THREE.Object3D[] = [floor]; // 将来タイル分割しても配列に足すだけ


  // 通路の帯（3本）
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x6e737a, roughness: 1 });
  [-0.25, 0, 0.25].forEach((k) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(aisleW * 0.26, aisleLen), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(aisleW * k, 0.002, 0);
    s.receiveShadow = true;
    mallRoot.add(s);
  });

  // 縁石
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x5b6169, roughness: 1 });
  const curbGeo = new THREE.PlaneGeometry(curbW, aisleLen);
  const curbL = new THREE.Mesh(curbGeo, curbMat);
  curbL.rotation.x = -Math.PI / 2;
  curbL.position.set(-halfW - curbW * 0.5, 0.004, 0);
  curbL.receiveShadow = true;
  const curbR = curbL.clone();
  curbR.position.x = halfW + curbW * 0.5;
  mallRoot.add(curbL, curbR);

  // 通路沿い黒壁
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 1 });
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
    new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 1 })
  );
  ceil.position.set(0, ceilH, 0);
  ceil.rotation.x = Math.PI / 2;
  ceil.receiveShadow = true;
  mallRoot.add(ceil);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rows = 4;
  for (let i = 0; i < rows; i++) {
    const z = -halfLen + (i + 1) * (aisleLen / (rows + 1));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(aisleW * 0.58, 0.6), lightMat);
    bar.position.set(0, ceilH - 0.02, z);
    bar.rotation.x = Math.PI / 2;
    mallRoot.add(bar);

    const rect = new THREE.RectAreaLight(0xffffff, 6, aisleW * 0.58, 0.6);
    rect.position.set(0, ceilH - 0.06, z);
    rect.rotation.x = -Math.PI / 2;
    mallRoot.add(rect);
  }

  // デモ店舗データ
  const booths: { name: string; images: string[] }[] = [
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

  // ブース構築
  const startZ = -halfLen * 0.7;
  const pitch = Math.max(shopGap, 6);

  function makeBooth(name: string, side: "L" | "R", z: number, imgs: string[]) {
    const root = new THREE.Group();

    // 店前フロア（カーペット）
    const patch = new THREE.Mesh(
      new THREE.PlaneGeometry(shopDepth + curbW * 1.4, shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x7f858d, roughness: 1 })
    );
    patch.rotation.x = -Math.PI / 2;
    const deckX = side === "L" ? -(halfW + curbW + shopDepth * 0.5) : (halfW + curbW + shopDepth * 0.5);
    patch.position.set(deckX, 0.001, z);
    patch.receiveShadow = true;
    root.add(patch);

    // 店の床
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(shopDepth, 0.15, shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 1 })
    );
    deck.position.set(deckX, 0.075, z);
    deck.receiveShadow = true;
    root.add(deck);

    // 背面壁
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 3.0, shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x12161c, roughness: 1 })
    );
    back.position.set(
      side === "L" ? deckX - (shopDepth * 0.5 - 0.1) : deckX + (shopDepth * 0.5 - 0.1),
      1.5,
      z
    );
    back.castShadow = true; back.receiveShadow = true;
    root.add(back);

    // U字腰壁
    const lowH = 0.9;
    const parapet = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, lowH, shopWidthZ - 0.6),
      new THREE.MeshStandardMaterial({ color: 0x0e1116, roughness: 1 })
    );
    const parX = side === "L" ? deckX + (shopDepth * 0.5 - 0.1) : deckX - (shopDepth * 0.5 - 0.1);
    parapet.position.set(parX, lowH / 2, z);
    parapet.castShadow = true; parapet.receiveShadow = true;

    const cheekGeo = new THREE.BoxGeometry(0.15, lowH + 0.2, 2.2);
    const cheekMat = parapet.material as THREE.Material;
    const cheek1 = new THREE.Mesh(cheekGeo, cheekMat);
    const cheek2 = new THREE.Mesh(cheekGeo, cheekMat);
    const cx = side === "L" ? deckX + (shopDepth * 0.5 - 0.1) : deckX - (shopDepth * 0.5 - 0.1);
    cheek1.position.set(cx, (lowH + 0.2) / 2, z - (shopWidthZ / 2 - 1.25));
    cheek2.position.set(cx, (lowH + 0.2) / 2, z + (shopWidthZ / 2 - 1.25));
    cheek1.castShadow = cheek2.castShadow = true;
    root.add(parapet, cheek1, cheek2);

    // サイン帯（通路側）
    const sign = makeSign(name);
    sign.position.set(parX + (side === "L" ? 0.01 : -0.01), params.signH, z);
    sign.rotation.y = side === "L" ? Math.PI / 2 : -Math.PI / 2;
    if (params.signTilt !== 0) sign.rotation.x = THREE.MathUtils.degToRad(params.signTilt);
    root.add(sign);

    // 棚
    const shelfMat = new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 1, metalness: 0.1 });
    const shelf1 = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.1, 0.6), shelfMat);
    const shelf2 = shelf1.clone();
    const sgn = side === "L" ? -1 : 1;
    shelf1.position.set(deckX + sgn * -0.6, 0.55, z - 2.2);
    shelf2.position.set(deckX + sgn * -0.8, 0.55, z + 2.2);
    shelf1.castShadow = shelf2.castShadow = true;
    root.add(shelf1, shelf2);

    // 展示パネル（通路向き）
    const panelW = 1.1, panelH = 1.1;
    const px = side === "L" ? deckX + (shopDepth * 0.5 - 0.35) : deckX - (shopDepth * 0.5 - 0.35);
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

    // 店頭ステップ
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.2, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x3a3f46, roughness: 1 })
    );
    step.position.set(parX + (side === "L" ? 0.35 : -0.35), 0.1, z);
    step.castShadow = true; step.receiveShadow = true;
    root.add(step);

    mallRoot.add(root);
  }

  // 左右配置
  for (let i = 0; i < booths.length; i++) {
    const z = startZ + i * pitch;
    const b = booths[i % booths.length];
    makeBooth(b.name, "L", z, b.images);
  }
  for (let i = 0; i < booths.length; i++) {
    const z = startZ + i * pitch;
    const b = booths[i % booths.length];
    makeBooth(b.name, "R", z, b.images);
  }
}

buildMall();

/* ------------ 移動ボタン（既存ID） ------------ */
function jumpEntrance() {
  camera.position.set(0, params.camH, params.aisleLen * 0.48);
  controls.target.set(0, params.camH * 0.6, 0);
  controls.update();
}
function jumpLeft() {
  camera.position.set(-(params.aisleW * 0.7), params.camH, 0);
  controls.target.set(0, params.camH * 0.6, 0);
  controls.update();
}
function jumpRight() {
  camera.position.set(params.aisleW * 0.7, params.camH, 0);
  controls.target.set(0, params.camH * 0.6, 0);
  controls.update();
}
(document.getElementById("goEntrance") as HTMLButtonElement)?.addEventListener("click", jumpEntrance);
(document.getElementById("goBooks") as HTMLButtonElement)?.addEventListener("click", jumpLeft);
(document.getElementById("reset") as HTMLButtonElement)?.addEventListener("click", () => {
  camera.position.set(0, params.camH, params.aisleLen * 0.2);
  controls.target.set(0, params.camH * 0.5, 0);
  controls.update();
});
(document.getElementById("seeLeft") as HTMLButtonElement)?.addEventListener("click", jumpLeft);
(document.getElementById("seeRight") as HTMLButtonElement)?.addEventListener("click", jumpRight);

/* ------------ lil-gui（初期値は上の params） ------------ */
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
gui.add(params, "camH", 2, 8, 0.1).name("カメラ高さ").onChange(() => {
  camera.position.y = params.camH;
  controls.target.y = params.camH * 0.6;
  controls.update();
});
// Raycasterとマウス座標を用意
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener("click", (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(scene.children, true);

    if (intersects.length > 0) {
        const targetPos = intersects[0].point;

        // カメラ位置をスムーズに移動
        gsap.to(camera.position, {
            duration: 1,
            x: targetPos.x + 5,
            y: targetPos.y + 5,
            z: targetPos.z + 5,
            onUpdate: () => controls.update()
        });

        // コントロールの注視点も移動
        gsap.to(controls.target, {
            duration: 1,
            x: targetPos.x,
            y: targetPos.y,
            z: targetPos.z
        });
    }
});

function setPointerNdc(ev: MouseEvent | TouchEvent) {
  const rect = renderer.domElement.getBoundingClientRect();
  const x = (ev instanceof TouchEvent ? ev.changedTouches[0].clientX : (ev as MouseEvent).clientX) - rect.left;
  const y = (ev instanceof TouchEvent ? ev.changedTouches[0].clientY : (ev as MouseEvent).clientY) - rect.top;
  pointerNdc.x = (x / rect.width) * 2 - 1;
  pointerNdc.y = -(y / rect.height) * 2 + 1;
}

function trySetWalkTarget(ev: MouseEvent | TouchEvent) {
  setPointerNdc(ev);
  raycaster.setFromCamera(pointerNdc, camera);
  // 床 or 台座など「歩ける面」だけを対象にする
  const hits = raycaster.intersectObjects(floorMeshes, false);
  if (hits.length > 0) {
    const p = hits[0].point.clone();
    // 通路内に収める
    p.x = THREE.MathUtils.clamp(p.x, WALK.clampX.min, WALK.clampX.max);
    p.z = THREE.MathUtils.clamp(p.z, WALK.clampZ.min, WALK.clampZ.max);
    // カメラの高さは維持
    p.y = getCamY();
    walkTarget = p;
  }
}

// PC: クリックで移動 / スマホ: タップで移動
renderer.domElement.addEventListener("click", (e) => trySetWalkTarget(e));
renderer.domElement.addEventListener("touchend", (e) => { trySetWalkTarget(e); e.preventDefault(); }, { passive: false });

// 見回しは OrbitControls に任せる：ズーム/パンは好みで無効化
controls.enablePan = false;     // 片指ドラッグ＝見回し、誤操作を減らすなら true→false 推奨
// controls.enableZoom = false; // ズームを固定したいならコメントを外す

/* ------------ ループ/リサイズ ------------ */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});
(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  // === Click/Touch to Move: 毎フレーム処理 ===
if (walkTarget) {
  // 経過時間（delta）を使ってフレーム依存しない移動に
  // すでに clock を使っているなら流用、なければ以下を初期化部で作成:
  // const clock = new THREE.Clock();
  const delta = clock.getDelta();

  // 現在位置（高さは維持）
  const current = camera.position.clone();
  current.y = getCamY();

  const toTarget = new THREE.Vector3().subVectors(walkTarget, current);
  const dist = toTarget.length();
  if (dist < WALK.stopDist) {
    // 到着
    camera.position.set(walkTarget.x, getCamY(), walkTarget.z);
    walkTarget = null;
  } else {
    // 進む（等速）
    const step = Math.min(dist, WALK.speed * delta);
    const next = current.add(toTarget.normalize().multiplyScalar(step));

    // はみ出し制限
    next.x = THREE.MathUtils.clamp(next.x, WALK.clampX.min, WALK.clampX.max);
    next.z = THREE.MathUtils.clamp(next.z, WALK.clampZ.min, WALK.clampZ.max);

    camera.position.set(next.x, getCamY(), next.z);
  }
  // 見回し中心は少し先を見ると自然
  const lookAhead = walkTarget ? walkTarget : controls.target;
  controls.target.lerp(new THREE.Vector3(lookAhead.x, getCamY() * 0.6, lookAhead.z), 0.08);
}

  renderer.render(scene, camera);
})();
