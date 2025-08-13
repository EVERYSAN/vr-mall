// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

/** DOM 準備 */
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") {
    setTimeout(fn, 0);
  } else {
    window.addEventListener("DOMContentLoaded", fn, { once: true });
  }
}

ready(() => {
  // ============ 基本セットアップ ============
  const app = document.getElementById("app");
  if (!app) return;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  (renderer as any).outputColorSpace = (THREE as any).SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#0f1623");

  const camera = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.1, 2000);

  // 入口から通路中心を見る（安全な初期視点）
  const ENTRANCE_POS = new THREE.Vector3(0, 2.2, 34);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);
  camera.lookAt(ENTRANCE_TGT);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ============ 照明 ============
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.8));
  const dir = new THREE.DirectionalLight(0xffffff, 0.9);
  dir.position.set(15, 18, 8);
  dir.castShadow = true;
  dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ============ 床 / 通路 / 壁 / 天井 ============
  // 通路は Z 方向（手前→奥）。左右にショップ。
  const FLOOR_LEN = 120;     // 通路の長さ
  const FLOOR_W = 42;        // 通路の幅（左右のショップ込みの横幅）
  const AISLE_W = 10;        // 真ん中の帯（廊下）幅
  const ROW_OFFSET_X = 16;   // 中央からショップ列までのオフセット（左右）
  const SHOP_SPACING = 20;   // ショップの Z 方向ピッチ

  // 床全体
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_LEN),
    new THREE.MeshStandardMaterial({ color: 0x8b939d, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  scene.add(floor);

  // 真ん中の帯（通路）
  const aisle = new THREE.Mesh(
    new THREE.PlaneGeometry(AISLE_W, FLOOR_LEN),
    new THREE.MeshStandardMaterial({ color: 0x9aa1ab, roughness: 1 })
  );
  aisle.rotation.x = -Math.PI / 2;
  aisle.position.set(0, 0.001, 0);
  aisle.receiveShadow = true;
  scene.add(aisle);

  // サイドの薄い帯（左右に影っぽいアクセント）
  const sideBandMat = new THREE.MeshStandardMaterial({ color: 0x6d747f, roughness: 1 });
  const bandL = new THREE.Mesh(new THREE.PlaneGeometry(6, FLOOR_LEN), sideBandMat);
  const bandR = bandL.clone();
  bandL.rotation.x = bandR.rotation.x = -Math.PI / 2;
  bandL.position.set(-AISLE_W / 2 - 6, 0.001, 0);
  bandR.position.set(+AISLE_W / 2 + 6, 0.001, 0);
  bandL.receiveShadow = bandR.receiveShadow = true;
  scene.add(bandL, bandR);

  // 壁（奥の突き当り＆左右）
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x0e1522, roughness: 1 });
  const backWall = new THREE.Mesh(new THREE.BoxGeometry(FLOOR_W, 6, 0.5), wallMat);
  backWall.position.set(0, 3, -FLOOR_LEN / 2);
  backWall.castShadow = true;
  backWall.receiveShadow = true;
  scene.add(backWall);

  const sideWallL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 6, FLOOR_LEN), wallMat);
  const sideWallR = sideWallL.clone();
  sideWallL.position.set(-FLOOR_W / 2, 3, 0);
  sideWallR.position.set( FLOOR_W / 2, 3, 0);
  sideWallL.castShadow = sideWallR.castShadow = true;
  sideWallL.receiveShadow = sideWallR.receiveShadow = true;
  scene.add(sideWallL, sideWallR);

  // 天井
  const ceil = new THREE.Mesh(
    new THREE.PlaneGeometry(FLOOR_W, FLOOR_LEN),
    new THREE.MeshStandardMaterial({ color: 0x363e49, roughness: 1, metalness: 0 })
  );
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(0, 6.5, 0);
  ceil.receiveShadow = true;
  scene.add(ceil);

  // 連続ライト（天井の発光パネル）
  const lightMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  for (let i = 0; i < 7; i++) {
    const w = AISLE_W * 0.8;
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(w, 2), lightMat);
    panel.rotation.x = Math.PI / 2;
    panel.position.set(0, 6.49, -i * 14 + 28);
    scene.add(panel);
  }

  // ベンチ
  function bench(x: number, z: number) {
    const g = new THREE.Group();
    const seat = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.12, 0.42),
      new THREE.MeshStandardMaterial({ color: 0x2a2f37, roughness: 0.8, metalness: 0.1 })
    );
    seat.castShadow = seat.receiveShadow = true;
    g.add(seat);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x20242a, roughness: 1 });
    const leg1 = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.25, 0.3), legMat);
    const leg2 = leg1.clone();
    leg1.position.set(-0.55, -0.2, 0);
    leg2.position.set( 0.55, -0.2, 0);
    g.add(leg1, leg2);
    g.position.set(x, 0.12, z);
    scene.add(g);
  }
  for (let i = 0; i < 6; i++) bench(0, 24 - i * 10);

  // ============ 看板（追尾） ============
  function makeFloatingSign(text: string) {
    const cvs = document.createElement("canvas");
    cvs.width = 1024; cvs.height = 256;
    const ctx = cvs.getContext("2d")!;
    ctx.fillStyle = "#c5ced9";
    ctx.fillRect(0, 0, cvs.width, cvs.height);
    ctx.fillStyle = "#2b3340";
    ctx.font = "bold 120px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, cvs.width / 2, cvs.height / 2);

    const tex = new THREE.CanvasTexture(cvs);
    (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
    const mesh = new THREE.Mesh(
      new THREE.PlaneGeometry(4.6, 1.1),
      new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
    );
    mesh.position.y = 3.2; // 高め
    return mesh;
  }

  // ============ クリック用 ============
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

  // ============ ショップ（通路向きに U 字で配置） ============
  type Side = "left" | "right";

  function addShop(booth: Booth, indexInRow: number) {
    const { side, name, items } = booth;

    // Z 位置：手前（+）→奥（-）
    const z = 24 - indexInRow * SHOP_SPACING;
    // 列の X：左右へ
    const rowX = side === "left" ? -ROW_OFFSET_X : ROW_OFFSET_X;

    const g = new THREE.Group();

    // 台座（外周）
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(8.6, 0.18, 7.2),
      new THREE.MeshStandardMaterial({ color: 0x5e6672, roughness: 1 })
    );
    pad.position.set(rowX, 0.09, z);
    pad.receiveShadow = true;
    g.add(pad);

    // U字の壁（通路に開口：つまり中央の通路へ向く）
    const wallMatShop = new THREE.MeshStandardMaterial({ color: 0x11161e, roughness: 0.9, metalness: 0.05 });
    // 後壁
    const back = new THREE.Mesh(new THREE.BoxGeometry(8, 2.6, 0.2), wallMatShop);
    // 側壁（左右）
    const sideWall = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.6, 5.8), wallMatShop);
    const sideWall2 = sideWall.clone();

    // 左列は通路に向かって +X、右列は -X が通路側
    const openToward = side === "left" ? +1 : -1;

    // 後壁は通路の反対（＝外側）
    back.position.set(rowX - 4 * openToward, 1.45, z);
    sideWall.position.set(rowX - 4 * openToward, 1.45, z - 2.9);
    sideWall2.position.set(rowX - 4 * openToward, 1.45, z + 2.9);
    // U を通路側へ向ける
    back.rotation.y = openToward === 1 ? 0 : Math.PI;

    [back, sideWall, sideWall2].forEach((m) => {
      m.castShadow = true; m.receiveShadow = true;
      g.add(m);
    });

    // 看板（追尾）— 通路側へ少し前に
    const sign = makeFloatingSign(name);
    sign.position.set(rowX - 1.8 * openToward, 2.8, z);
    g.add(sign);

    // 商品画像（通路側を向く）
    const spacing = 8 / (items.length + 1);
    const loader = new THREE.TextureLoader();

    items.slice(0, 3).forEach((it, i) => {
      const tex = loader.load(it.image);
      (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const p = new THREE.Mesh(
        new THREE.PlaneGeometry(2.2, 2.2),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })
      );
      // 通路に面した “開口” 側へ取り付け
      const faceX = rowX - 3.9 * openToward; // U の開口のへり
      const localZ = z - 3 + spacing * (i + 1);
      p.position.set(faceX, 1.6, localZ);
      // パネル自体を通路中心へ向ける
      p.rotation.y = openToward === 1 ? -Math.PI / 2 : Math.PI / 2;
      p.userData = it;
      p.castShadow = true;
      clickable.push(p);
      g.add(p);
    });

    // ガラス風のショーケース（少しだけ）
    const showcase = new THREE.Mesh(
      new THREE.BoxGeometry(3, 1.1, 1),
      new THREE.MeshStandardMaterial({ color: 0x2c333d, roughness: 0.5, metalness: 0.2 })
    );
    showcase.position.set(rowX - 1.5 * openToward, 0.55, z);
    showcase.castShadow = showcase.receiveShadow = true;
    g.add(showcase);

    scene.add(g);
  }

  // 配列 BOOTHS を「左列」「右列」に分け、通路向きで並べる
  const leftRow = BOOTHS.filter(b => b.side === "left");
  const rightRow = BOOTHS.filter(b => b.side === "right");
  leftRow.forEach((b, i) => addShop(b, i));
  rightRow.forEach((b, i) => addShop(b, i));

  // ============ クリック =============
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

  // ============ テレポート ============
  function smoothJump(pos: THREE.Vector3, tgt: THREE.Vector3) {
    const startPos = camera.position.clone();
    const startTgt = controls.target.clone();
    const dur = 400; // ms
    const t0 = performance.now();
    function step(now: number) {
      const t = Math.min(1, (now - t0) / dur);
      camera.position.lerpVectors(startPos, pos, t);
      controls.target.lerpVectors(startTgt, tgt, t);
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  (document.getElementById("goEntrance") as HTMLButtonElement)?.addEventListener("click", () => {
    smoothJump(ENTRANCE_POS, ENTRANCE_TGT);
  });
  (document.getElementById("reset") as HTMLButtonElement)?.addEventListener("click", () => {
    smoothJump(new THREE.Vector3(0, 3.2, 18), new THREE.Vector3(0, 1.6, 0));
  });
  (document.getElementById("goLeftRow") as HTMLButtonElement)?.addEventListener("click", () => {
    smoothJump(new THREE.Vector3(-ROW_OFFSET_X, 2.2, 12), new THREE.Vector3(0, 1.6, -12));
  });
  (document.getElementById("goRightRow") as HTMLButtonElement)?.addEventListener("click", () => {
    smoothJump(new THREE.Vector3( ROW_OFFSET_X, 2.2, 12), new THREE.Vector3(0, 1.6, -12));
  });

  // ============ AI問い合わせ（Vercel のエンドポイント） ============
  const askBtn = document.getElementById("askAI") as HTMLButtonElement | null;
  askBtn?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (!q) return;
    askBtn.disabled = true; askBtn.textContent = "問い合わせ中…";
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
      askBtn.disabled = false; askBtn.textContent = "AIに聞く";
    }
  });

  // ============ リサイズ / ループ ============
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  (function animate() {
    requestAnimationFrame(animate);
    // 追尾看板は常に通路方向に近い向きに（緩め）
    scene.traverse((o) => {
      if ((o as THREE.Mesh).geometry && (o as THREE.Mesh).material && o.type === "Mesh") {
        // floating sign は高さ 3.2 & PlaneGeometry(4.6,1.1) のみ
        const m = o as THREE.Mesh;
        if (m.geometry.type === "PlaneGeometry" && Math.abs(m.position.y - 3.2) < 0.01 && (m as any).__isSign !== false) {
          m.lookAt(new THREE.Vector3(0, m.position.y, m.position.z)); // 通路中心方向へ
        }
      }
    });
    controls.update();
    renderer.render(scene, camera);
  })();
});
