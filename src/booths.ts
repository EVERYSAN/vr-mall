export type Item = {
  title: string;
  price: string;
  desc: string;
  image: string;
  url: string;
};
export type Booth = {
  side: "left" | "right"; // 通路の左/右
  z: number;              // 通路に沿った前後位置
  name: string;           // 店名
  items: Item[];
};

// ダミーデータ（画像はpicsum、リンクはAmazon検索）
export const BOOTHS: Booth[] = [
  {
    side: "left", z: -10, name: "Gadgets",
    items: [
      { title:"Wireless Headphones", price:"¥12,800", desc:"ANC / 30h再生", image:"https://picsum.photos/seed/headphones/600/600", url:"https://www.amazon.co.jp/s?k=headphones" },
      { title:"Smartwatch",          price:"¥18,600", desc:"心拍/睡眠/通知", image:"https://picsum.photos/seed/watch/600/600",      url:"https://www.amazon.co.jp/s?k=smartwatch" },
      { title:"Gaming Mouse",        price:"¥4,980",  desc:"16Kセンサー",    image:"https://picsum.photos/seed/mouse/600/600",      url:"https://www.amazon.co.jp/s?k=gaming+mouse" },
    ],
  },
  {
    side: "right", z: 0, name: "Books",
    items: [
      { title:"Tech Books", price:"¥3,300", desc:"エンジニア向け良書", image:"https://picsum.photos/seed/books/600/600",  url:"https://www.amazon.co.jp/s?k=tech+books" },
      { title:"Design",     price:"¥2,640", desc:"UI/UX / 配色",       image:"https://picsum.photos/seed/design/600/600", url:"https://www.amazon.co.jp/s?k=design+books" },
      { title:"Fiction",    price:"¥1,200", desc:"人気の小説",         image:"https://picsum.photos/seed/novel/600/600",  url:"https://www.amazon.co.jp/s?k=novel" },
    ],
  },
  {
    side: "left", z: 12, name: "Fashion",
    items: [
      { title:"Sneakers",  price:"¥7,980", desc:"軽量 / クッション", image:"https://picsum.photos/seed/sneakers/600/600", url:"https://www.amazon.co.jp/s?k=sneakers" },
      { title:"Backpacks", price:"¥5,480", desc:"多ポケット",         image:"https://picsum.photos/seed/bag/600/600",      url:"https://www.amazon.co.jp/s?k=backpack" },
      { title:"Hats",      price:"¥1,980", desc:"UV対策",             image:"https://picsum.photos/seed/hat/600/600",      url:"https://www.amazon.co.jp/s?k=hat" },
    ],
  },
];
