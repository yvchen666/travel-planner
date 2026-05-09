import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function getUserId(req: NextRequest) {
  return req.cookies.get("userId")?.value
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; poiId: string }> }) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id, poiId } = await params

  const tripPoi = await prisma.tripPoi.findFirst({
    where: { tripId: id, poiId, trip: { userId } },
  })
  if (!tripPoi) return NextResponse.json({ error: "不存在" }, { status: 404 })

  await prisma.tripPoi.delete({ where: { id: tripPoi.id } })
  return NextResponse.json({ ok: true })
}
