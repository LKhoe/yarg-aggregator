import { describe, expect, it } from "vitest";
import { escapeLikePattern, isValidHttpsUrl, isValidLocale } from "./validation";

describe("isValidLocale", () => {
  it("accepts the supported locales", () => {
    for (const l of ["en", "pt-BR", "es", "fr", "de", "ja", "zh"]) expect(isValidLocale(l)).toBe(true);
  });

  it("rejects anything else", () => {
    for (const v of ["pt", "EN", "", null, undefined, 1, {}]) expect(isValidLocale(v)).toBe(false);
  });
});

describe("isValidHttpsUrl", () => {
  it("accepts https URLs only", () => {
    expect(isValidHttpsUrl("https://example.com/a?b=1")).toBe(true);
    expect(isValidHttpsUrl("http://example.com")).toBe(false);
    expect(isValidHttpsUrl("javascript:alert(1)")).toBe(false);
    expect(isValidHttpsUrl("//example.com")).toBe(false);
    expect(isValidHttpsUrl("not a url")).toBe(false);
    expect(isValidHttpsUrl(42)).toBe(false);
  });
});

describe("escapeLikePattern", () => {
  it("escapes LIKE wildcards and the escape character", () => {
    expect(escapeLikePattern("100%_sure\\")).toBe("100\\%\\_sure\\\\");
  });

  it("leaves ordinary text alone", () => {
    expect(escapeLikePattern("Dream Theater")).toBe("Dream Theater");
  });
});
