import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

type PoiItem = { id: string; name: string; type: string; lat: number; lng: number }

function distance(a: PoiItem, b: PoiItem) {
  const dx = a.lat - b.lat
  const dy = a.lng - b.lng
  return Math.sqrt(dx * dx + dy * dy)
}

// 最近邻贪心算法，返回最优顺序的 POI 列表
function nearestNeighbor(pois: PoiItem[]): PoiItem[] {
  if (pois.length <= 1) return pois
  const visited = new Set<string>()
  const result: PoiItem[] = []
  let current = pois[0]
  visited.add(current.id)
  result.push(current)

  while (result.length < pois.length) {
    let nearest: PoiItem | null = null
    let minDist = Infinity
    for (const p of pois) {
      if (visited.has(p.id)) continue
      const d = distance(current, p)
      if (d < minDist) { minDist = d; nearest = p }
    }
    if (!nearest) break
    visited.add(nearest.id)
    result.push(nearest)
    current = nearest
  }
  return result
}

// 按天分配行程，每天 3 个地点，上午景点/下午景点/中午美食穿插
function buildSchedule(pois: PoiItem[], days: number) {
  const perDay = Math.ceil(pois.length / days)
  const schedule: { day: number; items: { time: string; poi: PoiItem }[] }[] = []

  for (let d = 0; d < days; d++) {
    const slice = pois.slice(d * perDay, (d + 1) * perDay)
    const times = ["上午", "下午", "傍晚"]
    schedule.push({
      day: d + 1,
      items: slice.map((poi, i) => ({ time: times[i % times.length], poi })),
    })
  }
  return schedule
}

// POST /api/trips/[id]/route — 生成路线
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = req.cookies.get("userId")?.value
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id } = await params
  const { days = 1 } = await req.json()

  const tripPois = await prisma.tripPoi.findMany({
    where: { tripId: id, trip: { userId } },
    include: { poi: true },
  })

  if (tripPois.length === 0) return NextResponse.json({ error: "还没有地点" }, { status: 400 })

  const pois = tripPois.map(tp => tp.poi) as PoiItem[]
  const ordered = nearestNeighbor(pois)
  const schedule = buildSchedule(ordered, Math.max(1, days))

  // 存储路线
  const routeId = `${id}-latest`
  const existingRoute = await prisma.route.findUnique({ where: { id: routeId } })
  if (existingRoute) {
    await prisma.route.update({ where: { id: routeId }, data: { poiOrder: ordered.map(p => p.id), useCount: { increment: 1 } } })
  } else {
    await prisma.route.create({ data: { id: routeId, tripId: id, poiOrder: ordered.map(p => p.id) } })
  }

  return NextResponse.json({ ordered, schedule })
}
