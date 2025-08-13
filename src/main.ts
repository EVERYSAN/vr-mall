// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { GUI } from "lil-gui";
import { BOOTHS, Booth, Item } from "./booths";

/** ---------- 基本ユーティリティ ---------- */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  console.log("boot main.ts");

  // ---------- DOM / Renderer ----------
  const app = document.getElementById("app");
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
  renderer.shadowMap.enabled = true;
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  app.appendChild(renderer.domElement);

  // ---------- Scene / Camera / Controls ----------
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2500);
  const ENTRANCE_POS = new THREE.Vector3(0, 3.2, 42);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ---------- 調整パラメータ（GUI） ----------
  const params = {
    aisleWidth: 8,          // 通路幅
    sidewalk: 2,            // 通路と店舗の間（縁石）
    boothDepth: 6,          // 店の奥行（通路→店内方向）
    boothWidth: 12,         // 店幅（z方向）
    boothSpacing: 14,       // 店同士の間隔（z方向）
    labelHeight: 3.2,       // 看板の高さ
    signTiltDeg: 0,         // 看板の傾き（+で上向き）
    ceilingY: 8,            // 天井高さ
    corridorLen: 120,       // 通路長
    cameraY: 3.2            // カメラ高さ
  };

  // ---------- ライト ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.7));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(10, 14, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ---------- 床・天井・側面 ----------
  const envGroup = new THREE.Group();
  scene.add(envGroup);

  function rebuildEnv() {
    envGroup.clear();

    const FLOOR_W = params.aisleWidth + params.sidewalk * 2 + params.boothDepth * 2 + 2; // 少し余白
    const FLOOR_L = params.corridorLen;

    // 通路床（中央グレー）
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
      new THREE.MeshStandardMaterial({ color: 0x8f949b, roughness: 1 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    floor.position.set(0, 0, 0);
    envGroup.add(floor);

    // サイドウォーク（濃い帯）
    const walkMat = new THREE.MeshStandardMaterial({ color: 0x6b7179, roughness: 1 });
    const leftWalk = new THREE.Mesh(new THREE.PlaneGeometry(params.sidewalk, FLOOR_L), walkMat);
    leftWalk.rotation.x = -Math.PI / 2;
    leftWalk.position.set(-params.aisleWidth / 2 - params.sidewalk / 2, 0.001, 0);
    leftWalk.receiveShadow = true;

    const rightWalk = leftWalk.clone();
    rightWalk.position.x = +params.aisleWidth / 2 + params.sidewalk / 2;

    envGroup.add(leftWalk, rightWalk);

    // 壁（内側黒）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x101419, roughness: 0.8, metalness: 0.0 });
    const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.6, params.ceilingY, FLOOR_L), wallMat);
    const sideWallR = sideWallL.clone();

    sideWallL.position.set(- (params.aisleWidth / 2 + params.sidewalk + params.boothDepth) - 0.3, params.ceilingY / 2, 0);
    sideWallR.position.set(+ (params.aisleWidth / 2 + params.sidewalk + params.boothDepth) + 0.3, params.ceilingY / 2, 0);

    sideWallL.castShadow = sideWallR.castShadow = true;
    sideWallL.receiveShadow = sideWallR.receiveShadow = true;
    envGroup.add(sideWallL, sideWallR);

    // 天井（薄グレー）
    const ceiling = new THREE.Mesh(
      new THREE.PlaneGeometry(FLOOR_W, FLOOR_L),
      new THREE.MeshStandardMaterial({ color: 0x50545c, roughness: 1 })
    );
    ceiling.rotation.x = Math.PI / 2;
    ceiling.position.set(0, params.ceilingY, 0);
    envGroup.add(ceiling);

    // 簡易ダウンライト列
    const lampMat = new THREE.MeshStandardMaterial({ color: 0xededed, emissive: 0x202020, roughness: 0.7 });
    for (let i = -FLOOR_L / 2 + 8; i < FLOOR_L / 2; i += 12) {
      const lamp = new THREE.Mesh(new THREE.PlaneGeometry(params.aisleWidth * 0.65, 0.8), lampMat);
      lamp.rotation.x = Math.PI / 2;
      lamp.position.set(0, params.ceilingY - 0.01, i);
      envGroup.add(lamp);
    }
  }

  // ---------- ブース ----------
  const boothGroup = new THREE.Group();
  scene.add(boothGroup);

  // ラベル生成（CanvasTexture）
  function labelSprite(text: string, scaleX = 6, scaleY = 1.4, tiltDeg = 0) {
    const w = 1024, h = 256;
    const cvs = document.createElement("canvas");
    cvs.width = w; cvs.height = h;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#b8c0cc";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#263244";
    ctx.fillRect(0, h - 14, w, 14);

    ctx.font = "bold 112px system-ui, -apple-system, Segoe UI, Roboto, 'Yu Gothic', sans-serif";
    ctx.fillStyle = "#1f2937";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, w / 2, h / 2);

    const tex = new THREE.CanvasTexture(cvs);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    spr.scale.set(scaleX, scaleY, 1);
    // 看板の上下傾き
    spr.material.rotation = THREE.MathUtils.degToRad(tiltDeg);
    return spr;
  }

  // 店を1軒つくる
  function buildOneBooth(spec: Booth, index: number) {
    const g = new THREE.Group();

    const xSide = (params.aisleWidth / 2) + params.sidewalk + params.boothDepth / 2;
    const zPos = -params.corridorLen / 2 + 16 + index * params.boothSpacing;

    // サイドごとの位置（開口は通路側）
    const isLeft = spec.side === "left";
    const baseX = isLeft ? -xSide : +xSide;

    // ベース
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(params.boothDepth, 0.22, params.boothWidth),
      new THREE.MeshStandardMaterial({ color: 0x7b8694, roughness: 1 })
    );
    base.position.set(baseX, 0.11, zPos);
    base.receiveShadow = true;
    g.add(base);

    // 壁：背面＋左右。開口は通路側（内側＝通路に向く）
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x0f141b, roughness: 0.8 });
    const back = new THREE.Mesh(
      new THREE.BoxGeometry(params.boothDepth, 2.7, 0.22),
      wallMat
    );
    back.position.set(baseX + (isLeft ? -params.boothDepth / 2 + 0.11 : +params.boothDepth / 2 - 0.11), 1.35, zPos);
    back.castShadow = true;
    back.receiveShadow = true;

    const sideL = new THREE.Mesh(new THREE.BoxGeometry(0.22, 2.7, params.boothWidth * 0.55), wallMat);
    const sideR = sideL.clone();

    sideL.position.set(baseX, 1.35, zPos - params.boothWidth / 2 + sideL.scale.z * 0.5);
    sideR.position.set(baseX, 1.35, zPos + params.boothWidth / 2 - sideR.scale.z * 0.5);

    sideL.castShadow = sideR.castShadow = true;
    sideL.receiveShadow = sideR.receiveShadow = true;

    g.add(back, sideL, sideR);

    // 看板
    const label = labelSprite(spec.name, 6, 1.4, params.signTiltDeg);
    label.position.set(baseX + (isLeft ? +params.boothDepth / 2 + 0.25 : -params.boothDepth / 2 - 0.25), params.labelHeight, zPos);
    // 通路中央(0,*,z) へ向ける（文字が反転しないようSpriteの回転ではなくlookAtで面を向ける）
    const lookTarget = new THREE.Vector3(0, params.labelHeight, zPos);
    label.lookAt(lookTarget);
    g.add(label);

    // 商品パネル（内側＝通路中心を向く）
    const loader = new THREE.TextureLoader();
    const row = new THREE.Group();
    const spacing = (params.boothWidth - 2.0) / (spec.items.length + 1);

    spec.items.forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );

      const px = baseX + (isLeft ? +params.boothDepth / 2 - 0.2 : -params.boothDepth / 2 + 0.2); // 開口のすぐ内側
      const pz = zPos - params.boothWidth / 2 + spacing * (i + 1);
      p.position.set(px, 1.6, pz);
      // 通路中心(0,*,z)の方向へ向ける（＝常に通路側を向く）
      p.lookAt(new THREE.Vector3(0, 1.6, pz));

      p.userData = it;
      p.castShadow = true;
      row.add(p);
    });

    g.add(row);
    boothGroup.add(g);
  }

  function rebuildBooths() {
    boothGroup.clear();
    BOOTHS.forEach(buildOneBooth);
  }

  // ---------- アイテム詳細パネル ----------
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

  // ---------- クリック判定 ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();

  function pickFrom(ev: MouseEvent | TouchEvent) {
    const isTouch = (ev as TouchEvent).changedTouches?.length;
    const px = isTouch ? (ev as TouchEvent).changedTouches[0].clientX : (ev as MouseEvent).clientX;
    const py = isTouch ? (ev as TouchEvent).changedTouches[0].clientY : (ev as MouseEvent).clientY;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(boothGroup.children, true);
    if (!hits.length) return;
    // userData を持つ最初のメッシュを探す
    const hit = hits.find(h => (h.object as any).userData && (h.object as any).userData.title);
    if (hit) openDetail((hit.object as any).userData as Item);
  }
  renderer.domElement.addEventListener("click", pickFrom);
  renderer.domElement.addEventListener("touchend", (e) => { pickFrom(e); e.preventDefault(); }, { passive: false });

  // ---------- テレポート ----------
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }
  (document.getElementById("goEntrance") as HTMLButtonElement).onclick = () =>
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  (document.getElementById("goBooks") as HTMLButtonElement).onclick = () => {
    // Books の前（最初に見つかったもの）
    const idx = BOOTHS.findIndex(b => b.name.toLowerCase() === "books");
    const z = idx >= 0 ? -params.corridorLen / 2 + 16 + idx * params.boothSpacing : 0;
    const pos = new THREE.Vector3(0, params.cameraY, z + 12);
    const tgt = new THREE.Vector3(0, 1.6, z);
    jumpTo(pos, tgt);
  };
  (document.getElementById("reset") as HTMLButtonElement).onclick = () => {
    camera.position.set(0, params.cameraY, 14);
    controls.target.set(0, 1.6, 0);
    controls.update();
  };
  (document.getElementById("lookLeft") as HTMLButtonElement)?.addEventListener("click", () => {
    const pos = new THREE.Vector3(-(params.aisleWidth / 2 + 2), params.cameraY, 8);
    const tgt = new THREE.Vector3(0, 1.6, 8);
    jumpTo(pos, tgt);
  });
  (document.getElementById("lookRight") as HTMLButtonElement)?.addEventListener("click", () => {
    const pos = new THREE.Vector3((params.aisleWidth / 2 + 2), params.cameraY, 8);
    const tgt = new THREE.Vector3(0, 1.6, 8);
    jumpTo(pos, tgt);
  });

  // ---------- GUI ----------
  const gui = new GUI({ title: "Mall Layout" });
  gui.add(params, "aisleWidth", 6, 16, 0.1).name("通路幅").onChange(() => { rebuildEnv(); rebuildBooths(); });
  gui.add(params, "sidewalk", 0.5, 4, 0.1).name("縁石幅").onChange(() => { rebuildEnv(); rebuildBooths(); });
  gui.add(params, "boothDepth", 3, 10, 0.1).name("店の奥行").onChange(() => { rebuildEnv(); rebuildBooths(); });
  gui.add(params, "boothWidth", 8, 18, 0.1).name("店の幅(z)").onChange(rebuildBooths);
  gui.add(params, "boothSpacing", 10, 24, 0.1).name("店舗間隔").onChange(rebuildBooths);
  gui.add(params, "labelHeight", 2.0, 5.0, 0.1).name("看板高さ").onChange(rebuildBooths);
  gui.add(params, "signTiltDeg", -25, 25, 1).name("看板傾き").onChange(rebuildBooths);
  gui.add(params, "ceilingY", 5, 12, 0.1).name("天井高さ").onChange(rebuildEnv);
  gui.add(params, "corridorLen", 60, 200, 1).name("通路長").onChange(() => { rebuildEnv(); rebuildBooths(); });
  gui.add(params, "cameraY", 2.0, 5.0, 0.1).name("カメラ高さ").onChange(() => {
    camera.position.y = params.cameraY; controls.update();
  });

  // ---------- 初期構築 ----------
  rebuildEnv();
  rebuildBooths();

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

  // ----------（任意）AI問い合わせボタン：エンドポイントがあれば使ってOK ----------
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
});
