import { describe, expect, it } from "vitest";

import {
  appendDownloadSection,
  parseDownloads,
  renderDownloadSection,
} from "./release-downloads.mjs";

describe("release download metadata", () => {
  it("ignores placeholder values", () => {
    expect(parseDownloads({ quark: null, baidu: "", baiduCode: null })).toEqual(
      { quark: null, baidu: null, baiduCode: null },
    );
    expect(renderDownloadSection({ quark: null, baidu: null })).toBe("");
  });

  it("orders Baidu and Quark in the visible section", () => {
    const section = renderDownloadSection({
      quark: "https://pan.quark.cn/s/abc",
      baidu: "https://pan.baidu.com/s/def",
      baiduCode: "1234",
    });

    const quark = section.indexOf("[夸克网盘]");
    const baidu = section.indexOf("[百度网盘]");
    expect(baidu).toBeGreaterThan(-1);
    expect(quark).toBeGreaterThan(baidu);
    expect(section).not.toContain("[GitHub Releases]");
    expect(section).toContain("（提取码：1234）");
    expect(section).toContain(
      '<!-- breaktimer-downloads {"baidu":"https://pan.baidu.com/s/def","quark":"https://pan.quark.cn/s/abc","baiduCode":"1234"} -->',
    );
  });

  it("keeps Baidu-only configurations valid", () => {
    const section = renderDownloadSection({
      baidu: "https://pan.baidu.com/s/def",
    });

    expect(section).not.toContain("[夸克网盘]");
    expect(section).toContain("[百度网盘]");
    expect(section).not.toContain("[GitHub Releases]");
  });

  it("rejects links on unexpected hosts", () => {
    expect(() =>
      parseDownloads({ quark: "https://example.com/s/abc" }),
    ).toThrow(/Quark download link/);
    expect(() =>
      parseDownloads({ baidu: "https://example.com/s/abc" }),
    ).toThrow(/Baidu download link/);
  });

  it("appends one section to the generated release body", () => {
    const body = "## BreakTimer-new v0.1.2\n\n### 修复\n\n- 修复问题\n";
    const next = appendDownloadSection(body, {
      quark: "https://pan.quark.cn/s/abc",
    });

    expect(next.startsWith(body)).toBe(true);
    expect(next).toContain("## 下载方式");
    expect(next).toContain("<!-- breaktimer-downloads");
  });
});
