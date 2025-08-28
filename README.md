# VRショッピングモール – Corridor Prototype

Web上で体験できる **簡易3Dショッピングモール** のプロトタイプです。  
イオンモールのような **通路型フロア** を再現し、各ブースに商品を並べて閲覧できる仕組みを実装しました。  
クリックやタップで移動し、商品を選択すると右パネルに詳細情報が表示されます。

## 特徴
- Three.js による 3D 空間レンダリング
- 通路の左右にショップを配置（ウィンドウショッピング体験）
- クリック / タップで移動 & 商品を選択
- サイドパネルで価格・説明・外部リンクを表示
- 将来的に AI コンシェルジュ機能を追加予定（OpenAI API 連携）

## 技術スタック
- TypeScript / Vite
- Three.js（3D表示）
- lil-gui（デバッグ用 GUI）
- GitHub Pages（フロントエンド公開）
- Vercel（バックエンド API 実装予定）

## 使い方
1. リポジトリを取得
   ```bash
   git clone https://github.com/EVERYSAN/vr-mall.git
   cd vr-mall
