import { describe, expect, it } from "vitest";

import {
  appendDownloadMetadata,
  parseDownloads,
  renderDownloadMetadata,
} from "./release-downloads.mjs";

describe("release download metadata", () => {
  it("ignores placeholder values", () => {
    expect(parseDownloads({ quark: null, baidu: "", baiduCode: null })).toEqual(
      { quark: null, baidu: null, baiduCode: null },
    );
    expect(renderDownloadMetadata({ quark: null, baidu: null })).toBe("");
  });

  it("renders links only as hidden metadata", () => {
    const output = renderDownloadMetadata({
      quark: "https://pan.quark.cn/s/abc",
      baidu: "https://pan.baidu.com/s/def",
      baiduCode: "1234",
    });

    expect(output).not.toContain("## 下载方式");
    expect(output).not.toContain("[百度网盘]");
    expect(output).not.toContain("[夸克网盘]");
    expect(output).not.toContain("（提取码：1234）");
    expect(output).toContain(
      '<!-- breaktimer-downloads {"baidu":"https://pan.baidu.com/s/def","quark":"https://pan.quark.cn/s/abc","baiduCode":"1234"} -->',
    );
  });

  it("keeps Baidu-only configurations valid", () => {
    const output = renderDownloadMetadata({
      baidu: "https://pan.baidu.com/s/def",
    });

    expect(output).not.toContain("[夸克网盘]");
    expect(output).not.toContain("[百度网盘]");
    expect(output).not.toContain("## 下载方式");
    expect(output).toContain(
      '<!-- breaktimer-downloads {"baidu":"https://pan.baidu.com/s/def"} -->',
    );
  });

  it("rejects links on unexpected hosts", () => {
    expect(() =>
      parseDownloads({ quark: "https://example.com/s/abc" }),
    ).toThrow(/Quark download link/);
    expect(() =>
      parseDownloads({ baidu: "https://example.com/s/abc" }),
    ).toThrow(/Baidu download link/);
  });

  it("appends hidden metadata to the generated release body", () => {
    const body = "## BreakTimer-new v0.1.2\n\n### 修复\n\n- 修复问题\n";
    const next = appendDownloadMetadata(body, {
      quark: "https://pan.quark.cn/s/abc",
    });

    expect(next.startsWith(body)).toBe(true);
    expect(next).not.toContain("## 下载方式");
    expect(next).not.toContain("[夸克网盘]");
    expect(next).toContain("<!-- breaktimer-downloads");
  });

  it("leaves the release body unchanged without download links", () => {
    const body = "## BreakTimer-new v0.1.2\n\n- 修复问题\n";

    expect(appendDownloadMetadata(body, {})).toBe(body);
  });
});
