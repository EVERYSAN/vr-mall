// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/* ========== 小ユーティリティ ========== */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(fn, 0);
  else window.addEventListener("DOMContentLoaded", fn, { once: true });
}

// カーペット/タイル風テクスチャ（画像要らず）
function makeCarpetTexture(w = 1024, h = 1024) {
  const c = document.createElement("canvas");
  c.width = w; c.height = h;
  const g = c.getContext("2d")!;
  g.fillStyle = "#d5d7db"; g.fillRect(0, 0, w, h);

  // タイル帯
  const tileW = 90, tileH = 130;
  for (let y = 0; y < h; y += tileH) {
    for (let x = 0; x < w; x += tileW) {
      const tone = 210 + ((x / tileW + y / tileH) % 2) * 8;
      g.fillStyle = `rgb(${tone},${tone + 3},${tone + 6})`;
      g.fillRect(x + 2, y + 2, tileW - 4, tileH - 4);
    }
  }

  // 中央の濃色ランナー（カーペット帯）
  g.fillStyle = "#9aa3b2";
  const bandW = w * 0.24;
  g.fillRect((w - bandW) / 2, 0, bandW, h);

  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(6, 14);
  (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
  return tex;
}

// 看板（店名）プレート
function makeSignPlate(text: string) {
  const c = document.createElement("canvas");
  c.width = 1024; c.height = 256;
  const g = c.getContext("2d")!;
  g.fillStyle = "#4b5563"; g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = "rgba(255,255,255,0.08)"; g.fillRect(0, 0, c.width, 60);
  g.font = "bold 110px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic'";
  g.fillStyle = "#e5e7eb";
  g.textAlign = "center"; g.textBaseline = "middle";
  g.fillText(text, c.width / 2, c.height / 2 + 10);
  const tex = new THREE.CanvasTexture(c);
  (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
  const m = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.4), m);
  return mesh;
}

// ベンチ（超軽量）
function makeBench() {
  const g = new THREE.Group();
  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(2.2, 0.15, 0.6),
    new THREE.MeshStandardMaterial({ color: 0x656d78, roughness: 0.9, metalness: 0.1 })
  );
  seat.castShadow = seat.receiveShadow = true;
  seat.position.y = 0.45;
  g.add(seat);

  const legMat = new THREE.MeshStandardMaterial({ color: 0x9aa3b2, roughness: 0.6 });
  const legGeo = new THREE.BoxGeometry(0.12, 0.45, 0.4);
  const legL = new THREE.Mesh(legGeo, legMat);
  const legR = legL.clone();
  legL.position.set(-0.9, 0.225, 0);
  legR.position.set(+0.9, 0.225, 0);
  [legL, legR].forEach(m => { m.castShadow = true; g.add(m); });

  return g;
}

/* ========== 本体 ========== */
ready(() => {
  // DOM
  const app = document.getElementById("app")!;
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(innerWidth, innerHeight);
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);

  // シーン/カメラ/操作
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 4000);
  const ENTRANCE_POS = new THREE.Vector3(0, 2.8, 48);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  /* ---- 環境（床/天井/ライト/ベンチ） ---- */
  const mallLen = 180;       // 通路の奥行（長さ）
  const mallWide = 48;       // 幅
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(mallWide, mallLen),
    new THREE.MeshStandardMaterial({ map: makeCarpetTexture(), roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // 天井（白）
  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(mallWide, mallLen),
    new THREE.MeshStandardMaterial({ color: 0xf1f5f9, roughness: 0.9 })
  );
  ceiling.position.y = 7.2;
  ceiling.rotation.x = Math.PI / 2;
  ceiling.receiveShadow = true;
  scene.add(ceiling);

  // 天井の「窓」風（淡く）
  const skylight = new THREE.Mesh(
    new THREE.PlaneGeometry(mallWide * 0.6, mallLen),
    new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.06 })
  );
  skylight.position.set(0, 7.201, 0.0);
  skylight.rotation.x = Math.PI / 2;
  scene.add(skylight);

  // ベンチ（中央帯に配置）
  const benchZ = [-20, 0, 20, 60, 100];
  benchZ.forEach((z, i) => {
    const b = makeBench();
    b.position.set(i % 2 === 0 ? -3.5 : 3.5, 0, -z);
    scene.add(b);
  });

  // ライティング
  // 柔らかい環境光
  scene.add(new THREE.HemisphereLight(0xffffff, 0xb0b7c3, 0.6));

  // 通路天井からのダウンライト列（スポット）
  const downLightZ = THREE.MathUtils.euclideanModulo(mallLen, 15) > 0
    ? Math.floor(mallLen / 15) : mallLen / 15;
  for (let i = 0; i <= downLightZ; i++) {
    const z = -mallLen / 2 + i * 15 + 15;
    const spot = new THREE.SpotLight(0xffffff, 0.8, 40, Math.PI / 4, 0.4);
    spot.position.set(0, 7.0, z);
    spot.target.position.set(0, 0, z);
    spot.castShadow = true;
    scene.add(spot, spot.target);
  }

  // 店先を明るくするエリアライト（左右）
  const rectLightL = new THREE.RectAreaLight(0xffffff, 6, 14, 3);
  rectLightL.position.set(-11.5, 3.2, -10);
  rectLightL.rotation.y = Math.PI / 2;
  scene.add(rectLightL);

  const rectLightR = rectLightL.clone();
  rectLightR.position.set(11.5, 3.2, -40);
  rectLightR.rotation.y = -Math.PI / 2;
  scene.add(rectLightR);

  /* ---- クリック（詳細パネル） ---- */
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];
  let booksTeleport: { pos: THREE.Vector3; tgt: THREE.Vector3 } = {
    pos: ENTRANCE_POS.clone(),
    tgt: ENTRANCE_TGT.clone(),
  };

  // 店舗（壁+入口+看板+商品パネル）
  function addShopFront({ side, z, name, items }: Booth) {
    // 通路中心からの左右オフセット
    const laneX = side === "left" ? - (mallWide * 0.37) : (mallWide * 0.37);

    const g = new THREE.Group();

    // 床の張り出し（店の土台）
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(15, 0.2, 6.2),
      new THREE.MeshStandardMaterial({ color: 0x959eab, roughness: 1 })
    );
    pad.position.set(laneX, 0.1, z);
    pad.receiveShadow = true;
    g.add(pad);

    // 背面の壁（入口開口：中央部は開ける）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e1218, roughness: 1 });
    // 左右の壁パート
    const wallL = new THREE.Mesh(new THREE.BoxGeometry(5, 3.2, 0.3), wallMat);
    const wallR = wallL.clone();

    // 通路側に少し角度を持たせる
    const faceZ = side === "left" ? 3.0 : -3.0; // 通路側面
    wallL.position.set(laneX - 5, 1.7, z + faceZ * 0.06);
    wallR.position.set(laneX + 5, 1.7, z + faceZ * 0.06);
    g.add(wallL, wallR);

    // 奥の壁（ショーウィンドウ背板）
    const back = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 0.3), wallMat);
    back.position.set(laneX, 1.7, z + faceZ * 0.1);
    g.add(back);

    // 看板（プレート）
    const sign = makeSignPlate(name);
    sign.position.set(laneX, 3.8, z + (side === "left" ? 3.1 : -3.1));
    g.add(sign);

    // 商品パネル（3枚）
    const loader = new THREE.TextureLoader();
    const spacing = 12 / (items.length + 1);
    items.forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      const px = laneX - 6 + spacing * (i + 1);
      const pz = z + (side === "left" ? 3.02 : -3.02);

      quad.position.set(px, 1.6, pz);
      quad.rotation.y = side === "left" ? Math.PI : 0; // 通路向き
      quad.userData = it; // {title, price, desc, image, url}
      quad.castShadow = true;
      clickable.push(quad);
      g.add(quad);
    });

    scene.add(g);

    // 「本屋の目の前」テレポ座標
    if (name.toLowerCase() === "books") {
      const pos = new THREE.Vector3(side === "left" ? -4 : 4, 2.6, z + (side === "left" ? 9 : -9));
      const tgt = new THREE.Vector3(laneX, 1.6, z + (side === "left" ? 3 : -3));
      booksTeleport = { pos, tgt };
    }
  }

  // ブース配置（zを間延びさせて奥行きを出す）
  const zScale = 1.8;
  BOOTHS.map(b => ({ ...b, z: b.z * zScale })).forEach(addShopFront);

  /* ---- 右パネル ---- */
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

  // クリック/タップ
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

  // テレポートUI
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }
  (document.getElementById("goEntrance") as HTMLButtonElement).onclick = () => jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  (document.getElementById("goBooks") as HTMLButtonElement).onclick = () => jumpTo(booksTeleport.pos, booksTeleport.tgt);
  (document.getElementById("reset") as HTMLButtonElement).onclick = () => {
    camera.position.set(0, 4, 14);
    controls.target.set(0, 1.6, 0);
    controls.update();
  };

  // AIボタン（既存のエンドポイント）
  const askBtn = document.getElementById("askAI") as HTMLButtonElement | null;
  askBtn?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;
    askBtn.disabled = true; askBtn.textContent = "問い合わせ中…";
    try {
      const r = await fetch("https://vr-mall-api.vercel.app/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context: { where: "entrance" } }),
      });
      const data = await r.json();
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e) {
      alert("通信エラー: " + (e as Error).message);
    } finally {
      askBtn.disabled = false; askBtn.textContent = "AIに聞く";
    }
  });

  // リサイズ&ループ
  addEventListener("resize", () => {
    camera.aspect = innerWidth / innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(innerWidth, innerHeight);
  });
  (function loop() {
    requestAnimationFrame(loop);
    controls.update();
    renderer.render(scene, camera);
  })();
});
