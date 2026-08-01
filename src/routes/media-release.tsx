import { createFileRoute } from "@tanstack/react-router";
import { Camera } from "lucide-react";
import { LegalHeader, LegalSection, LegalBullets, LegalFooterNav, TIGERS_DEN_CONTACT } from "@/components/legal";

export const MEDIA_RELEASE_VERSION = "2026-07-30";

export const Route = createFileRoute("/media-release")({
  head: () => ({
    meta: [
      { title: "Photo & Video Media Release — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "The photo and video media release for Tiger's Den Martial Arts & Fitness students, including what is shared, where, and how to change consent.",
      },
      { property: "og:title", content: "Photo & Video Media Release — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content: "What Tiger's Den does with student photos and video, and how parents control consent.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MediaReleasePage,
});

function MediaReleasePage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <LegalHeader />

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <Camera className="h-3.5 w-3.5" aria-hidden="true" /> Photos &amp; video
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Media <span className="text-gradient-red">Release</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Version {MEDIA_RELEASE_VERSION} · Effective July 30th, 2026
          </p>
        </header>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            This Media Release explains how {TIGERS_DEN_CONTACT.name} uses photographs and video of
            students. Accepting this Media Release when you create your account is your{" "}
            <span className="font-semibold text-foreground">express written permission</span> for
            Tiger&apos;s Den to photograph and record your student. That checkbox is required to open an
            account.
          </p>
          <p>
            Whether that media is <span className="font-semibold text-foreground">displayed</span> in the
            Portal is a separate, changeable preference. It is pre-selected as ON and shown to you on the
            signup form, so you can uncheck it before your account is created. You can also turn it off at
            any time in Account Settings. Turning it off stops new photos and videos of your student from
            being displayed.
          </p>
        </div>

        <LegalSection n={1} title="What We Capture">
          <LegalBullets
            items={[
              "Class photos and short training clips taken on the mat",
              "Belt promotion and testing ceremony photos",
              "Tournament and demonstration team photos and video",
              "Special event photos (seminars, camps, parties)",
            ]}
          />
        </LegalSection>

        <LegalSection n={2} title="Where It May Appear">
          <p>If you grant permission, media of your student may appear in:</p>
          <LegalBullets
            items={[
              "The Media Gallery inside the Parent Portal, visible to other enrolled families",
              "Announcements and celebration posts inside the Portal",
              "Tiger's Den social media accounts and website",
              "Printed materials for the school, such as flyers or in-gym displays",
            ]}
          />
          <p>
            We do not publish a student's last name, address, birthdate, school or contact details
            alongside their image, and we never sell images or license them to third-party advertisers.
          </p>
        </LegalSection>

        <LegalSection n={3} title="No Compensation">
          <p>
            You understand that no payment or other compensation is due to you or your student for use of
            media covered by this release, and that the school owns the photographs and recordings it
            creates.
          </p>
        </LegalSection>

        <LegalSection n={4} title="Withdrawing Consent">
          <p>
            You may withdraw consent at any time by switching Photo &amp; Video Consent off in Account
            Settings, or by emailing us. Once withdrawn:
          </p>
          <LegalBullets
            items={[
              "We stop publishing new media of your student immediately.",
              "We remove existing media of your student from the Parent Portal within 14 days of your request.",
              "Media already posted to our social media accounts or public website is handled separately: we make reasonable efforts to remove it within 30 days, because those platforms are outside the Portal and not fully under our control.",
              "Materials already printed and distributed, or reshared by third parties, may not be recoverable.",
            ]}
          />

        </LegalSection>

        <LegalSection n={5} title="Group Photos">
          <p>
            In wide group shots — a full class lined up, a tournament team photo — a student who has
            opted out may still be incidentally visible. If you would like your student excluded from all
            group images as well, tell us and we will make that arrangement with your instructor.
          </p>
        </LegalSection>

        <LegalSection n={6} title="Questions and Requests">
          <p>
            Contact {TIGERS_DEN_CONTACT.name}, {TIGERS_DEN_CONTACT.address}. Phone{" "}
            {TIGERS_DEN_CONTACT.phone}. Email{" "}
            <a
              href={`mailto:${TIGERS_DEN_CONTACT.email}`}
              className="font-semibold text-primary underline underline-offset-2"
            >
              {TIGERS_DEN_CONTACT.email}
            </a>
            .
          </p>
        </LegalSection>

        <LegalFooterNav />
      </div>
    </div>
  );
}
