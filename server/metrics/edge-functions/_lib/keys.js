// Fixed KV keys for HLL metrics (SPEC-0018, ADR-0023).
//
// EdgeOne KV keys allow only digits, letters and underscores. Version strings
// therefore stay inside JSON values, never in a key.

export const SHARD_COUNT = 16;
const KEY_PATTERN = /^[A-Za-z0-9_]+$/;

export function compactDay(day) {
  return day.replaceAll("-", "");
}

export function expandedDay(compact) {
  return `${compact.slice(0, 4)}-${compact.slice(4, 6)}-${compact.slice(6, 8)}`;
}

export function shardSuffix(shard) {
  return String(shard).padStart(2, "0");
}

export function keyShard(key) {
  const match = /_(\d{2})$/.exec(key);
  return match ? Number(match[1]) : null;
}

export function keyDay(key) {
  const match = /_(\d{8})_\d{2}$/.exec(key);
  return match ? expandedDay(match[1]) : null;
}

export function isAllowedKey(key) {
  return KEY_PATTERN.test(key);
}

function shardedKeys(prefix, day, shards = SHARD_COUNT) {
  const compact = day === undefined ? "" : `${compactDay(day)}_`;
  const result = [];
  for (let shard = 0; shard < shards; shard += 1) {
    result.push(`${prefix}${compact}${shardSuffix(shard)}`);
  }
  return result;
}

export function activeKey(day, shard) {
  return `h_act_${compactDay(day)}_${shardSuffix(shard)}`;
}

export function newKey(day, shard) {
  return `h_new_${compactDay(day)}_${shardSuffix(shard)}`;
}

export function versionKey(day, shard) {
  return `h_ver_${compactDay(day)}_${shardSuffix(shard)}`;
}

export function totalKey(shard) {
  return `h_total_${shardSuffix(shard)}`;
}

export function installVersionKey(shard) {
  return `h_install_ver_${shardSuffix(shard)}`;
}

export function activeKeysForDay(day) {
  return shardedKeys("h_act_", day);
}

export function newKeysForDay(day) {
  return shardedKeys("h_new_", day);
}

export function versionKeysForDay(day) {
  return shardedKeys("h_ver_", day);
}

export function globalKeys() {
  return [
    ...shardedKeys("h_total_"),
    ...shardedKeys("h_install_ver_"),
  ];
}
