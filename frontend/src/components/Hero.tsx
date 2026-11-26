import { useEffect, useMemo, useRef, useState } from "react";
import { IconChevronDown, IconSearch, IconTrash, IconX } from "./icons";
import { useStore } from "../state/store";
import { addSearchHistory, clearSearchHistory, loadSearchHistory, removeSearchHistory } from "../lib/storage";
import type { Group, ServiceItem } from "../types";

const ENGINE_BADGE: Record<string, { letter: string; bg: string }> = {
  google: { letter: "G", bg: "#4285f4" },
  bing: { letter: "b", bg: "#00809d" },
  baidu: { letter: "百", bg: "#2932e1" },
  duckduckgo: { letter: "D", bg: "#de5833" },
  github: { letter: "GH", bg: "#24292f" },
  bili: { letter: "B", bg: "#fb7299" },
  zhihu: { letter: "知", bg: "#0066ff" },
  perplexity: { letter: "P", bg: "#20808d" },
  metaso: { letter: "秘", bg: "#6366f1" },
};

/** Hero：WeTab 1:1 顶部居中磨砂奶白药丸搜索 */
export function Hero(props: {
  onFilter: (q: string) => void;
  filtered?: { group: Group; item: ServiceItem }[] | null;
}) {
  const { config } = useStore();
  const [q, setQ] = useState("");
  const [engine, setEngine] = useState(config.search.default);
  const [engineOpen, setEngineOpen] = useState(false);
  const [history, setHistory] = useState(() => loadSearchHistory());
  const [showHistory, setShowHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const engineRef = useRef<HTMLDivElement>(null);
  const searchStyle = config.search.style;

  useEffect(() => {
    setEngine(config.search.default);
  }, [config.search.default]);

  useEffect(() => {
    if (searchStyle === "hidden") return;
    const onKey = (e: KeyboardEvent) => {
      const typing = e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement;
      if (e.key === "/" && !typing) { e.preventDefault(); inputRef.current?.focus(); }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [searchStyle]);

  // 点击外部关闭引擎下拉
  useEffect(() => {
    if (!engineOpen) return;
    const onDown = (e: MouseEvent) => {
      if (engineRef.current && !engineRef.current.contains(e.target as Node)) {
        setEngineOpen(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [engineOpen]);

  const engines = useMemo(() => config.search.engines, [config.search.engines]);
  const activeEngine = engines.find((e) => e.id === engine) || engines[0];
  const badge = activeEngine
    ? ENGINE_BADGE[activeEngine.id] || { letter: activeEngine.name.slice(0, 1).toUpperCase(), bg: "var(--accent)" }
    : { letter: "S", bg: "var(--accent)" };

  const search = (query: string, engineId: string) => {
    const eng = engines.find((e) => e.id === engineId) || engines[0];
    if (!eng || !query.trim()) return;
    window.open(eng.url.replace("%s", encodeURIComponent(query.trim())), "_blank", "noopener");
    setHistory(addSearchHistory(query.trim(), eng.id));
  };

  const submitSearch = () => {
    if (props.filtered && props.filtered.length === 1 && props.filtered[0].item.url) {
      window.open(props.filtered[0].item.url, "_blank", "noopener");
      return;
    }
    search(q, engine);
  };

  if (searchStyle === "hidden") {
    return null;
  }

  return (
    <div className="hero">
      <div className={`hero-search${searchStyle === "compact" ? " compact" : ""}`}>
          <div className="search-wrap">
            <div className={`search pill${showHistory && history.length > 0 && !q ? " with-history" : ""}`}>
              <div className="engine-pick" ref={engineRef}>
                <button
                  type="button"
                  className="engine-btn"
                  title={`切换搜索引擎（当前：${activeEngine?.name || ""}）`}
                  aria-label="切换搜索引擎"
                  aria-expanded={engineOpen}
                  onClick={() => setEngineOpen((v) => !v)}
                >
                  <span className="engine-dot" style={{ background: badge.bg }}>{badge.letter}</span>
                  <IconChevronDown size={12} />
                </button>
                {engineOpen && (
                  <div className="engine-pop" role="listbox" aria-label="搜索引擎列表">
                    {engines.map((e) => {
                      const eb = ENGINE_BADGE[e.id] || { letter: e.name.slice(0, 1).toUpperCase(), bg: "var(--accent)" };
                      return (
                        <button
                          key={e.id}
                          type="button"
                          className={`engine-opt${e.id === activeEngine?.id ? " on" : ""}`}
                          onClick={() => {
                            setEngine(e.id);
                            setEngineOpen(false);
                            inputRef.current?.focus();
                          }}
                        >
                          <span className="engine-dot" style={{ background: eb.bg }}>{eb.letter}</span>
                          <span>{e.name}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <input
                ref={inputRef}
                type="search"
                placeholder="输入搜索内容"
                aria-label="输入搜索内容"
                value={q}
                onChange={(e) => { setQ(e.target.value); props.onFilter(e.target.value); }}
                onFocus={() => setShowHistory(true)}
                onBlur={() => window.setTimeout(() => setShowHistory(false), 160)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") submitSearch();
                }}
              />

              {q && (
                <>
                  <button
                    type="button"
                    className="search-clear"
                    aria-label="清空"
                    onClick={() => { setQ(""); props.onFilter(""); inputRef.current?.focus(); }}
                  >
                    <IconX size={14} />
                  </button>
                  <button type="button" className="go" aria-label="搜索" onClick={submitSearch}>
                    <IconSearch size={16} />
                  </button>
                </>
              )}
            </div>

            {showHistory && !q && history.length > 0 && config.search.history && (
              <div className="history-pop">
                <div className="history-head">
                  <span>搜索历史</span>
                  <button type="button" onClick={() => setHistory(clearSearchHistory())} title="清空历史">
                    <IconTrash size={12} /> 清空
                  </button>
                </div>
                {history.map((h) => (
                  <div
                    key={h.engine + h.ts}
                    className="history-row"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => { setQ(h.q); search(h.q, h.engine); setShowHistory(false); }}
                  >
                    <IconSearch size={12} />
                    <span className="hq">{h.q}</span>
                    <button
                      type="button"
                      className="hdel"
                      title="删除该条"
                      onClick={(e) => { e.stopPropagation(); setHistory(removeSearchHistory(h.q, h.engine)); }}
                    >
                      <IconX size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
    </div>
  );
}
