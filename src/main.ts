// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

// -------------- 基本定数（通路とブース配置） --------------
const LANE_X = 12;                // 通路の中心からブースまでの横距離
const BOOTH_SPAN = 12;            // ブースの奥行き方向の間隔
const FLOOR_W = 60;               // 床の幅
const FLOOR_L = 160;              // 床の長さ（奥行き）

// -------------- 初期化 --------------
const app = document.getElementById("app")!;
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
(renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
app.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0f1623");

const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);
scene.add(camera);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// 入口カメラ位置（通路手前）
const ENTRANCE_POS = new THREE.Vector3(0, 3.2, FLOOR_L * 0.48);
const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
camera.position.copy(ENTRANCE_POS);
controls.target.copy(ENTRANCE_TGT);

// -------------- ライト --------------
scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.7));

const dir = new THREE.DirectionalLight(0xffffff, 1.0);
dir.position.set(10, 20, 10);
dir.castShadow = true;
dir.shadow.mapSize.set(2048, 2048);
scene.add(dir);

// 天井ルーバー風のライト（見た目用）
function addCeilingLights() {
  const g = new THREE.PlaneGeometry(14, 1.4);
  const m = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const z0 = 20;
  for (let i = 0; i < 8; i++) {
    const bar = new THREE.Mesh(g, m);
    bar.position.set(0, 12, z0 - i * 12);
    bar.rotation.x = Math.PI / 2;
    bar.renderOrder = 2;
    scene.add(bar);
  }
}
addCeilingLights();

// -------------- 床・通路（センター帯＆サイド帯） --------------
function addFloor() {
  // 大床
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
    new THREE.MeshStandardMaterial({ color: 0x8e949a, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // センター帯
  const center = new THREE.Mesh(
    new THREE.PlaneGeometry(6, FLOOR_L),
    new THREE.MeshStandardMaterial({ color: 0x7b8188, roughness: 1 })
  );
  center.rotation.x = -Math.PI / 2;
  center.position.y = 0.002;
  scene.add(center);

  // サイド帯
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x6a7077, roughness: 1 });
  for (const sx of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(8, FLOOR_L), sideMat);
    side.rotation.x = -Math.PI / 2;
    side.position.set(sx * 10, 0.001, 0);
    side.receiveShadow = true;
    scene.add(side);
  }
}
addFloor();

// -------------- ベンチ --------------
function addBenches() {
  const baseMat = new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 1, metalness: 0.2 });
  const legMat = new THREE.MeshStandardMaterial({ color: 0x23272b, roughness: 1 });
  const topMat = new THREE.MeshStandardMaterial({ color: 0x4c5157, roughness: 1 });

  function makeBench(x: number, z: number) {
    const g = new THREE.Group();

    // 台座
    const base = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.15, 1.2), baseMat);
    base.position.set(0, 0.075, 0);
    base.castShadow = base.receiveShadow = true;
    g.add(base);

    // 脚
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.35, 0.8), legMat);
    const leg2 = leg1.clone();
    leg1.position.set(-1.2, 0.35, 0);
    leg2.position.set(1.2, 0.35, 0);
    leg1.castShadow = leg2.castShadow = true;
    g.add(leg1, leg2);

    // 天板
    const top = new THREE.Mesh(new THREE.BoxGeometry(3, 0.12, 1), topMat);
    top.position.set(0, 0.65, 0);
    top.castShadow = top.receiveShadow = true;
    g.add(top);

    g.position.set(x, 0, z);
    scene.add(g);
  }

  for (let i = 0; i < 6; i++) {
    makeBench(-2, 30 - i * 16);
  }
}
addBenches();

// -------------- クリック（商品パネル → 右の詳細パネル） --------------
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
  const px = isTouch ? (ev as TouchEvent).changedTouches[0].clientX : (ev as MouseEvent).clientX;
  const py = isTouch ? (ev as TouchEvent).changedTouches[0].clientY : (ev as MouseEvent).clientY;
  const rect = renderer.domElement.getBoundingClientRect();
  mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((py - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hit = raycaster.intersectObjects(clickable, false)[0];
  if (hit) openDetail(hit.object.userData as Item);
}
renderer.domElement.addEventListener("click", pick);
renderer.domElement.addEventListener("touchend", (e) => {
  pick(e);
  e.preventDefault();
}, { passive: false });

// -------------- 看板 Sprite --------------
function makeLabelSprite(text: string) {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#c3c9d3";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#222833";
  ctx.font = "bold 120px system-ui, -apple-system, Segoe UI, Roboto, 'Noto Sans JP', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = (THREE as any).SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true }));
  sp.scale.set(8, 2, 1);
  return sp;
}

// -------------- ブース（**通路側を向く**） --------------
const loader = new THREE.TextureLoader();
let booksTeleport: { pos: THREE.Vector3; tgt: THREE.Vector3 } = {
  pos: ENTRANCE_POS.clone(),
  tgt: ENTRANCE_TGT.clone(),
};

function addBooth({ side, z, name, items }: Booth) {
  // グループ原点 = ブースの床の中心（通路境界付近）
  const g = new THREE.Group();

  // 左右の配置座標 + 回転（通路側を正面に）
  const x = side === "left" ? -LANE_X : LANE_X;
  const rotY = side === "left" ? -Math.PI / 2 : Math.PI / 2;
  g.position.set(x, 0, z);
  g.rotation.y = rotY;

  // 床（店内）
  const base = new THREE.Mesh(
    new THREE.BoxGeometry(8, 0.18, 6),
    new THREE.MeshStandardMaterial({ color: 0x4c5259, roughness: 1 })
  );
  base.position.set(0, 0.09, -3.2); // グループの -Z が店の奥側 / +Z が通路
  base.castShadow = base.receiveShadow = true;
  g.add(base);

  // サイド壁（左右） & 背面壁（通路反対側）
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x1a1f26, roughness: 1 });
  const sideW1 = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.8, 6), wallMat);
  const sideW2 = sideW1.clone();
  sideW1.position.set(-4, 1.4, -3.2);
  sideW2.position.set(4, 1.4, -3.2);

  const backW = new THREE.Mesh(new THREE.BoxGeometry(8, 2.8, 0.2), wallMat);
  backW.position.set(0, 1.4, -6.2);

  sideW1.castShadow = sideW2.castShadow = backW.castShadow = true;
  sideW1.receiveShadow = sideW2.receiveShadow = backW.receiveShadow = true;
  g.add(sideW1, sideW2, backW);

  // 通路側の立ち上がり（見切り）
  const sill = new THREE.Mesh(new THREE.BoxGeometry(8.6, 0.15, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x3a3f45, roughness: 1 })
  );
  sill.position.set(0, 0.075, 0.1);
  sill.castShadow = sill.receiveShadow = true;
  g.add(sill);

  // 看板（**グループ内の +Z = 通路方向**）
  const label = makeLabelSprite(name);
  label.position.set(0, 2.7, 1.3); // 通路側へ少し張り出し
  g.add(label);

  // 商品パネル（店内の背面壁に貼る）
  const spacing = 8 / (items.length + 1);
  items.forEach((it, i) => {
    const tex = loader.load(it.image);
    tex.colorSpace = (THREE as any).SRGBColorSpace;
    const quad = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4, 2.4),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    quad.position.set(-4 + spacing * (i + 1), 1.6, -6.09); // 背面壁 slightly 手前
    quad.userData = it;
    quad.castShadow = true;
    // 背面壁を向くように 180°（グループで回しているのでローカルはそのまま）
    quad.rotation.y = Math.PI;
    clickable.push(quad);
    g.add(quad);
  });

  scene.add(g);

  // 本屋のテレポ地点
  if (name.toLowerCase() === "books") {
    const pos = new THREE.Vector3(
      side === "left" ? -LANE_X + 3 : LANE_X - 3,
      2.6,
      z + (side === "left" ? -1.5 : 1.5)
    );
    const tgt = new THREE.Vector3(0, 1.4, z);
    booksTeleport = { pos, tgt };
  }
}

// -------------- ブースを配置（**左右とも通路側を向く**） --------------
BOOTHS.forEach(addBooth);

// -------------- テレポート/カメラユーティリティ --------------
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
  camera.position.set(0, 4, 24);
  controls.target.set(0, 1.6, 0);
  controls.update();
};

// 左右の店を見る（カメラを横振り）
(document.getElementById("lookLeft") as HTMLButtonElement).onclick = () => {
  const p = camera.position.clone();
  jumpTo(new THREE.Vector3(-LANE_X + 3, p.y, p.z), new THREE.Vector3(0, 1.6, p.z));
};
(document.getElementById("lookRight") as HTMLButtonElement).onclick = () => {
  const p = camera.position.clone();
  jumpTo(new THREE.Vector3(LANE_X - 3, p.y, p.z), new THREE.Vector3(0, 1.6, p.z));
};

// -------------- AIに聞く（Vercel API へ POST） --------------
(document.getElementById("askAI") as HTMLButtonElement).onclick = async () => {
  const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
  if (!q) return;

  const btn = document.getElementById("askAI") as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = "問い合わせ中…";

  try {
    const r = await fetch("https://vr-mall-api.vercel.app/api/concierge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: q,
        context: { where: "corridor" },
      }),
    });
    const data = await r.json();
    alert(data?.reply ?? "（回答を取得できませんでした）");
  } catch (e: any) {
    alert("通信エラー: " + e?.message);
  } finally {
    btn.disabled = false;
    btn.textContent = "AIに聞く";
  }
};

// -------------- リサイズ & ループ --------------
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
