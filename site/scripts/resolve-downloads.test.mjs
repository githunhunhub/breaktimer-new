import assert from "node:assert/strict";
import test from "node:test";

import {
  applyReleaseLinks,
  parseDownloadMetadata,
} from "./resolve-downloads.mjs";

const page = `<!doctype html>
<section id="download">
  <div class="download-grid">
    <article class="download-card" data-download-card="baidu">
      <h3>百度网盘</h3>
      <p class="download-code" data-download-code>
        提取码：<strong data-baidu-code>发布后公布</strong>
      </p>
      <!-- release-download:baidu -->
      <a
        class="button button-primary"
        data-download="baidu"
        href="https://pan.baidu.com/"
      >
        打开百度网盘
      </a>
    </article>

    <article class="download-card" data-download-card="quark">
      <h3>夸克网盘</h3>
      <!-- release-download:quark -->
      <a
        class="button button-primary"
        data-download="quark"
        href="https://pan.quark.cn/"
      >
        打开夸克网盘
      </a>
    </article>
  </div>

  <p class="download-fallback" data-download-fallback hidden>
    GitHub Releases 兜底提示
  </p>

  <p class="download-meta">
    <a href="https://github.com/githunhunhub/breaktimer-new/releases">版本历史与 SHA256SUMS</a>
  </p>
</section>`;

const release = {
  tag_name: "v0.1.2",
  body: `## 下载方式

- [百度网盘](https://pan.baidu.com/s/abc)（提取码：bt12）
- [夸克网盘](https://pan.quark.cn/s/def)

<!-- breaktimer-downloads {"baidu":"https://pan.baidu.com/s/abc","quark":"https://pan.quark.cn/s/def","baiduCode":"bt12"} -->
`,
};

test("parses a configured download marker", () => {
  assert.deepEqual(parseDownloadMetadata(release.body), {
    baidu: "https://pan.baidu.com/s/abc",
    quark: "https://pan.quark.cn/s/def",
    baiduCode: "bt12",
  });
});

test("treats a missing marker as unconfigured", () => {
  assert.deepEqual(parseDownloadMetadata("## 变更\n\n- 修复若干问题\n"), {
    baidu: null,
    quark: null,
    baiduCode: null,
  });
  assert.deepEqual(parseDownloadMetadata(""), {
    baidu: null,
    quark: null,
    baiduCode: null,
  });
});

test("treats empty or null values as unconfigured", () => {
  const parsed = parseDownloadMetadata(
    '<!-- breaktimer-downloads {"baidu":null,"quark":"  ","baiduCode":"ignored"} -->',
  );
  assert.deepEqual(parsed, { baidu: null, quark: null, baiduCode: null });
});

test("rejects links that are not https on the expected host", () => {
  assert.throws(
    () =>
      parseDownloadMetadata(
        '<!-- breaktimer-downloads {"baidu":"http://pan.baidu.com/s/abc"} -->',
      ),
    /Baidu download link must use https:\/\/pan\.baidu\.com/,
  );
  assert.throws(
    () =>
      parseDownloadMetadata(
        '<!-- breaktimer-downloads {"quark":"https://example.com/s/abc"} -->',
      ),
    /Quark download link must use https:\/\/pan\.quark\.cn/,
  );
});

test("rejects a malformed marker payload", () => {
  assert.throws(
    () => parseDownloadMetadata("<!-- breaktimer-downloads not-json -->"),
    /invalid breaktimer-downloads marker/,
  );
});

test("writes both links and the access code", () => {
  const result = applyReleaseLinks(page, release);
  assert.match(
    result,
    /release-download:baidu -->[\s\S]*?href="https:\/\/pan\.baidu\.com\/s\/abc"/,
  );
  assert.match(
    result,
    /release-download:quark -->[\s\S]*?href="https:\/\/pan\.quark\.cn\/s\/def"/,
  );
  assert.match(result, /data-baidu-code>bt12<\/strong>/);
  assert.doesNotMatch(result, /releases\/latest/);
  assert.match(result, /<article class="download-card" data-download-card="baidu">/);
  assert.match(result, /<article class="download-card" data-download-card="quark">/);
  assert.match(result, /<p class="download-fallback" data-download-fallback hidden>/);
});

test("escapes ampersands in share links", () => {
  const result = applyReleaseLinks(page, {
    tag_name: "v0.1.2",
    body: '<!-- breaktimer-downloads {"quark":"https://pan.quark.cn/s/def?pwd=1&x=2"} -->',
  });
  assert.match(
    result,
    /href="https:\/\/pan\.quark\.cn\/s\/def\?pwd=1&amp;x=2"/,
  );
});

test("hides unconfigured cards and shows the fallback", () => {
  const result = applyReleaseLinks(page, {
    tag_name: "v0.1.1",
    body: "## 变更\n\n- 首次发布\n",
  });
  assert.match(result, /data-download-card="baidu" hidden>/);
  assert.match(result, /data-download-card="quark" hidden>/);
  assert.match(result, /<p class="download-fallback" data-download-fallback>/);
  assert.match(result, /href="https:\/\/pan\.baidu\.com\/"/);
  assert.match(result, /href="https:\/\/pan\.quark\.cn\/"/);
});

test("keeps one card and hides the other when only one link exists", () => {
  const result = applyReleaseLinks(page, {
    tag_name: "v0.1.2",
    body: '<!-- breaktimer-downloads {"quark":"https://pan.quark.cn/s/def"} -->',
  });
  assert.match(
    result,
    /<article class="download-card" data-download-card="baidu" hidden>/,
  );
  assert.doesNotMatch(result, /data-download-card="quark"[^>]*hidden/);
  assert.match(
    result,
    /release-download:quark -->[\s\S]*?href="https:\/\/pan\.quark\.cn\/s\/def"/,
  );
  assert.match(result, /<p class="download-fallback" data-download-fallback hidden>/);
});

test("hides the access code paragraph when Baidu has no code", () => {
  const result = applyReleaseLinks(page, {
    tag_name: "v0.1.2",
    body: '<!-- breaktimer-downloads {"baidu":"https://pan.baidu.com/s/abc"} -->',
  });
  assert.match(
    result,
    /<p class="download-code" data-download-code hidden>/,
  );
});

test("shows pre-hidden cards once their link is configured", () => {
  const hiddenPage = page
    .replace('data-download-card="baidu">', 'data-download-card="baidu" hidden>')
    .replace('data-download-card="quark">', 'data-download-card="quark" hidden>');
  const result = applyReleaseLinks(hiddenPage, release);
  assert.doesNotMatch(result, /data-download-card="baidu"[^>]*hidden/);
  assert.doesNotMatch(result, /data-download-card="quark"[^>]*hidden/);
  assert.match(result, /<p class="download-code" data-download-code>/);
});

test("fails when a download placeholder is missing", () => {
  assert.throws(
    () =>
      applyReleaseLinks(page.replace("release-download:baidu", "removed"), release),
    /Missing release-download:baidu placeholder/,
  );
  assert.throws(
    () =>
      applyReleaseLinks(page.replace("release-download:quark", "removed"), release),
    /Missing release-download:quark placeholder/,
  );
});

test("fails when the fallback placeholder is missing", () => {
  assert.throws(
    () => applyReleaseLinks(page.replace("data-download-fallback", "removed"), release),
    /Missing data-download-fallback placeholder/,
  );
});
