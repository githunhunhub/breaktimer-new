import assert from "node:assert/strict";
import test from "node:test";

import { applyReleaseLinks, selectReleaseAssets } from "./resolve-downloads.mjs";

const release = {
  tag_name: "v0.1.1",
  assets: [
    {
      name: "BreakTimer-new_v0.1.1_x64-setup.exe",
      browser_download_url:
        "https://github.com/githunhunhub/breaktimer-new/releases/download/v0.1.1/BreakTimer-new_v0.1.1_x64-setup.exe",
    },
    {
      name: "BreakTimer-new_v0.1.1_x64-portable.zip",
      browser_download_url:
        "https://github.com/githunhunhub/breaktimer-new/releases/download/v0.1.1/BreakTimer-new_v0.1.1_x64-portable.zip",
    },
    {
      name: "SHA256SUMS.txt",
      browser_download_url:
        "https://github.com/githunhunhub/breaktimer-new/releases/download/v0.1.1/SHA256SUMS.txt",
    },
  ],
};

const page = `<!doctype html>
<p>Latest version: <strong data-release-version>See GitHub Releases</strong></p>
<!-- release-download:nsis -->
<a class="button" data-download="nsis" href="https://github.com/githunhunhub/breaktimer-new/releases/latest">
  Download installer
</a>
<!-- release-download:portable -->
<a class="button" data-download="portable" href="https://github.com/githunhunhub/breaktimer-new/releases/latest">
  Download portable
</a>`;

test("selects exactly one installer and one portable asset", () => {
  const selected = selectReleaseAssets(release.assets);
  assert.equal(selected.installer.name, "BreakTimer-new_v0.1.1_x64-setup.exe");
  assert.equal(selected.portable.name, "BreakTimer-new_v0.1.1_x64-portable.zip");
});

test("rejects releases without a unique installer and portable asset", () => {
  assert.throws(() => selectReleaseAssets([]), /exactly one \*-setup\.exe/);
  assert.throws(
    () => selectReleaseAssets([release.assets[0], release.assets[2]]),
    /exactly one \*-portable\.zip/,
  );
});

test("rewrites download links and the version label", () => {
  const result = applyReleaseLinks(page, release);
  assert.match(result, /href="https:\/\/github\.com\/githunhunhub\/breaktimer-new\/releases\/download\/v0\.1\.1\/BreakTimer-new_v0\.1\.1_x64-setup\.exe"/);
  assert.match(result, /href="https:\/\/github\.com\/githunhunhub\/breaktimer-new\/releases\/download\/v0\.1\.1\/BreakTimer-new_v0\.1\.1_x64-portable\.zip"/);
  assert.match(result, /data-release-version>v0\.1\.1<\/strong>/);
  assert.doesNotMatch(result, /releases\/latest/);
});

test("fails when a download placeholder is missing", () => {
  assert.throws(
    () => applyReleaseLinks(page.replace("release-download:portable", "removed"), release),
    /Missing release-download:portable placeholder/,
  );
});

test("fails when the version placeholder is missing", () => {
  assert.throws(
    () => applyReleaseLinks(page.replace("data-release-version", "removed"), release),
    /Missing data-release-version placeholder/,
  );
});
