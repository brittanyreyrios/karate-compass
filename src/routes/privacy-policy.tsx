import { createFileRoute, Link } from "@tanstack/react-router";
import { Flame, Shield } from "lucide-react";

export const Route = createFileRoute("/privacy-policy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "How Tiger's Den Martial Arts & Fitness collects, uses and protects parent and student information in the Parent Portal.",
      },
      { property: "og:title", content: "Privacy Policy — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content:
          "How Tiger's Den Martial Arts & Fitness collects, uses and protects parent and student information in the Parent Portal.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PrivacyPolicyPage,
});

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10 border-t border-border pt-8">
      <h2 className="font-display text-xl font-bold uppercase tracking-wide sm:text-2xl">
        <span className="text-primary">{n}.</span> {title}
      </h2>
      <div className="mt-4 space-y-4 text-base leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

function Bullets({ items }: { items: string[] }) {
  return (
    <ul className="ml-5 list-disc space-y-2">
      {items.map((t) => (
        <li key={t}>{t}</li>
      ))}
    </ul>
  );
}

function PrivacyPolicyPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <Link
          to="/"
          className="inline-flex items-center gap-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gradient-red shadow-red-glow">
            <Flame className="h-5 w-5 text-white" strokeWidth={2.5} aria-hidden="true" />
          </span>
          <span>
            <span className="block font-display text-lg font-bold uppercase leading-none tracking-wider">
              Tiger's Den
            </span>
            <span className="mt-1 block text-xs uppercase tracking-[0.2em] text-muted-foreground">
              Martial Arts &amp; Fitness
            </span>
          </span>
        </Link>

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <Shield className="h-3.5 w-3.5" aria-hidden="true" /> Your data
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Privacy <span className="text-gradient-red">Policy</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: July 30th, 2026 · Last Updated: August 19th, 2026
          </p>
        </header>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            Tiger's Den Martial Arts &amp; Fitness ("we," "us," "our") operates the Parent Portal (the
            "Portal") for families enrolled at our school. This policy explains what information we
            collect, how we use it, and the choices you have.
          </p>
          <p>
            The Portal is intended for use by parents and guardians. Accounts are created and controlled
            by a parent or guardian — children do not create their own accounts or log in directly.
          </p>
        </div>

        <Section n={1} title="Information We Collect">
          <p className="font-semibold text-foreground">Account holder (parent/guardian):</p>
          <Bullets
            items={[
              "Email address (used for login)",
              "Phone number (optional, only if you enable two-factor authentication)",
              "Family name",
            ]}
          />
          <p className="font-semibold text-foreground">Student information, provided by the parent/guardian:</p>
          <Bullets
            items={[
              "Student's name and sibling names (if multiple children in one family)",
              "Date of birth",
              "Program start date",
              "Belt rank / rank progression",
              "Attendance records",
              "Dojo points earned (leaderboard and milestone data)",
              "Tournaments or competitions the student participates in",
              "Photos and videos of the student, subject to your consent setting (see Section 3)",
            ]}
          />
          <p>
            We do not collect payment or billing information through the Portal, and we do not collect
            medical, emergency contact, or incident-report data through the Portal at this time.
          </p>
        </Section>

        <Section n={2} title="How We Use This Information">
          <p>We use the information above to:</p>
          <Bullets
            items={[
              "Provide family-specific logins and keep each family's data separate from other families",
              "Display class schedules, announcements, and dojo-points leaderboards",
              "Track attendance and rank progression",
              "Recognize student achievements (leaderboard, milestones, competition results)",
              "Communicate with parents about their student's participation",
            ]}
          />
          <p>We do not sell student or family data, and we do not use it for advertising.</p>
        </Section>

        <Section n={3} title="Photos and Videos">
          <p>
            Photo and video sharing within the Portal is controlled by a setting in your account. It is
            pre-selected as ON when you sign up, shown to you on the signup form, and you can change it at
            any time in Account Settings. Permission to photograph and record your student is granted
            separately through the Media Release you accept when creating your account. While the setting
            is on, photos/videos of your student may be visible to other families in the Portal (e.g., in
            announcements or the Media Gallery).
          </p>
          <p>
            If you turn consent off, we stop publishing new photos and video of your student immediately,
            and we remove existing media of your student from the Parent Portal within 14 days of your
            request.
          </p>
          <p>
            Media that has already been posted to our social media accounts or public website is handled
            separately: we make reasonable efforts to remove it within 30 days. Materials already printed
            and distributed, or reshared by third parties, may not be recoverable.
          </p>
          <p className="font-semibold text-foreground">Instructional videos hosted on YouTube:</p>
          <p>
            Technique videos shown on the Belt Curriculum page are hosted on YouTube (a Google service)
            and embedded in the Portal. Nothing is requested from YouTube until you press play on a
            video — before that, only a still thumbnail image is loaded. Once you press play, Google may
            collect information about that playback as described in{" "}
            <a
              href="https://policies.google.com/privacy"
              target="_blank"
              rel="noreferrer"
              className="text-primary underline underline-offset-4"
            >
              Google's Privacy Policy
            </a>
            . We embed videos through YouTube's no-cookie domain, which reduces but does not eliminate
            the information Google receives.
          </p>
        </Section>



        <Section n={4} title="Children's Privacy">
          <p>
            The Portal is designed for parents/guardians, not for direct use by children. We do not
            knowingly collect personal information directly from children; all student information is
            provided and managed by a parent or guardian. If you believe a child has provided us
            information directly outside this process, contact us at (281) 535-9500 or in person at the
            school and we will address it promptly.
          </p>
        </Section>

        <Section n={5} title="How Data Is Stored and Protected">
          <Bullets
            items={[
              "The Portal is hosted by Lovable, and application data is stored with Supabase, a secure managed database provider.",
              "Row-level security ensures each family can only see their own student's private data.",
              "Access to the staff Admin Console is restricted to authorized Tiger's Den staff accounts.",
              "We do not store payment information in the Portal.",
            ]}
          />
        </Section>

        <Section n={6} title="Data Retention">
          <p>
            We retain student and family data for as long as the family is enrolled or has an active
            account. If your family leaves the school, you may request deletion of your account and
            associated data by calling (281) 535-9500 or asking a staff member at the front desk.
          </p>
        </Section>

        <Section n={7} title="Your Rights">
          <p>As a parent/guardian, you can:</p>
          <Bullets
            items={[
              "Access and review the information we have about your family",
              "Correct inaccurate information",
              "Request deletion of your account and data",
              "Grant or withdraw permission for photo/video sharing at any time",
            ]}
          />
          <p>
            To exercise these rights, call (281) 535-9500 or speak with a Tiger's Den staff member at
            3383 Deke Slayton Hwy, League City, TX 77573.
          </p>
        </Section>


        <Section n={8} title="Future Features">
          <p>
            We may introduce a premium subscription tier in the future, offering additional content
            (challenge programming, exclusive posts, etc.). This section will be updated before that tier
            launches if it changes what data we collect or how it's used.
          </p>
        </Section>

        <Section n={9} title="Changes to This Policy">
          <p>
            We may update this policy as the Portal changes. We'll update the "Last Updated" date above
            when we do. Material changes (e.g., new categories of data collected) will be communicated to
            families directly.
          </p>
        </Section>

        <Section n={10} title="Contact Us">
          <p>
            Questions about this policy or your data? Contact us at: Tiger's Den Martial Arts &amp;
            Fitness - 3383 Deke Slayton Hwy, League City, Tx 77573. (281) 535-9500.
          </p>
        </Section>

        <div className="mt-12 border-t border-border pt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            Back to the Portal
          </Link>
        </div>
      </div>
    </div>
  );
}
