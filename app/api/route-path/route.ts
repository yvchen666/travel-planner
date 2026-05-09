import { NextRequest, NextResponse } from "next/server"

// POST /api/route-path — 用 Web服务 Key 规划驾车路线，返回路径坐标
export async function POST(req: NextRequest) {
  const { pois } = await req.json()
  if (!pois || pois.length < 2) return NextResponse.json({ error: "至少需要2个地点" }, { status: 400 })

  const key = process.env.AMAP_SERVICE_KEY
  const origin = `${pois[0].lng},${pois[0].lat}`
  const destination = `${pois[pois.length - 1].lng},${pois[pois.length - 1].lat}`
  const waypoints = pois.slice(1, -1).map((p: { lng: number; lat: number }) => `${p.lng},${p.lat}`).join(";")

  const url = new URL("https://restapi.amap.com/v3/direction/driving")
  url.searchParams.set("key", key!)
  url.searchParams.set("origin", origin)
  url.searchParams.set("destination", destination)
  url.searchParams.set("strategy", "0")
  url.searchParams.set("output", "json")
  if (waypoints) url.searchParams.set("waypoints", waypoints)

  const res = await fetch(url.toString())
  const data = await res.json()

  if (data.status !== "1" || !data.route?.paths?.[0]) {
    return NextResponse.json({ error: "路线规划失败" }, { status: 422 })
  }

  // 从每段 steps 提取 polyline 坐标点
  const path: [number, number][] = []
  for (const step of data.route.paths[0].steps) {
    const points = step.polyline.split(";").map((pt: string) => {
      const [lng, lat] = pt.split(",").map(Number)
      return [lng, lat] as [number, number]
    })
    path.push(...points)
  }

  return NextResponse.json({ path })
}
