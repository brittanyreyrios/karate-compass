import { it } from "vitest";
import { beltLabelColor, hexToRgb, contrastRatio, oklchToRgb, CARD_BG_OKLCH } from "../src/lib/belt-colors";
const ranks = [
 ["White (stripe sys)","#f8fafc",null],["White + Gold Stripe","#f8fafc","#f5c518"],["White + Orange","#f8fafc","#fb923c"],
 ["White + Green","#f8fafc","#22c55e"],["White + Purple","#f8fafc","#a855f7"],["White + Blue","#f8fafc","#3b82f6"],
 ["White + Brown","#f8fafc","#92400e"],["White (camo sys)","#f8fafc",null],["Camo Gold","#4b5320","#f5c518"],
 ["Camo Orange","#4b5320","#fb923c"],["Camo Green","#4b5320","#22c55e"],["Camo Purple","#4b5320","#a855f7"],
 ["Camo Blue","#4b5320","#3b82f6"],["Camo Brown","#4b5320","#92400e"],["White (solid)","#f8fafc",null],
 ["Gold","#f5c518",null],["Orange","#fb923c",null],["Green","#22c55e",null],["Purple","#a855f7",null],
 ["Blue","#3b82f6",null],["Brown","#92400e",null],["Black","#0a0a0a",null],
] as const;
it("all ranks clear 4.5:1", () => {
  const bg = oklchToRgb(CARD_BG_OKLCH);
  let min = 99;
  for (const [name, p, a] of ranks) {
    const c = beltLabelColor(p, a);
    const ratio = contrastRatio(hexToRgb(c), bg);
    min = Math.min(min, ratio);
    console.log(`${name.padEnd(22)} ${p} -> ${c}  ${ratio.toFixed(2)}:1`);
  }
  console.log("MIN:", min.toFixed(2));
  if (min < 4.5) throw new Error("below AA");
});
