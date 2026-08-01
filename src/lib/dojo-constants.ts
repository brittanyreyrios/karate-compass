/**
 * Static dojo reference data — belt order, class roster names and the printed
 * class timetable. These are configuration constants, not mock records: the
 * live student/announcement/gallery/curriculum data all comes from the database.
 */
export type Belt = {
  name: string;
  color: string;
  order: number;
};

export const BELT_PROGRESSION: Belt[] = [
  { name: "White", color: "#f8fafc", order: 0 },
  { name: "Gold", color: "#f5c518", order: 1 },
  { name: "Orange", color: "#fb923c", order: 2 },
  { name: "Green", color: "#22c55e", order: 3 },
  { name: "Purple", color: "#a855f7", order: 4 },
  { name: "Blue", color: "#3b82f6", order: 5 },
  { name: "Brown", color: "#92400e", order: 6 },
  { name: "Black", color: "#0a0a0a", order: 7 },
];

export const CLASS_NAMES = [
  "Tiny Tigers",
  "Tiger Cubs",
  "Young Tigers",
  "Teen Karate",
  "Karate Beginners",
  "Adult Karate",
  "Adult Striking",
  "Kid's Jiu Jitsu",
  "Intermediate Karate",
  "Tai Chi",
  "Intermediate / Advanced Children",
  "Adult Jiu Jitsu & Wrestling",
] as const;

/**
 * Class timetables (days/times/locations) live in the `class_schedules` table —
 * there is intentionally no hardcoded fallback catalog here.
 */

