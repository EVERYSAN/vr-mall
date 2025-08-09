// ===== AI Concierge（OpenAI経由で案内） =====
const AI_ENDPOINT = "https://vr-mall-api.vercel.app/api/concierge"; // ← あなたのVercelドメインに合わせて

// 右サイドパネルをテキスト用に使い回す
function showMessageInSide(title: string, text: string) {
  (document.getElementById("dTitle") as HTMLElement).textContent = title;
  (document.getElementById("dImg") as HTMLImageElement).src = "";
  (document.getElementById("dPrice") as HTMLElement).textContent = "";
  (document.getElementById("dDesc") as HTMLElement).textContent = text;
  (document.getElementById("dLink") as HTMLAnchorElement).href = "#";
  (document.getElementById("detail") as HTMLElement).style.transform = "translateX(0%)";
}

// 返答の中に簡単な操作ワードがあれば自動で動く（超シンプル版）
function maybeActOn(reply: string) {
  if (reply.includes("入口")) {
    jumpTo(ENTRANCE_POS, ENTRANCE_TGT);
  } else if (reply.includes("本屋") || reply.toLowerCase().includes("books")) {
    jumpTo(booksTeleport.pos, booksTeleport.tgt);
  }
}

// API呼び出し本体
async function askConcierge(text: string) {
  try {
    showMessageInSide("AIコンシェルジュ", "考え中…");
    const res = await fetch(AI_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: text,
        // ある程度の文脈を渡すと良い：例としてブース名だけ渡す
        context: { booths: ["Gadgets", "Books", "Fashion"] }
      }),
    });
    const data = await res.json();
    const reply: string = data?.reply ?? "（応答なし）";
    showMessageInSide("AIコンシェルジュ", reply);
    maybeActOn(reply);
  } catch (e) {
    showMessageInSide("AIコンシェルジュ", "エラーが発生しました。後でもう一度お試しください。");
    console.error(e);
  }
}

// UIバーにボタンを追加
const uiBar = document.querySelector(".ui");
if (uiBar) {
  const aiBtn = document.createElement("button");
  aiBtn.className = "btn";
  aiBtn.textContent = "AIに聞く";
  uiBar.appendChild(aiBtn);

  aiBtn.onclick = async () => {
    const q = prompt("何をお探しですか？（例：初心者向けのプログラミング本）");
    if (q && q.trim()) {
      await askConcierge(q.trim());
    }
  };
}
