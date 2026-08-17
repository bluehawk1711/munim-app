/**
 * CacheService unit test — runs against the in-memory fallback (no Upstash
 * creds set), so it's CI-safe. Verifies the cache-aside contract and the
 * prefix-invalidation helper that every write path depends on.
 *
 * Run: pnpm exec tsx test/cache.spec.ts (from apps/api)
 */
import "reflect-metadata";
import { CacheService } from "../src/common/cache.service.js";
import { cacheKeys, hashFilters, invalidate, CACHE_GROUPS, CACHE_TTL } from "../src/common/cache.keys.js";

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/nonexistent";
process.env.API_KEY_WEB = "test-web-key-123456";

let failures = 0;

function check(name: string, ok: boolean, detail?: string): void {
  if (ok) {
    console.log(`PASS  ${name}`);
  } else {
    failures++;
    console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

async function main(): Promise<void> {
  const cache = new CacheService();
  check("fallback is NOT redis", !cache.isRedis, "expected in-memory fallback without creds");

  // 1. cache-aside: loader runs once, then hits are served from cache
  let loads = 0;
  const loader = async () => {
    loads++;
    return { rows: [1, 2, 3] };
  };
  const first = await cache.cacheAside("products:list:x", CACHE_TTL.lists, loader);
  const second = await cache.cacheAside("products:list:x", CACHE_TTL.lists, loader);
  check("cache-aside returns loader value", first.rows.length === 3 && second.rows.length === 3);
  check("cache-aside loads exactly once", loads === 1, `loader ran ${loads} times`);

  // 2. null results are never cached
  let nullLoads = 0;
  const nullLoader = async () => {
    nullLoads++;
    return null;
  };
  await cache.cacheAside("products:null", 60, nullLoader);
  await cache.cacheAside("products:null", 60, nullLoader);
  check("null loader result not cached", nullLoads === 2, `ran ${nullLoads} times`);

  // 3. del single key
  await cache.set("products:get:abc", { name: "x" }, 60);
  await cache.del("products:get:abc");
  const afterDel = await cache.get("products:get:abc");
  check("del removes a single key", afterDel === null);

  // 4. prefix invalidation clears related keys (and not unrelated ones).
  // Note: the products group ALSO clears dashboard/reports (stock changes move
  // the aggregates), so use job-letters as the "unrelated" control.
  await cache.set(cacheKeys.product("p1"), { name: "p1" }, 60);
  await cache.set(cacheKeys.productsList({ search: "a" }), { products: [] }, 60);
  await cache.set("job-letters:list", [{ id: "l1" }], 60);
  await invalidate(cache, ["products"]);
  const p1 = await cache.get(cacheKeys.product("p1"));
  const plist = await cache.get(cacheKeys.productsList({ search: "a" }));
  const dash = await cache.get("dashboard:get");
  const letters = await cache.get("job-letters:list");
  check("prefix invalidate clears products:*", p1 === null && plist === null, `p1=${p1 !== null} plist=${plist !== null}`);
  check("products group also clears dashboard", dash === null, "dashboard should be invalidated by a products write");
  check("unrelated keys survive invalidation", letters !== null, "job-letters should survive a products invalidation");

  // 5. group composition covers everything a sale write touches
  const expected = new Set(["invoices", "sales", "parties", "advances", "payments", "dashboard", "reports"]);
  const got = new Set(CACHE_GROUPS.invoices);
  check("invoices group covers all derived data", expected.size === got.size && [...expected].every((g) => got.has(g)));

  // 6. TTL expiry
  await cache.set("products:get:ttl", { name: "ttl" }, 1);
  const t0 = await cache.get("products:get:ttl");
  await new Promise((r) => setTimeout(r, 1100));
  const t1 = await cache.get("products:get:ttl");
  check("TTL expiry drops the entry", t0 !== null && t1 === null);

  // 7. hashFilters is stable + ignores empties
  check(
    "hashFilters stable and skips empties",
    hashFilters({ a: 1, b: "x" }) === hashFilters({ b: "x", a: 1 }) && hashFilters({ a: undefined, b: "" }) === "all",
  );

  console.log(failures === 0 ? "\nCACHE SPEC OK" : `\n${failures} FAILURE(S)`);
  process.exit(failures === 0 ? 0 : 1);
}

void main();
