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

export type ClassCatalogEntry = {
  name: string;
  days: string;
  time_start: string;
  time_end: string;
  location: string;
};

/** Printed timetable — used only as a fallback when a class row has no schedule set. */
export const CLASS_CATALOG: ClassCatalogEntry[] = [
  { name: "Tiny Tigers",                      days: "Mon/Wed", time_start: "5:15pm", time_end: "5:45pm", location: "Large Dojo" },
  { name: "Tiger Cubs",                       days: "Mon/Wed", time_start: "5:15pm", time_end: "5:45pm", location: "Small Dojo" },
  { name: "Young Tigers",                     days: "Mon/Wed", time_start: "5:45pm", time_end: "6:30pm", location: "Large Dojo" },
  { name: "Teen Karate",                      days: "Mon/Wed", time_start: "6:30pm", time_end: "7:15pm", location: "Small Dojo" },
  { name: "Karate Beginners",                 days: "Mon/Wed", time_start: "6:30pm", time_end: "7:15pm", location: "Large Dojo" },
  { name: "Adult Karate",                     days: "Mon/Wed", time_start: "7:15pm", time_end: "8:00pm", location: "Large Dojo" },
  { name: "Adult Striking",                   days: "Mon/Wed", time_start: "7:15pm", time_end: "8:00pm", location: "V12" },
  { name: "Kid's Jiu Jitsu",                  days: "Tue/Thu", time_start: "5:15pm", time_end: "6:00pm", location: "Large Dojo" },
  { name: "Intermediate Karate",              days: "Tue/Thu", time_start: "6:00pm", time_end: "6:45pm", location: "Large Dojo" },
  { name: "Tai Chi",                          days: "Tue/Thu", time_start: "6:00pm", time_end: "7:00pm", location: "Small Dojo" },
  { name: "Intermediate / Advanced Children", days: "Tue/Thu", time_start: "6:45pm", time_end: "7:30pm", location: "Large Dojo" },
  { name: "Adult Jiu Jitsu & Wrestling",      days: "Tue/Thu", time_start: "7:30pm", time_end: "8:30pm", location: "Large Dojo" },
];
