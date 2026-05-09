import Anthropic from "@anthropic-ai/sdk"
import { NextRequest, NextResponse } from "next/server"

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  baseURL: process.env.ANTHROPIC_BASE_URL,
})

export async function POST(req: NextRequest) {
  const { text } = await req.json()
  if (!text) return NextResponse.json({ error: "text required" }, { status: 400 })

  let content = text
  const isUrl = /^https?:\/\//.test(text.trim())
  if (isUrl) {
    try {
      const res = await fetch(text.trim(), {
        headers: { "User-Agent": "Mozilla/5.0 (compatible; bot)" },
        signal: AbortSignal.timeout(6000),
      })
      const html = await res.text()
      const pageText = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").slice(0, 3000)
      if (pageText.length > 100) content = pageText
    } catch {
      // 抓取失败，直接用原始文字
    }
  }

  const message = await client.messages.create({
    model: "claude-haiku-4-5-20251001",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `从下面的内容中提取最主要的一个旅游地点。只返回 JSON，不要有任何其他文字，格式：
{"name":"地点名称","type":"景点|美食|住宿","description":"一句话描述"}
如果找不到明确的地点，返回 {"error":"未找到地点"}

内容：
${content}`,
      },
    ],
  })

  // thinking 模式下第一个 block 是 thinking，找第一个 text block
  const textBlock = message.content.find(b => b.type === "text")
  const raw = (textBlock && textBlock.type === "text" ? textBlock.text : "").trim()

  try {
    const cleaned = raw.replace(/```json\s*/g, "").replace(/```/g, "").trim()
    const jsonMatch = cleaned.match(/(\[[\s\S]*\]|\{[\s\S]*\})/)
    if (!jsonMatch) throw new Error()
    const result = JSON.parse(jsonMatch[0])
    const poi = Array.isArray(result) ? result[0] : result
    if (!poi || poi.error) return NextResponse.json({ error: poi?.error || "未找到地点" }, { status: 422 })
    return NextResponse.json(poi)
  } catch {
    return NextResponse.json({ error: "解析失败，请手动搜索添加" }, { status: 422 })
  }
}
