import { prisma } from "@/lib/prisma"
import { NextRequest, NextResponse } from "next/server"

function getUserId(req: NextRequest) {
  return req.cookies.get("userId")?.value
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const userId = getUserId(req)
  if (!userId) return NextResponse.json({ error: "未登录" }, { status: 401 })
  const { id } = await params

  const trip = await prisma.trip.findFirst({ where: { id, userId } })
  if (!trip) return NextResponse.json({ error: "旅行不存在" }, { status: 404 })

  await prisma.trip.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
