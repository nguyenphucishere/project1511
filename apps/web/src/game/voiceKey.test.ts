import { describe, expect, it } from "vitest";
import { normalizeVoiceText, voiceKey } from "./voiceKey";

describe("voiceKey", () => {
  it("is stable: the same words give the same key", () => {
    expect(voiceKey("en", "Liftoff. We have a liftoff.")).toBe(voiceKey("en", "Liftoff. We have a liftoff."));
    expect(voiceKey("en", "Liftoff.")).toMatch(/^en-[0-9a-f]{16}$/);
  });

  it("pins a known value, so the generator and the game can never drift apart", () => {
    // If either of these changes, every recorded file has to be regenerated.
    expect(voiceKey("en", "Houston, Tranquility Base here. The Eagle has landed.")).toBe("en-c792fe3af4174ae3");
    expect(voiceKey("vi", "Houston, đây là Căn cứ Yên Bình. Tàu Eagle đã hạ cánh.")).toBe("vi-616328d1e25e8266");
  });

  it("ignores whitespace differences", () => {
    expect(voiceKey("vi", "  Chào   bạn \n")).toBe(voiceKey("vi", "Chào bạn"));
    expect(normalizeVoiceText("a \n\t b")).toBe("a b");
  });

  it("separates languages and different words", () => {
    expect(voiceKey("en", "Go")).not.toBe(voiceKey("vi", "Go"));
    expect(voiceKey("en", "Go")).not.toBe(voiceKey("en", "Go."));
  });

  it("copes with Vietnamese text and has no collisions over many short lines", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 5000; i++) seen.add(voiceKey("vi", `Dòng thoại số ${i}: Đã qua áp suất cực đại`));
    expect(seen.size).toBe(5000);
  });
});
