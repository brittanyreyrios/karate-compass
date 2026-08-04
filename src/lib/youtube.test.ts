import { describe, expect, it } from "vitest";
import { extractYouTubeId, formatRuntime } from "./youtube";

describe("extractYouTubeId", () => {
  it("keeps a bare 11-character id", () => {
    expect(extractYouTubeId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("strips playlist params from a real address-bar URL", () => {
    expect(
      extractYouTubeId(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PLabc123def456&index=2&t=30s",
      ),
    ).toBe("dQw4w9WgXcQ");
  });

  it("handles youtu.be, embed, shorts and nocookie forms", () => {
    expect(extractYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=xyz")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(extractYouTubeId("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("rejects anything that is not a YouTube video", () => {
    expect(extractYouTubeId("")).toBeNull();
    expect(extractYouTubeId("not a link")).toBeNull();
    expect(extractYouTubeId("https://vimeo.com/123456")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/watch?v=tooshort")).toBeNull();
    expect(extractYouTubeId("https://www.youtube.com/@tigersden")).toBeNull();
  });
});

describe("formatRuntime", () => {
  it("formats and rejects", () => {
    expect(formatRuntime(95)).toBe("1:35");
    expect(formatRuntime(600)).toBe("10:00");
    expect(formatRuntime(null)).toBeNull();
    expect(formatRuntime(0)).toBeNull();
  });
});
