import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

// POST /api/auth/login — email 存在则登录，不存在则注册
export async function POST(req: NextRequest) {
  const { email, name } = await req.json()
  if (!email) return NextResponse.json({ error: "email required" }, { status: 400 })

  let user = await prisma.user.findUnique({ where: { email } })
  if (!user) {
    user = await prisma.user.create({ data: { email, name: name || email.split("@")[0] } })
  }

  const res = NextResponse.json({ user })
  res.cookies.set("userId", user.id, { httpOnly: true, path: "/", maxAge: 60 * 60 * 24 * 30 })
  return res
}
