import { NextRequest, NextResponse } from "next/server"

// GET /api/poi/search?q=大理古城 — 高德 POI 搜索
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")
  if (!q) return NextResponse.json({ error: "q required" }, { status: 400 })

  const url = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(q)}&output=json&offset=5&key=${process.env.AMAP_SERVICE_KEY}`
  const res = await fetch(url)
  const data = await res.json()

  if (data.status !== "1") return NextResponse.json({ pois: [] })

  const pois = (data.pois || []).map((p: {id: string; name: string; type: string; location: string; address: string}) => ({
    id: p.id,
    name: p.name,
    type: p.type,
    location: p.location, // "lng,lat"
    address: p.address,
  }))

  return NextResponse.json({ pois })
}
