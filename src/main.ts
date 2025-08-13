// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

/** DOM 準備 */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  // ---------------- 基本セットアップ ----------------
  const app = document.getElementById("app");
  if (!app) {
    console.error("#app が見つかりません");
    return;
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  // three r160+
  // @ts-ignore
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");
  scene.fog = new THREE.Fog(0x0f1623, 30, 140);

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 800);
  const ENTRANCE_POS = new THREE.Vector3(0, 2.9, 16);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.8, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ---------------- 環境光・ディレクショナル ----------------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x223, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 1.0);
  dir.position.set(8, 16, 10);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ---------------- 通路・床 ----------------
  const FLOOR_Y = 0;

  function mkMesh(geo: THREE.BufferGeometry, mat: THREE.Material, x=0,y=0,z=0, rx=0,ry=0,rz=0) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x,y,z);
    m.rotation.set(rx,ry,rz);
    return m;
  }

  const matFloorMain   = new THREE.MeshStandardMaterial({ color: 0x8b9299, roughness: 1 });
  const matFloorBand   = new THREE.MeshStandardMaterial({ color: 0x646b73, roughness: 1 });
  const matFloorStrip  = new THREE.MeshStandardMaterial({ color: 0x535960, roughness: 1 });

  const plane = (w:number,d:number,mat:THREE.Material,y=FLOOR_Y, rotX=-Math.PI/2) =>
    mkMesh(new THREE.PlaneGeometry(w,d), mat, 0, y, 0, rotX);

  // メイン床（大）
  const floor = plane(80, 160, matFloorMain);
  floor.receiveShadow = true;
  scene.add(floor);

  // 中央通路（色違い帯）
  const center = plane(10, 160, matFloorBand, FLOOR_Y+0.001);
  scene.add(center);

  // 斜め帯（イオン感）
  const bandW = 12;
  for (let i=0;i<4;i++){
    const b = plane(bandW, 140, matFloorStrip, FLOOR_Y+0.0005);
    b.position.x = -18 + i*12;
    b.rotation.z = (i%2===0?1:-1)*0.08;
    scene.add(b);
  }

  // ---------------- ベンチ（簡易） ----------------
  function addBench(z: number, x=0){
    const g = new THREE.Group();
    const seat = mkMesh(new THREE.BoxGeometry(2.2, 0.18, 0.6),
      new THREE.MeshStandardMaterial({ color: 0x2f3439 }), x, FLOOR_Y+0.2, z);
    seat.castShadow = seat.receiveShadow = true;
    g.add(seat);
    for (const ox of [-0.9, 0.9]){
      const leg = mkMesh(new THREE.BoxGeometry(0.12, 0.36, 0.12),
        new THREE.MeshStandardMaterial({ color: 0x1e2328 }),
        x+ox, FLOOR_Y+0.18, z-0.18);
      leg.castShadow = true;
      g.add(leg);
    }
    scene.add(g);
  }
  [-4, -12, -20, -28].forEach((z)=> addBench(z, 0));

  // ---------------- サイド壁 ----------------
  const sideWallMat = new THREE.MeshStandardMaterial({ color: 0x121822, roughness: 0.9 });
  const sideL = mkMesh(new THREE.PlaneGeometry(200, 10), sideWallMat, -30, 5, -30);
  sideL.rotation.y =  Math.PI/2;
  const sideR = mkMesh(new THREE.PlaneGeometry(200, 10), sideWallMat,  30, 5, -30);
  sideR.rotation.y = -Math.PI/2;
  scene.add(sideL, sideR);

  // ---------------- 天井・照明パネル ----------------
  const ceil = plane(80, 160,
    new THREE.MeshStandardMaterial({ color: 0x3c4247, roughness: 1 }),
    FLOOR_Y+9, Math.PI/2);
  scene.add(ceil);

  function addCeilingPanel(z:number, width=14){
    const p = plane(width, 3.6,
      new THREE.MeshBasicMaterial({ color: 0xffffff }), FLOOR_Y+8.99, Math.PI/2);
    p.position.z = z;
    scene.add(p);
  }
  [-16, -32, -48, -64, -80, -96, -112, -128].forEach(z => addCeilingPanel(z));

  // =========================================================
  //                ここから “連続ファサード” 本体
  // =========================================================

  // SRGB 指定の簡易テクスチャローダ
  function loadTex(url: string) {
    const tex = new THREE.TextureLoader().load(url);
    // @ts-ignore
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  type StoreOpts = {
    side: "left" | "right";
    idx: number;
    bayWidth?: number;
    bayDepth?: number;
    gap?: number;
    zStart?: number;
    floorY?: number;
    name?: string;
    banner?: string;
    productImgs?: string[];
  };

  function createStorefront(opts: StoreOpts) {
    const {
      side,
      idx,
      bayWidth = 12,
      bayDepth = 7,
      gap = 7,
      zStart = -10,
      floorY = FLOOR_Y,
      name = "Store",
      banner = "https://picsum.photos/seed/banner/1200/400",
      productImgs = [
        "https://picsum.photos/seed/p1/600/800",
        "https://picsum.photos/seed/p2/600/800",
        "https://picsum.photos/seed/p3/600/800",
      ],
    } = opts;

    const x = side === "left" ? -16 : 16;
    const z = zStart - idx * (bayDepth + gap);
    const g = new THREE.Group();

    // ベース
    const base = mkMesh(
      new THREE.BoxGeometry(bayWidth + 2, 0.2, bayDepth + 2),
      new THREE.MeshStandardMaterial({ color: 0x5a6168, roughness: 1 }),
      x, floorY+0.1, z
    );
    base.receiveShadow = true;
    g.add(base);

    // 柱
    const colMat = new THREE.MeshStandardMaterial({ color: 0x0e1217, roughness: 0.9 });
    const pillarW = 0.45, pillarH = 5.2;
    const leftCol  = mkMesh(new THREE.BoxGeometry(pillarW, pillarH, 0.7), colMat,
      x - bayWidth/2, floorY + pillarH/2, z + (side==="left" ? -0.35 : 0.35));
    const rightCol = mkMesh(new THREE.BoxGeometry(pillarW, pillarH, 0.7), colMat,
      x + bayWidth/2, floorY + pillarH/2, z + (side==="left" ? -0.35 : 0.35));
    leftCol.castShadow = rightCol.castShadow = true;
    g.add(leftCol, rightCol);

    // 梁
    const beam = mkMesh(new THREE.BoxGeometry(bayWidth+0.6, 0.55, 0.7),
      new THREE.MeshStandardMaterial({ color: 0x20262d, roughness: 0.8 }),
      x, floorY + pillarH - 0.2, z + (side==="left" ? -0.35 : 0.35));
    beam.castShadow = true;
    g.add(beam);

    // 看板（横長）
    const signCanvas = document.createElement("canvas");
    signCanvas.width = 1024; signCanvas.height = 256;
    const sctx = signCanvas.getContext("2d")!;
    sctx.fillStyle = "#9aa4b2";
    sctx.fillRect(0,0,1024,256);
    sctx.font = "bold 120px system-ui, sans-serif";
    sctx.fillStyle = "#0b0f1a";
    sctx.textAlign = "center";
    sctx.textBaseline = "middle";
    sctx.fillText(name, 512, 128);
    const signTex = new THREE.CanvasTexture(signCanvas);
    // @ts-ignore
    signTex.colorSpace = THREE.SRGBColorSpace;

    const sign = mkMesh(
      new THREE.PlaneGeometry(bayWidth*0.92, 1.05),
      new THREE.MeshStandardMaterial({ map: signTex, emissive: 0x0b0b0b, emissiveIntensity: 0.35 }),
      x, floorY + pillarH - 0.9, z + (side==="left" ? -0.62 : 0.62)
    );
    sign.rotation.y = side==="left" ? Math.PI : 0;
    sign.castShadow = true;
    g.add(sign);

    // ガラス
    const glass = mkMesh(
      new THREE.PlaneGeometry(bayWidth - pillarW*2 - 0.5, 3.2),
      new THREE.MeshPhysicalMaterial({
        color: 0xffffff, roughness: 0.1, metalness: 0,
        transmission: 0.9, thickness: 0.05, transparent: true, opacity: 0.9, ior: 1.3
      }),
      x, floorY + 1.8, z + (side==="left" ? -0.61 : 0.61)
    );
    glass.rotation.y = side==="left" ? Math.PI : 0;
    g.add(glass);

    // 内装（浅いボックス）
    const inner = new THREE.Group();
    const innerDepth = bayDepth - 1.2;
    const innerCenterZ = z + (side==="left" ? -0.6 - innerDepth/2 : 0.6 + innerDepth/2);

    // 奥壁
    const backWall = mkMesh(new THREE.PlaneGeometry(bayWidth-0.8, 3.4),
      new THREE.MeshStandardMaterial({ color: 0x3b424c, roughness: 0.9 }),
      x, floorY+1.9, z + (side==="left" ? -0.6 - innerDepth : 0.6 + innerDepth));
    backWall.rotation.y = side==="left" ? Math.PI : 0;
    backWall.receiveShadow = true;
    inner.add(backWall);

    // 側壁
    const sideMat = new THREE.MeshStandardMaterial({ color: 0x2b3138, roughness: 1 });
    const sideL = mkMesh(new THREE.BoxGeometry(0.22, 3.4, innerDepth),
      sideMat, x - bayWidth/2 + 0.11, floorY+1.7, innerCenterZ);
    const sideR = mkMesh(new THREE.BoxGeometry(0.22, 3.4, innerDepth),
      sideMat, x + bayWidth/2 - 0.11, floorY+1.7, innerCenterZ);
    inner.add(sideL, sideR);

    // バナー
    const bannerMesh = mkMesh(new THREE.PlaneGeometry(bayWidth - 1.0, 0.85),
      new THREE.MeshStandardMaterial({ map: loadTex(banner), emissive: 0x050505, emissiveIntensity: 0.3 }),
      x, floorY + pillarH - 1.7, z + (side==="left" ? -0.62 : 0.62));
    bannerMesh.rotation.y = side==="left" ? Math.PI : 0;
    inner.add(bannerMesh);

    // 商品ポスター（奥〜中間）
    const posterZs = [0.35, 0.65, 0.9].map(t =>
      side === "left" ? -0.6 - innerDepth * t : 0.6 + innerDepth * t
    );
    productImgs.forEach((u, i) => {
      const poster = mkMesh(new THREE.PlaneGeometry(1.5, 2.1),
        new THREE.MeshStandardMaterial({ map: loadTex(u) }),
        x - bayWidth*0.28 + i*1.4, floorY+1.6, posterZs[i%posterZs.length]);
      poster.rotation.y = side==="left" ? Math.PI : 0;
      poster.castShadow = true;
      inner.add(poster);
    });

    // 天井発光パネル（内装側）
    const lp = plane(bayWidth - 1.2, 0.9,
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
      FLOOR_Y+3.3, Math.PI/2);
    lp.position.x = x;
    lp.position.z = z + (side==="left" ? -0.6 - innerDepth*0.45 : 0.6 + innerDepth*0.45);
    inner.add(lp);

    g.add(inner);

    scene.add(g);
    return { group: g, x, z };
  }

  // ---- 店を量産（左右に連続） ----
  const leftNames  = ["Fashion", "Home", "Toys", "Music"];
  const rightNames = ["Books", "Gadgets", "Beauty", "Cafe"];
  let booksTeleport = { pos: ENTRANCE_POS.clone(), tgt: ENTRANCE_TGT.clone() };

  leftNames.forEach((n, i) => {
    createStorefront({
      side: "left",
      idx: i,
      name: n,
      banner: `https://picsum.photos/seed/${n}-bn/1200/400`,
      productImgs: [
        `https://picsum.photos/seed/${n}-a/600/800`,
        `https://picsum.photos/seed/${n}-b/600/800`,
        `https://picsum.photos/seed/${n}-c/600/800`,
      ],
    });
  });

  rightNames.forEach((n, i) => {
    const r = createStorefront({
      side: "right",
      idx: i,
      name: n,
      banner: `https://picsum.photos/seed/${n}-bn/1200/400`,
      productImgs: [
        `https://picsum.photos/seed/${n}-a/600/800`,
        `https://picsum.photos/seed/${n}-b/600/800`,
        `https://picsum.photos/seed/${n}-c/600/800`,
      ],
    });
    // 「本屋へ」ジャンプ用
    if (n === "Books") {
      const pos = new THREE.Vector3(r.x - 3.8, 2.6, r.z + 8.2);
      const tgt = new THREE.Vector3(r.x, 1.6, r.z + 2.0);
      booksTeleport = { pos, tgt };
    }
  });

  // ---------------- 操作ボタン ----------------
  function jumpTo(pos: THREE.Vector3, tgt: THREE.Vector3) {
    camera.position.copy(pos);
    controls.target.copy(tgt);
    controls.update();
  }

  (document.getElementById("goEntrance") as HTMLButtonElement)?.addEventListener("click", () =>
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT)
  );

  (document.getElementById("goBooks") as HTMLButtonElement)?.addEventListener("click", () =>
    jumpTo(booksTeleport.pos, booksTeleport.tgt)
  );

  (document.getElementById("reset") as HTMLButtonElement)?.addEventListener("click", () => {
    camera.position.set(0, 3.8, 10);
    controls.target.set(0, 1.6, 0);
    controls.update();
  });

  (document.getElementById("lookLeft") as HTMLButtonElement)?.addEventListener("click", () => {
    controls.target.set(-16, 1.6, controls.target.z - 4);
    controls.update();
  });
  (document.getElementById("lookRight") as HTMLButtonElement)?.addEventListener("click", () => {
    controls.target.set(16, 1.6, controls.target.z - 4);
    controls.update();
  });

  // ---------------- AIに聞く（Vercel API 呼び出し） ----------------
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
      const data = await r.json();
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e:any) {
      alert("通信エラー: " + (e?.message || e));
    } finally {
      btn.disabled = false; btn.textContent = "AIに聞く";
    }
  });

  // ---------------- リサイズ & ループ ----------------
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (function animate(){
    requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  })();

});
