"use client"
import { useEffect, useRef, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"

type Poi = { id: string; name: string; type: string; lat: number; lng: number; address?: string }
type ScheduleItem = { time: string; poi: Poi }
type ScheduleDay = { day: number; items: ScheduleItem[] }
type SearchResult = { id: string; name: string; type: string; location: string; address: string }

declare global {
  interface Window { AMap: any }
}

const TYPE_COLOR: Record<string, string> = {
  "景点": "bg-blue-100 text-blue-700",
  "美食": "bg-orange-100 text-orange-700",
  "住宿": "bg-purple-100 text-purple-700",
}
const TYPE_ICON: Record<string, string> = {
  "景点": "🏔️",
  "美食": "🍜",
  "住宿": "🏨",
}

export default function TripDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const mapRef = useRef<HTMLDivElement>(null)
  const amapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const polylineRef = useRef<any>(null)

  const [pois, setPois] = useState<Poi[]>([])
  const [schedule, setSchedule] = useState<ScheduleDay[]>([])
  const [orderedPois, setOrderedPois] = useState<Poi[]>([])
  const [days, setDays] = useState(1)
  const [tab, setTab] = useState<"add" | "list" | "schedule">("list")
  const [panel, setPanel] = useState<"link" | "search">("link")

  const [linkInput, setLinkInput] = useState("")
  const [parsedPoi, setParsedPoi] = useState<{ name: string; type: string; description: string } | null>(null)
  const [parseLoading, setParseLoading] = useState(false)
  const [parseError, setParseError] = useState("")

  const [searchInput, setSearchInput] = useState("")
  const [searchResults, setSearchResults] = useState<SearchResult[]>([])
  const [searchLoading, setSearchLoading] = useState(false)

  const [routeLoading, setRouteLoading] = useState(false)
  const [deletingPoi, setDeletingPoi] = useState<string | null>(null)
  const [tripName, setTripName] = useState("")

  // 初始化地图
  const initMap = useCallback(() => {
    if (!mapRef.current || amapRef.current) return
    amapRef.current = new window.AMap.Map(mapRef.current, {
      zoom: 11,
      center: [116.397, 39.908],
      mapStyle: "amap://styles/whitesmoke",
    })
  }, [])

  useEffect(() => {
    if (document.getElementById("amap-script")) {
      if (window.AMap) initMap()
      return
    }
    const script = document.createElement("script")
    script.id = "amap-script"
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${process.env.NEXT_PUBLIC_AMAP_KEY}&plugin=AMap.Driving`
    script.onload = () => initMap()
    document.head.appendChild(script)
  }, [initMap])

  // 加载数据
  useEffect(() => {
    fetch(`/api/trips/${id}/pois`).then(r => {
      if (r.status === 401) router.push("/")
      else r.json().then(d => setPois(d.pois || []))
    })
    fetch("/api/trips").then(r => r.json()).then(d => {
      const trip = d.trips?.find((t: any) => t.id === id)
      if (trip) setTripName(trip.name)
    })
  }, [id, router])

  // 更新地图标注
  useEffect(() => {
    if (!amapRef.current) return
    // 清除旧标注
    markersRef.current.forEach(m => amapRef.current.remove(m))
    markersRef.current = []
    if (polylineRef.current) { amapRef.current.remove(polylineRef.current); polylineRef.current = null }

    if (pois.length === 0) return

    const bounds: [number, number][] = []
    pois.forEach((poi, i) => {
      const marker = new window.AMap.Marker({
        position: [poi.lng, poi.lat],
        content: `<div style="background:#2563eb;color:white;border-radius:50%;width:28px;height:28px;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;box-shadow:0 2px 8px rgba(37,99,235,0.4);border:2px solid white">${i + 1}</div>`,
        offset: new window.AMap.Pixel(-14, -14),
        title: poi.name,
      })
      const label = new window.AMap.Marker({
        position: [poi.lng, poi.lat],
        content: `<div style="background:white;border-radius:8px;padding:3px 8px;font-size:12px;white-space:nowrap;box-shadow:0 2px 8px rgba(0,0,0,0.12);margin-top:4px;color:#111827;font-weight:500">${poi.name}</div>`,
        offset: new window.AMap.Pixel(-20, 16),
      })
      amapRef.current.add([marker, label])
      markersRef.current.push(marker, label)
      bounds.push([poi.lng, poi.lat])
    })

    if (bounds.length === 1) {
      amapRef.current.setCenter(bounds[0])
      amapRef.current.setZoom(14)
    } else {
      const lngs = bounds.map(b => b[0])
      const lats = bounds.map(b => b[1])
      amapRef.current.setBounds(new window.AMap.Bounds(
        [Math.min(...lngs) - 0.02, Math.min(...lats) - 0.02],
        [Math.max(...lngs) + 0.02, Math.max(...lats) + 0.02],
      ))
    }
  }, [pois])

  // 画真实道路路线（后端 Web服务 Key 规划，前端 Polyline 绘制）
  useEffect(() => {
    if (!amapRef.current || orderedPois.length < 2) return

    if (polylineRef.current) {
      try { amapRef.current.remove(polylineRef.current) } catch {}
      polylineRef.current = null
    }

    fetch("/api/route-path", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pois: orderedPois }),
    })
      .then(r => r.json())
      .then(({ path }) => {
        if (!path || !amapRef.current) return
        polylineRef.current = new window.AMap.Polyline({
          path,
          strokeColor: "#2563eb",
          strokeWeight: 5,
          strokeOpacity: 0.9,
          lineJoin: "round",
        })
        amapRef.current.add(polylineRef.current)
        amapRef.current.setFitView()
      })
      .catch(e => console.error("路线绘制失败", e))
  }, [orderedPois])

  async function parseLink() {
    if (!linkInput.trim()) return
    setParseLoading(true)
    setParseError("")
    setParsedPoi(null)
    const res = await fetch("/api/parse-link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: linkInput }),
    })
    const data = await res.json()
    if (!res.ok) {
      setParseError(data.error)
    } else {
      setParsedPoi(data)
      setSearchInput(data.name)
      setPanel("search")
      searchPoi(data.name)
    }
    setParseLoading(false)
  }

  async function searchPoi(q: string) {
    if (!q.trim()) return
    setSearchLoading(true)
    const res = await fetch(`/api/poi/search?q=${encodeURIComponent(q)}`)
    const data = await res.json()
    setSearchResults(data.pois || [])
    setSearchLoading(false)
  }

  async function addPoi(r: SearchResult) {
    const [lng, lat] = r.location.split(",").map(Number)
    const duplicate = pois.some(p => p.name === r.name && Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001)
    if (duplicate) {
      alert("该地点已在列表中")
      return
    }
    const typeGuess = parsedPoi?.type || (r.type?.includes("餐") || r.type?.includes("食") ? "美食" : "景点")

    // 乐观更新：立即加入列表，用临时 id
    const tempId = `temp-${Date.now()}`
    const optimistic: Poi = { id: tempId, name: r.name, type: typeGuess, lat, lng, address: r.address }
    setPois(prev => [...prev, optimistic])
    setSearchResults([])
    setLinkInput("")
    setParsedPoi(null)
    setSearchInput("")
    setParseError("")
    setTab("list")

    // 后台写库，完成后替换临时 id
    fetch(`/api/trips/${id}/pois`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: r.name, type: typeGuess, lat, lng,
        address: r.address,
        sourceUrl: linkInput || undefined,
        sourceText: parsedPoi?.description,
      }),
    })
      .then(res => res.json())
      .then(({ poi }) => {
        if (poi) setPois(prev => prev.map(p => p.id === tempId ? poi : p))
      })
      .catch(() => {
        // 写库失败，移除乐观项并提示
        setPois(prev => prev.filter(p => p.id !== tempId))
        alert("添加失败，请重试")
      })
  }

  async function deletePoi(poiId: string) {
    setDeletingPoi(poiId)
    await fetch(`/api/trips/${id}/pois/${poiId}`, { method: "DELETE" })
    setPois(prev => prev.filter(p => p.id !== poiId))
    setOrderedPois([])
    setSchedule([])
    setDeletingPoi(null)
  }

  async function generateRoute() {
    setRouteLoading(true)
    const res = await fetch(`/api/trips/${id}/route`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days }),
    })
    const data = await res.json()
    setOrderedPois(data.ordered)
    setSchedule(data.schedule)
    setTab("schedule")
    setRouteLoading(false)
  }

  return (
    <div className="flex flex-col h-screen bg-gray-50">
      {/* 顶部导航 */}
      <header className="bg-white border-b border-gray-100 shadow-sm z-20 flex-shrink-0">
        <div className="h-14 px-4 flex items-center gap-3">
          <button onClick={() => router.push("/trips")} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="font-semibold text-gray-900 flex-1 truncate">{tripName || "旅行详情"}</h1>
          <button
            onClick={() => setTab("add")}
            className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-3 py-1.5 rounded-xl transition"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            添加地点
          </button>
        </div>
      </header>

      {/* 地图 */}
      <div ref={mapRef} className="w-full flex-shrink-0" style={{ height: "40vh" }} />

      {/* 底部面板 */}
      <div className="flex-1 overflow-hidden flex flex-col bg-white rounded-t-3xl -mt-4 shadow-2xl z-10">
        {/* Tab 栏 */}
        <div className="flex border-b border-gray-100 px-4 pt-4 gap-1 flex-shrink-0">
          {[
            { key: "list", label: `地点列表 ${pois.length > 0 ? `(${pois.length})` : ""}` },
            { key: "add", label: "添加地点" },
            { key: "schedule", label: "行程计划" },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key as any)}
              className={`px-4 py-2 text-sm font-medium rounded-t-xl transition ${
                tab === t.key
                  ? "bg-blue-50 text-blue-600 border-b-2 border-blue-600"
                  : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* 地点列表 */}
          {tab === "list" && (
            <div className="p-4 space-y-3">
              {pois.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">📍</div>
                  <p className="text-gray-400 text-sm">还没有地点，点击"添加地点"开始收藏</p>
                </div>
              ) : (
                <>
                  {pois.map((poi, i) => (
                    <div key={poi.id} className="flex items-center gap-3 bg-gray-50 rounded-2xl p-3.5 group">
                      <div className="w-8 h-8 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm">{poi.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLOR[poi.type] || "bg-gray-100 text-gray-600"}`}>
                            {TYPE_ICON[poi.type] || "📍"} {poi.type}
                          </span>
                        </div>
                        {poi.address && <p className="text-xs text-gray-400 mt-0.5 truncate">{poi.address}</p>}
                      </div>
                      <button
                        onClick={() => deletePoi(poi.id)}
                        disabled={deletingPoi === poi.id}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  ))}

                  {/* 生成路线 */}
                  {pois.length >= 2 && (
                    <div className="bg-blue-50 rounded-2xl p-4 mt-4">
                      <p className="text-sm font-medium text-blue-900 mb-3">生成最优路线</p>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-2 bg-white rounded-xl px-3 py-2 border border-blue-100">
                          <span className="text-sm text-gray-600">天数</span>
                          <button onClick={() => setDays(d => Math.max(1, d - 1))} className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold hover:bg-blue-200">-</button>
                          <span className="w-6 text-center text-sm font-semibold">{days}</span>
                          <button onClick={() => setDays(d => Math.min(30, d + 1))} className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold hover:bg-blue-200">+</button>
                        </div>
                        <button
                          onClick={generateRoute}
                          disabled={routeLoading}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-2.5 text-sm font-semibold transition disabled:opacity-60"
                        >
                          {routeLoading ? "规划中..." : "🗺️ 生成路线"}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* 添加地点 */}
          {tab === "add" && (
            <div className="p-4">
              {/* 切换：链接 / 搜索 */}
              <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
                <button
                  onClick={() => setPanel("link")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${panel === "link" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                >
                  粘贴分享内容
                </button>
                <button
                  onClick={() => setPanel("search")}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition ${panel === "search" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500"}`}
                >
                  搜索添加
                </button>
              </div>

              {panel === "link" && (
                <div className="space-y-3">
                  <div className="bg-blue-50 rounded-xl p-3 text-xs text-blue-700">
                    💡 在小红书点击分享→复制链接，将带文字的分享内容粘贴到下方
                  </div>
                  <textarea
                    placeholder={"例如：\n云南7日经典线（昆明→大理→丽江）总预算约2500\nhttp://xhslink.com/xxx"}
                    value={linkInput}
                    onChange={e => setLinkInput(e.target.value)}
                    rows={4}
                    className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                  {parseError && (
                    <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-xl">
                      {parseError}
                      <button onClick={() => { setPanel("search"); setParseError("") }} className="ml-2 underline">手动搜索</button>
                    </div>
                  )}
                  {parsedPoi && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs text-green-600 font-medium mb-1">✅ 解析成功</p>
                      <p className="text-sm font-semibold text-gray-900">{parsedPoi.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{parsedPoi.description}</p>
                    </div>
                  )}
                  <button
                    onClick={parseLink}
                    disabled={parseLoading || !linkInput.trim()}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50"
                  >
                    {parseLoading ? "AI 解析中..." : "解析内容"}
                  </button>
                </div>
              )}

              {panel === "search" && (
                <div className="space-y-3">
                  {parsedPoi && (
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3">
                      <p className="text-xs text-green-600 font-medium">已解析：{parsedPoi.name}，在下方确认地点坐标</p>
                    </div>
                  )}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="搜索景点、餐厅、酒店..."
                      value={searchInput}
                      onChange={e => setSearchInput(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && searchPoi(searchInput)}
                      className="flex-1 border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => searchPoi(searchInput)}
                      disabled={searchLoading}
                      className="bg-blue-600 text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-blue-700 transition disabled:opacity-50"
                    >
                      {searchLoading ? "..." : "搜索"}
                    </button>
                  </div>

                  {searchResults.length > 0 && (
                    <div className="space-y-2">
                      {searchResults.map(r => {
                        const [lng, lat] = r.location.split(",").map(Number)
                        const added = pois.some(p => p.name === r.name && Math.abs(p.lat - lat) < 0.001 && Math.abs(p.lng - lng) < 0.001)
                        return (
                          <button
                            key={r.id}
                            onClick={() => !added && addPoi(r)}
                            disabled={added}
                            className={`w-full text-left rounded-xl p-3.5 transition border ${
                              added
                                ? "bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed"
                                : "bg-gray-50 hover:bg-blue-50 border-gray-100 hover:border-blue-200"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium text-gray-900 text-sm">{r.name}</p>
                                <p className="text-xs text-gray-400 mt-0.5 truncate">{r.address}</p>
                              </div>
                              {added && <span className="text-xs text-gray-400 flex-shrink-0 ml-2">已添加</span>}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* 行程计划 */}
          {tab === "schedule" && (
            <div className="p-4">
              {schedule.length === 0 ? (
                <div className="text-center py-16">
                  <div className="text-4xl mb-3">🗺️</div>
                  <p className="text-gray-400 text-sm">还没有生成路线</p>
                  {pois.length >= 2 && (
                    <button onClick={() => setTab("list")} className="mt-3 text-blue-600 text-sm font-medium hover:underline">
                      去生成路线
                    </button>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {schedule.map(day => (
                    <div key={day.day} className="bg-gray-50 rounded-2xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                          {day.day}
                        </div>
                        <span className="font-semibold text-gray-900 text-sm">第 {day.day} 天</span>
                      </div>
                      <div className="space-y-2 pl-9">
                        {day.items.map((item, i) => (
                          <div key={i} className="flex items-start gap-3">
                            <span className="text-xs text-gray-400 w-8 pt-0.5 flex-shrink-0">{item.time}</span>
                            <div className="flex-1 bg-white rounded-xl px-3 py-2 shadow-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-sm">{TYPE_ICON[item.poi.type] || "📍"}</span>
                                <span className="text-sm font-medium text-gray-900">{item.poi.name}</span>
                                <span className={`text-xs px-1.5 py-0.5 rounded-full ${TYPE_COLOR[item.poi.type] || "bg-gray-100 text-gray-600"}`}>
                                  {item.poi.type}
                                </span>
                              </div>
                              {item.poi.address && (
                                <p className="text-xs text-gray-400 mt-0.5 ml-5">{item.poi.address}</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  <div className="bg-blue-50 rounded-2xl p-4 text-center">
                    <p className="text-sm text-blue-700 font-medium">🎉 路线已生成，共 {pois.length} 个地点</p>
                    <p className="text-xs text-blue-500 mt-1">地图上已显示最优游览路线</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
