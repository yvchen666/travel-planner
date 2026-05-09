import type { Metadata } from "next"
import "./globals.css"

export const metadata: Metadata = {
  title: "旅哪儿",
  description: "收藏景点，生成最优路线",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh">
      <body className="antialiased bg-gray-50 text-gray-900">{children}</body>
    </html>
  )
}
