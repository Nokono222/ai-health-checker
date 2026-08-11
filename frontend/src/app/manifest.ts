import type { MetadataRoute } from "next";

/**
 * ホーム画面に追加できるようにし、そこから記録画面へ直行させる（#125 C-4）。
 * 「入力したいだけ」のときにホーム画面 → 一覧 → FAB という遠回りをせず、
 * ショートカットから /logs/new へ1タップで入れる。
 *
 * 色は globals.css のデザイントークンを sRGB に変換した値
 * （primary: oklch(0.56 0.11 195) / bg: oklch(0.98 0.004 240)）。
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "HealthLog",
    short_name: "HealthLog",
    description: "毎日の体調・気分を記録するライフログアプリ",
    lang: "ja",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f9fb",
    theme_color: "#008888",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "記録する",
        short_name: "記録",
        description: "今日のログをすぐに入力する",
        url: "/logs/new",
        icons: [{ src: "/icon-192.png", sizes: "192x192" }],
      },
    ],
  };
}
