// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import GUI from "lil-gui";

/* -------------------- レイアウト初期値（スクショの値） -------------------- */
type Params = {
  aisleW: number;      // 通路幅
  curbW: number;       // 縁石幅
  shopDepth: number;   // 店の奥行
  shopWidthZ: number;  // 店の幅(Z)
  shopGap: number;     // 店舗間隔
  signH: number;       // 看板高さ
  signTilt: number;    // 看板傾き(度)
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

/* -------------------- ベーシックセットアップ -------------------- */
const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
(app as HTMLElement).appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0f1623);

const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
camera.position.set(0, params.camH, params.aisleLen * 0.48);
camera.lookAt(0, params.camH * 0.6, 0);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

/* 環境光 + 方向光 */
scene.add(new THREE.AmbientLight(0xffffff, 0.35));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(10, 20, 10);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
scene.add(sun);

/* -------------------- 再構築関数 -------------------- */
const mallRoot = new THREE.Group();
scene.add(mallRoot);

const texLoader = new THREE.TextureLoader();
const SRGB = (THREE as any).SRGBColorSpace ?? (THREE as any).SRGBColorSpace;
const setSRGB = (t: THREE.Texture) => {
  (t as any).colorSpace = SRGB;
  return t;
};

function clearMall() {
  while (mallRoot.children.length) {
    const obj = mallRoot.children.pop()!;
    obj.traverse((o) => {
      // @ts-ignore
      if (o.geometry) o.geometry.dispose();
      // @ts-ignore
      if (o.material) {
        const m = o.material;
        if (Array.isArray(m)) m.forEach((mm) => mm.dispose());
        else m.dispose();
      }
    });
  }
}

function buildMall() {
  clearMall();

  const {
    aisleW,
    curbW,
    shopDepth,
    shopWidthZ,
    shopGap,
    signH,
    signTilt,
    ceilH,
    aisleLen,
  } = params;

  const halfLen = aisleLen * 0.5;
  const halfW = aisleW * 0.5;

  /* ---- 床（通路＋店舗床） ---- */
  const floorMat = new THREE.MeshStandardMaterial({
    color: 0x8f949b,
    roughness: 1,
  });
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(aisleW + 2 * (curbW + shopDepth), aisleLen),
    floorMat
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  mallRoot.add(floor);

  /* ---- 通路帯（視覚アクセント：3本） ---- */
  const stripeMat = new THREE.MeshStandardMaterial({ color: 0x6e737a, roughness: 1 });
  const stripeZs = [-aisleW * 0.25, 0, aisleW * 0.25];
  stripeZs.forEach((z) => {
    const s = new THREE.Mesh(new THREE.PlaneGeometry(aisleW * 0.26, aisleLen), stripeMat);
    s.rotation.x = -Math.PI / 2;
    s.position.set(z, 0.002, 0);
    s.receiveShadow = true;
    mallRoot.add(s);
  });

  /* ---- 縁石（両側） ---- */
  const curbMat = new THREE.MeshStandardMaterial({ color: 0x5b6169, roughness: 1 });
  const curbLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(curbW, aisleLen),
    curbMat
  );
  curbLeft.rotation.x = -Math.PI / 2;
  curbLeft.position.set(-halfW - curbW * 0.5, 0.004, 0);
  curbLeft.receiveShadow = true;

  const curbRight = curbLeft.clone();
  curbRight.position.x = halfW + curbW * 0.5;

  mallRoot.add(curbLeft, curbRight);

  /* ---- 壁（安全柵っぽい低い黒壁） ---- */
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0b0f14, roughness: 1 });
  const wallGeo = new THREE.BoxGeometry(curbW, 1.0, aisleLen + 2);
  const wallL = new THREE.Mesh(wallGeo, wallMat);
  wallL.position.set(-halfW - curbW, 0.5, 0);
  wallL.castShadow = true;
  wallL.receiveShadow = true;

  const wallR = wallL.clone();
  wallR.position.x = halfW + curbW;

  mallRoot.add(wallL, wallR);

  /* ---- 天井 + 帯ライト ---- */
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(aisleW + 2 * (curbW + shopDepth), aisleLen),
    new THREE.MeshStandardMaterial({ color: 0x1c2430, roughness: 1, metalness: 0 })
  );
  ceil.position.set(0, ceilH, 0);
  ceil.rotation.x = Math.PI / 2;
  ceil.receiveShadow = true;
  mallRoot.add(ceil);

  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const rows = 4;
  for (let i = 0; i < rows; i++) {
    const z = -halfLen + (i + 1) * (aisleLen / (rows + 1));
    const bar = new THREE.Mesh(new THREE.PlaneGeometry(aisleW * 0.6, 0.6), lightMat);
    bar.position.set(0, ceilH - 0.01, z);
    bar.rotation.x = Math.PI / 2;
    mallRoot.add(bar);

    const rect = new THREE.RectAreaLight(0xffffff, 6, aisleW * 0.6, 0.6);
    rect.position.set(0, ceilH - 0.05, z);
    rect.rotation.x = -Math.PI / 2;
    // @ts-ignore
    rect.lookAt(0, 0, z);
    mallRoot.add(rect);
  }

  /* ---- 店舗（左右に並べる） ---- */
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
        "https://images.unsplash.com/photo-1518770660439-4636190af475?q=80&w=800&auto=format&fit=crop",
        "https://images.unsplash.com/photo-1518779578993-ec3579fee39f?q=80&w=800&auto=format&fit=crop",
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

  const perSide = booths.length;
  const startZ = -halfLen * 0.7;
  const pitch = Math.max(shopGap, 6);

  function makeSign(text: string) {
    const w = 1024, h = 280;
    const cvs = document.createElement("canvas");
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#cfd5dd"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#202633";
    ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic'";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2);
    const tex = new THREE.CanvasTexture(cvs);
    setSRGB(tex);
    const plane = new THREE.Mesh(
      new THREE.PlaneGeometry(6, 1.6),
      new THREE.MeshBasicMaterial({ map: tex, transparent: true })
    );
    return plane;
  }

  function makeBooth(name: string, side: "L" | "R", z: number, imgs: string[]) {
    const root = new THREE.Group();

    // 店床
    const deck = new THREE.Mesh(
      new THREE.BoxGeometry(shopDepth + curbW * 1.5, 0.15, shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x5a6068, roughness: 1 })
    );
    deck.castShadow = false;
    deck.receiveShadow = true;

    const xSign = side === "L" ? -(halfW + curbW + shopDepth * 0.5) : (halfW + curbW + shopDepth * 0.5);
    const xDeck = side === "L" ? -(halfW + curbW + (shopDepth * 0.5)) : (halfW + curbW + (shopDepth * 0.5));

    deck.position.set(xDeck, 0.075, z);
    root.add(deck);

    // 背面壁
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(0.2, 2.6, shopWidthZ),
      new THREE.MeshStandardMaterial({ color: 0x0f141a, roughness: 1 })
    );
    back.position.set(
      side === "L" ? xDeck - (shopDepth * 0.5 - 0.1) : xDeck + (shopDepth * 0.5 - 0.1),
      1.3,
      z
    );
    back.castShadow = true; back.receiveShadow = true;
    root.add(back);

    // 商品パネル（通路側へ向ける）
    const panelW = 1.1, panelH = 1.1;
    const px = side === "L" ? xDeck + (shopDepth * 0.5 - 0.3) : xDeck - (shopDepth * 0.5 - 0.3);
    const baseRotY = side === "L" ? Math.PI / 2 : -Math.PI / 2;

    imgs.slice(0, 3).forEach((url, idx) => {
      const t = setSRGB(texLoader.load(url));
      const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(panelW, panelH),
        new THREE.MeshBasicMaterial({ map: t, toneMapped: false })
      );
      mesh.position.set(px, 1.15, z - 2 + idx * 2);
      mesh.rotation.y = baseRotY;
      mesh.castShadow = true;
      root.add(mesh);
    });

    // 看板
    const sign = makeSign(name);
    sign.position.set(xSign, signH, z);
    sign.rotation.y = side === "L" ? Math.PI / 2 : -Math.PI / 2;
    if (signTilt !== 0) sign.rotation.x = THREE.MathUtils.degToRad(signTilt);
    root.add(sign);

    mallRoot.add(root);
  }

  // 左右に配置
  for (let i = 0; i < perSide; i++) {
    const z = startZ + i * pitch;
    const b = booths[i % booths.length];
    makeBooth(b.name, "L", z, b.images);
  }
  for (let i = 0; i < perSide; i++) {
    const z = startZ + i * pitch;
    const b = booths[i % booths.length];
    makeBooth(b.name, "R", z, b.images);
  }
}

buildMall();

/* -------------------- UI（既存ボタンは index.html のままでOK） -------------------- */
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
(document.getElementById("goBooks") as HTMLButtonElement)?.addEventListener("click", jumpLeft); // 使い回し
(document.getElementById("reset") as HTMLButtonElement)?.addEventListener("click", () => {
  camera.position.set(0, params.camH, params.aisleLen * 0.2);
  controls.target.set(0, params.camH * 0.5, 0);
  controls.update();
});
(document.getElementById("seeLeft") as HTMLButtonElement)?.addEventListener("click", jumpLeft);
(document.getElementById("seeRight") as HTMLButtonElement)?.addEventListener("click", jumpRight);

/* -------------------- lil-gui（初期値は上の params） -------------------- */
const gui = new GUI({ title: "Mall Layout" });
gui.add(params, "aisleW", 5, 16, 0.1).name("通路幅").onFinishChange(buildMall);
gui.add(params, "curbW", 0, 2, 0.1).name("縁石幅").onFinishChange(buildMall);
gui.add(params, "shopDepth", 4, 14, 0.1).name("店の奥行").onFinishChange(buildMall);
gui.add(params, "shopWidthZ", 8, 24, 1).name("店の幅(z)").onFinishChange(buildMall);
gui.add(params, "shopGap", 6, 20, 0.5).name("店舗間隔").onFinishChange(buildMall);
gui.add(params, "signH", 2, 6, 0.1).name("看板高さ").onFinishChange(buildMall);
gui.add(params, "signTilt", -20, 20, 1).name("看板傾き").onFinishChange(buildMall);
gui.add(params, "ceilH", 6, 14, 0.1).name("天井高さ").onFinishChange(buildMall);
gui.add(params, "aisleLen", 40, 120, 1).name("通路長").onFinishChange(() => {
  jumpEntrance();
  buildMall();
});
gui.add(params, "camH", 2, 8, 0.1).name("カメラ高さ").onChange(() => {
  camera.position.y = params.camH;
  controls.target.y = params.camH * 0.6;
  controls.update();
});

/* -------------------- ループ＆リサイズ -------------------- */
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

(function loop() {
  requestAnimationFrame(loop);
  controls.update();
  renderer.render(scene, camera);
})();
