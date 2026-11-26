/* 反向 ingest 契约校验：确保云端 worker/handlers.ts 的 let snap 字段与公开仓 ybjbox/openwrt-packages 的 metrics.go 对齐 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const handlersPath = path.join(here, "..", "worker", "handlers.ts");
const goPath = process.argv[2] || "";

const uniqSort = (arr) => [...new Set(arr)].sort();

const tsSrc = fs.readFileSync(handlersPath, "utf8");
const blockMatch = tsSrc.match(/let\s+snap\s*:\s*\{([\s\S]*?)\n\s*\}\s*;/);
if (!blockMatch) {
  console.error("[FAIL] 未能定位 worker/handlers.ts 中的 `let snap: { ... };`");
  process.exit(1);
}
const tsFields = uniqSort([...blockMatch[1].matchAll(/\b([a-z][a-z_0-9]*)\??\s*:/g)].map((m) => m[1]));
console.log(`[PASS] 云端 handlers.ts 提取到 ${tsFields.length} 个字段`);

if (!goPath) {
  console.log("[提示] 未传入 Go metrics.go 路径，仅校验云端核心字段存在性");
  for (const must of ["ts", "source", "devices", "services", "alerts", "logs"]) {
    if (!tsFields.includes(must)) {
      console.error(`[FAIL] 核心字段缺失: ${must}`);
      process.exit(1);
    }
  }
  process.exit(0);
}

const goSrc = fs.readFileSync(goPath, "utf8");
const goFields = uniqSort([...goSrc.matchAll(/json:"([a-zA-Z_][a-zA-Z_0-9]*)/g)].map((m) => m[1]));
console.log(`[PASS] 采集器 metrics.go 提取到 ${goFields.length} 个字段`);

const tsOnly = tsFields.filter((f) => !goFields.includes(f));
const goOnly = goFields.filter((f) => !tsFields.includes(f));
if (tsOnly.length) console.error("[FAIL] 云端有、采集器缺失:", tsOnly.join(", "));
if (goOnly.length) console.error("[FAIL] 采集器有、云端缺失:", goOnly.join(", "));
if (tsOnly.length || goOnly.length) process.exit(1);

console.log(`[PASS] 跨仓 ingest 契约对齐（${tsFields.length} 个字段全部一致）`);
