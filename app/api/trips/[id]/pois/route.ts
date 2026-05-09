import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function getUserId(req: NextRequest) {
  return req.cookies.get("userId")?.value
}

// GET /api/trips/[id]/pois — 获取旅行下的 POI 列表
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id } = await params

  const tripPois = await prisma.tripPoi.findMany({
    where: { tripId: id, trip: { userId } },
    include: { poi: true },
    orderBy: { order: "asc" },
  })
  return NextResponse.json({ pois: tripPois.map(tp => tp.poi) })
}

// POST /api/trips/[id]/pois — 添加 POI 到旅行
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id } = await params

  const trip = await prisma.trip.findFirst({ where: { id, userId } })
  if (!trip) return NextResponse.json({ error: "旅行不存在" }, { status: 404 })

  const { name, type, lat, lng, address, sourceUrl, sourceText } = await req.json()

  // 查找是否已有相同坐标的 POI（复用已有数据并累计收藏数）
  let poi = await prisma.poi.findFirst({ where: { name, lat, lng } })
  if (poi) {
    poi = await prisma.poi.update({ where: { id: poi.id }, data: { collectCount: { increment: 1 } } })
  } else {
    poi = await prisma.poi.create({ data: { name, type: type || "景点", lat, lng, address, sourceUrl, sourceText } })
  }

  const count = await prisma.tripPoi.count({ where: { tripId: id } })
  const existing = await prisma.tripPoi.findFirst({ where: { tripId: id, poiId: poi.id } })
  if (!existing) {
    await prisma.tripPoi.create({ data: { tripId: id, poiId: poi.id, order: count } })
  }

  return NextResponse.json({ poi })
}
