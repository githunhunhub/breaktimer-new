-- Report queries for SPEC-0018. Run against the remote D1 database, e.g.
--
--   npx wrangler d1 execute breaktimer_metrics --remote --file queries.sql
--
-- or copy a single statement into `--command "…"`.

-- 1. 累计装机
SELECT COUNT(*) AS total_installs FROM installs;

-- 2. 新增装机（按日，最近 30 天）
SELECT first_seen_day AS day, COUNT(*) AS new_installs
FROM installs
GROUP BY first_seen_day
ORDER BY day DESC
LIMIT 30;

-- 3. 新增装机（按周、按月）
SELECT strftime('%Y-W%W', first_seen_day) AS week, COUNT(*) AS new_installs
FROM installs
GROUP BY week
ORDER BY week DESC;

SELECT substr(first_seen_day, 1, 7) AS month, COUNT(*) AS new_installs
FROM installs
GROUP BY month
ORDER BY month DESC;

-- 4. 日活（DAU，最近 30 天）
SELECT day, COUNT(*) AS dau
FROM daily_active
GROUP BY day
ORDER BY day DESC
LIMIT 30;

-- 5. 周活 / 月活（滚动窗口）
SELECT
  (SELECT COUNT(DISTINCT install_id) FROM daily_active
    WHERE day >= date('now', '-6 day'))  AS wau,
  (SELECT COUNT(DISTINCT install_id) FROM daily_active
    WHERE day >= date('now', '-29 day')) AS mau;

-- 6. 装机留存 D1 / D7 / D30（按日新增 cohort）
SELECT
  i.first_seen_day AS cohort,
  COUNT(*) AS installs,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+1 day')))  AS d1,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+7 day')))  AS d7,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+30 day'))) AS d30
FROM installs i
WHERE i.first_seen_day <= date('now', '-30 day')
GROUP BY i.first_seen_day
ORDER BY cohort DESC
LIMIT 30;

-- 7. 装机留存 W1 / W4（按周新增 cohort）
SELECT
  strftime('%Y-W%W', i.first_seen_day) AS cohort,
  COUNT(*) AS installs,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+7 day')))  AS w1,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+28 day'))) AS w4
FROM installs i
WHERE i.first_seen_day <= date('now', '-28 day')
GROUP BY cohort
ORDER BY cohort DESC
LIMIT 12;

-- 8. 版本分布（最近 7 天有活动的装机）
SELECT version, COUNT(*) AS installs
FROM daily_active
WHERE day >= date('now', '-6 day')
GROUP BY version
ORDER BY installs DESC;

-- 9. 首装版本分布
SELECT first_version, COUNT(*) AS installs
FROM installs
GROUP BY first_version
ORDER BY installs DESC;

-- 10. 安装版 / 便携版占比
SELECT channel, COUNT(*) AS installs
FROM installs
GROUP BY channel
ORDER BY installs DESC;

-- 11. 安装形态与 D7 留存
SELECT
  i.channel,
  COUNT(*) AS installs,
  SUM(EXISTS (SELECT 1 FROM daily_active a
              WHERE a.install_id = i.install_id
                AND a.day = date(i.first_seen_day, '+7 day'))) AS d7
FROM installs i
WHERE i.first_seen_day <= date('now', '-7 day')
GROUP BY i.channel;

-- 12. 语言分布与系统分布
SELECT locale, COUNT(*) AS installs FROM installs GROUP BY locale ORDER BY installs DESC;
SELECT os, COUNT(*) AS installs FROM installs GROUP BY os ORDER BY installs DESC;

-- 13. 健康检查：明细窗口与最近上报
SELECT MIN(day) AS oldest, MAX(day) AS newest, COUNT(*) AS rows FROM daily_active;
