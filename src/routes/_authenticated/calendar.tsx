import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, List, MapPin, Users, Clock, Ban } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarGrid } from "@/components/ui/calendar";
import { supabase } from "@/integrations/supabase/client";
import {
  EVENT_TYPE_META,
  buildCalendarItems,
  groupByDate,
  formatDayHeading,
  toDateKey,
  type CalendarItem,
  type ClassScheduleRow,
  type DojoEvent,
  type HolidayRow,
} from "@/lib/calendar-data";

export const Route = createFileRoute("/_authenticated/calendar")({
  head: () => ({
    meta: [
      { title: "Calendar — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content: "Weekly classes, closures, testing dates and special events at Tiger's Den Martial Arts & Fitness.",
      },
      { property: "og:title", content: "Calendar — Tiger's Den Martial Arts & Fitness" },
      { property: "og:description", content: "Weekly classes, closures, testing dates and special events." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CalendarPage;
});

function CalendarPage() {
  return null;
}
