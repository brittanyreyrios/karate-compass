// Mock data — ready to be replaced with live Supabase queries.
export type Belt = {
  name: string;
  color: string; // tailwind bg class or hex
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

export const CLASS_NAMES = ["Little Tigers", "Juniors", "Teens/Adults"] as const;

export type Student = {
  id: string;
  first_name: string;
  last_name: string;
  current_belt: string;
  attendance_count: number;
  start_date: string; // ISO
  next_test_date: string; // ISO
};

export type Profile = {
  id: string;
  email: string;
  role: "admin" | "parent";
  family_name: string;
  students: Student[];
};

export const MOCK_PROFILE: Profile = {
  id: "parent-1",
  email: "parent@dojo.com",
  role: "parent",
  family_name: "Rodriguez",
  students: [
    {
      id: "s-1",
      first_name: "Mateo",
      last_name: "Rodriguez",
      current_belt: "Blue",
      attendance_count: 84,
      start_date: "2023-02-14",
      next_test_date: futureDate(21),
    },
    {
      id: "s-2",
      first_name: "Sofia",
      last_name: "Rodriguez",
      current_belt: "Orange",
      attendance_count: 42,
      start_date: "2024-06-01",
      next_test_date: futureDate(48),
    },
    {
      id: "s-3",
      first_name: "Diego",
      last_name: "Rodriguez",
      current_belt: "White",
      attendance_count: 12,
      start_date: "2025-09-10",
      next_test_date: futureDate(75),
    },
  ],
};

function futureDate(days: number) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

export const SCHOOL_NEWS = [
  {
    id: "n1",
    title: "New Morning Kids Class Added",
    body: "Starting next month we're adding a 9am Saturday class for ages 6–10. Space is limited to 15.",
    date: "2 days ago",
    tag: "Schedule",
  },
  {
    id: "n2",
    title: "Dojo Renovation Complete",
    body: "New mats and a full mirror wall are in. Come check out the upgraded training floor!",
    date: "1 week ago",
    tag: "Facility",
  },
  {
    id: "n3",
    title: "Uniform Reorder Window",
    body: "We are placing our seasonal gi order this Friday. Sign up at the front desk.",
    date: "2 weeks ago",
    tag: "Gear",
  },
];

export const TOURNAMENTS = [
  {
    id: "t1",
    title: "Pacific Coast Jiu-Jitsu Open",
    location: "San Diego, CA",
    date: "Nov 15, 2026",
    daysAway: 24,
    discipline: "Jiu-Jitsu",
  },
  {
    id: "t2",
    title: "Karate Regional Championships",
    location: "Phoenix, AZ",
    date: "Dec 6, 2026",
    daysAway: 45,
    discipline: "Karate",
  },
  {
    id: "t3",
    title: "Winter Grappling Invitational",
    location: "Las Vegas, NV",
    date: "Jan 24, 2027",
    daysAway: 94,
    discipline: "Jiu-Jitsu",
  },
];

export const CURRICULUM = [
  { belt: "White", techniques: ["Basic stance", "Front kick", "Rear naked escape"], duration: "8 min" },
  { belt: "Yellow", techniques: ["Roundhouse kick", "Hip throw", "Guard retention"], duration: "12 min" },
  { belt: "Orange", techniques: ["Side kick combo", "Armbar from guard", "Scissor sweep"], duration: "15 min" },
  { belt: "Green", techniques: ["Spinning back kick", "Triangle choke", "Kimura"], duration: "18 min" },
  { belt: "Blue", techniques: ["Flying knee", "Berimbolo", "Deep half guard"], duration: "22 min" },
  { belt: "Purple", techniques: ["Advanced combos", "Leg lock system", "Guard passing series"], duration: "28 min" },
];

export const GALLERY = Array.from({ length: 12 }).map((_, i) => ({
  id: `g${i}`,
  title: ["Regional Finals", "Belt Ceremony", "Summer Camp", "Open Mat", "Team Photo", "Award Night"][i % 6],
  date: `2026 · Event ${i + 1}`,
}));
