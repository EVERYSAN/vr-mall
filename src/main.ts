// src/main.ts
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { BOOTHS, Booth, Item } from "./booths";

// DOM 準備
function ready(fn: () => void) {
  if (document.readyState === "complete" || document.readyState === "interactive") setTimeout(fn, 0);
  else window.addEventListener("DOMContentLoaded", fn, { once: true });
}

ready(() => {
  console.log("boot main.ts");

  // ---------- 基本 ----------
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
  const ENTRANCE_POS = new THREE.Vector3(0, 3.0, 38);
  const ENTRANCE_TGT = new THREE.Vector3(0, 1.6, 0);
  camera.position.copy(ENTRANCE_POS);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.target.copy(ENTRANCE_TGT);

  // ---------- ライト（明るめで商業施設っぽく） ----------
  scene.add(new THREE.HemisphereLight(0xffffff, 0x334155, 0.9));
  const dir = new THREE.DirectionalLight(0xffffff, 1.1);
  dir.position.set(10, 18, 10);
  dir.castShadow = true; dir.shadow.mapSize.set(2048, 2048);
  scene.add(dir);

  // ---------- フロア（通路＋センターカーペット帯） ----------
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(70, 120),
    new THREE.MeshStandardMaterial({ color: 0xe5e7eb, roughness: 1 })
  );
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; scene.add(floor);

  // センターカーペット（少し濃いグレー → “イオンの帯”）
  const carpet = new THREE.Mesh(
    new THREE.PlaneGeometry(10, 120),
    new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 1 })
  );
  carpet.rotation.x = -Math.PI / 2; carpet.position.y = 0.001; scene.add(carpet);

  // サブ帯（両脇の淡いグレー）
  const subLeft = new THREE.Mesh(
    new THREE.PlaneGeometry(6, 120),
    new THREE.MeshStandardMaterial({ color: 0xd8dee9, roughness: 1 })
  );
  subLeft.rotation.x = -Math.PI / 2; subLeft.position.set(-8, 0.001, 0); scene.add(subLeft);

  const subRight = subLeft.clone(); subRight.position.x = 8; scene.add(subRight);

  // ---------- クリック判定 ----------
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  const clickable: THREE.Object3D[] = [];

  let booksTeleport = { pos: ENTRANCE_POS.clone(), tgt: ENTRANCE_TGT.clone() };

  // 店名ラベル
  function labelSprite(text: string) {
    const canvas = document.createElement("canvas");
    canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#1e293b"; ctx.fillRect(0,0,512,128);
    ctx.font = "bold 48px system-ui, sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "middle";
    ctx.fillStyle = "#e5e7eb"; ctx.fillText(text, 256, 64);
    const tex = new THREE.CanvasTexture(canvas);
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent:true }));
    s.scale.set(8, 2, 1);
    return s;
  }

  // ブース（ショーウィンドウ）生成
  function addBooth({ side, z, name, items }: Booth) {
    const x = side === "left" ? -16 : 16;  // 通路左右
    const g = new THREE.Group();

    // 店舗ベース（床台）
    const base = new THREE.Mesh(
      new THREE.BoxGeometry(14, 0.25, 6),
      new THREE.MeshStandardMaterial({ color: 0x9aa5b1, roughness: 1 })
    );
    base.position.set(x, 0.125, z); base.receiveShadow = true; g.add(base);

    // 背面ウォール（黒っぽいパネル＝ショーウィンドウ）
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(14, 3.5, 0.25),
      new THREE.MeshStandardMaterial({ color: 0x111827, roughness: 1 })
    );
    wall.position.set(x, 1.8, z - (side === "left" ? -2.3 : 2.3));
    wall.castShadow = true; wall.receiveShadow = true; g.add(wall);

    // 店名ラベル
    const label = labelSprite(name);
    label.position.set(x, 3.9, z - (side === "left" ? -2.5 : 2.5));
    g.add(label);

    // 商品パネル
    const loader = new THREE.TextureLoader();
    const spacing = 14 / (items.length + 1);
    items.forEach((it, i) => {
      const tex = loader.load(it.image); (tex as any).colorSpace = (THREE as any).SRGBColorSpace;
      const quad = new THREE.Mesh(
        new THREE.PlaneGeometry(2.6, 2.6),
        new THREE.MeshBasicMaterial({ map: tex, toneMapped:false })
      );
      const faceZ = side === "left" ? 2.05 : -2.05;
      quad.position.set(x - 7 + spacing*(i+1), 1.6, z + faceZ);
      quad.rotation.y = side === "left" ? Math.PI : 0;
      quad.userData = it; quad.castShadow = true; clickable.push(quad);
      g.add(quad);
    });

    scene.add(g);

    if (name === "Books") {
      const pos = new THREE.Vector3(side === "left" ? -6 : 6, 2.6, z + (side === "left" ? 6.8 : -6.8));
      const tgt = new THREE.Vector3(x, 1.6, z + (side === "left" ? 2.0 : -2.0));
      booksTeleport = { pos, tgt };
    }
  }

  BOOTHS.forEach(addBooth);

  // 右パネルの開閉
  function openDetail({ title, price, desc, image, url }: Item) {
    const wrap = document.getElementById("detail")!;
    (document.getElementById("dTitle") as HTMLHeadingElement).textContent = title || "Item";
    (document.getElementById("dImg") as HTMLImageElement).src = image || "";
    (document.getElementById("dPrice") as HTMLParagraphElement).textContent = price || "価格未設定";
    (document.getElementById("dDesc") as HTMLParagraphElement).textContent = desc || "説明";
    (document.getElementById("dLink") as HTMLAnchorElement).href = url || "#";
    wrap.style.transform = "translateX(0%)";
  }
  (document.getElementById("closeDetail") as HTMLButtonElement).onclick = () =>
    (document.getElementById("detail") as HTMLElement).style.transform = "translateX(100%)";

  // クリック/タップ
  function pick(ev: MouseEvent | TouchEvent) {
    const t = (ev as TouchEvent).changedTouches?.[0];
    const px = t ? t.clientX : (ev as MouseEvent).clientX;
    const py = t ? t.clientY : (ev as MouseEvent).clientY;
    const rect = renderer.domElement.getBoundingClientRect();
    mouse.x = ((px - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((py - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(mouse, camera);
    const hits = raycaster.intersectObjects(clickable, false);
    if (hits.length) openDetail(hits[0].object.userData as Item);
  }
  renderer.domElement.addEventListener("click", pick);
  renderer.domElement.addEventListener("touchend", e => { pick(e); e.preventDefault(); }, { passive:false });

  // テレポート
  const jumpTo = (pos:THREE.Vector3, tgt:THREE.Vector3) => { camera.position.copy(pos); controls.target.copy(tgt); controls.update(); };
  (document.getElementById("goEntrance") as HTMLButtonElement).onclick = () => jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  (document.getElementById("goBooks") as HTMLButtonElement).onclick = () => jumpTo(booksTeleport.pos, booksTeleport.tgt);
  (document.getElementById("reset") as HTMLButtonElement).onclick = () => { camera.position.set(0,4,14); controls.target.set(0,1.6,0); controls.update(); };

  // リサイズ & ループ
  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });
  (function animate(){ requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera); })();

  // ---- AIに聞く（Vercel の API へ POST） ----
  const askBtn = document.getElementById("askAI") as HTMLButtonElement | null;
  askBtn?.addEventListener("click", async () => {
    const q = window.prompt("何をお探しですか？（例：初心者向けのプログラミング本）"); if (!q) return;
    askBtn.disabled = true; askBtn.textContent = "問い合わせ中…";
    try {
      const r = await fetch("https://vr-mall-api.vercel.app/api/concierge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, context: { where: "entrance" } }),
      });
      let data:any=null; try{ data = await r.json(); }catch{}
      if (!r.ok) throw new Error((data && (data.error||data.detail||JSON.stringify(data))) || r.statusText);
      alert(data?.reply ?? "（回答を取得できませんでした）");
    } catch (e:any) {
      alert("通信エラー: " + (e?.message || e));
    } finally {
      askBtn.disabled = false; askBtn.textContent = "AIに聞く";
    }
  });
});
