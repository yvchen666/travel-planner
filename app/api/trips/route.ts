import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function getUserId(req: NextRequest) {
  return req.cookies.get("userId")?.value
}

// GET /api/trips — 获取当前用户的旅行列表
export async function GET(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const trips = await prisma.trip.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tripPois: true } } },
  })
  return NextResponse.json({ trips })
}

// POST /api/trips — 创建旅行
export async function POST(req: NextRequest) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })

  const { name } = await req.json()
  if (!name) return NextResponse.json({ error: "name required" }, { status: 400 })

  const trip = await prisma.trip.create({ data: { name, userId } })
  return NextResponse.json({ trip })
}
