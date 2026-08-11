import type { Metadata } from "next";
import { Noto_Sans_JP } from "next/font/google";
import { AuthProvider } from "@/context/AuthContext";
import { BackendWarmup } from "@/components/BackendWarmup";
import { SWRCacheProvider } from "@/components/SWRCacheProvider";
import { cn } from "@/lib/utils";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  weight: ["400", "500", "600"],
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "HealthLog",
  description: "毎日の体調・気分を記録するライフログアプリ",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={cn(notoSansJP.variable)}>
      <body>
        <BackendWarmup />
        <AuthProvider>
          <SWRCacheProvider>{children}</SWRCacheProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
