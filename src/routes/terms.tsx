import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { LegalHeader, LegalSection, LegalBullets, LegalFooterNav, TIGERS_DEN_CONTACT } from "@/components/legal";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Tiger's Den Martial Arts & Fitness" },
      {
        name: "description",
        content:
          "The terms that govern use of the Tiger's Den Martial Arts & Fitness Parent Portal, including accounts, acceptable use and liability.",
      },
      { property: "og:title", content: "Terms of Service — Tiger's Den Martial Arts & Fitness" },
      {
        property: "og:description",
        content: "The terms that govern use of the Tiger's Den Parent Portal.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
        <LegalHeader />

        <header className="mt-10">
          <div className="inline-flex items-center gap-2 text-xs uppercase tracking-[0.3em] text-primary">
            <ScrollText className="h-3.5 w-3.5" aria-hidden="true" /> The rules
          </div>
          <h1 className="mt-3 font-display text-3xl font-bold uppercase tracking-wide sm:text-4xl">
            Terms of <span className="text-gradient-red">Service</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Effective Date: July 30th, 2026 · Last Updated: July 30th, 2026
          </p>
        </header>

        <div className="mt-8 space-y-4 text-base leading-relaxed text-muted-foreground">
          <p>
            These Terms of Service ("Terms") govern your use of the {TIGERS_DEN_CONTACT.name} Parent
            Portal (the "Portal"). By creating an account or using the Portal, you agree to these Terms.
            If you do not agree, please do not use the Portal.
          </p>
        </div>

        <LegalSection n={1} title="Who May Use the Portal">
          <p>
            The Portal is for parents and legal guardians of students enrolled at {TIGERS_DEN_CONTACT.name}.
            You must be at least 18 years old to create an account. Children do not create accounts or
            sign in directly; a parent or guardian manages all student information.
          </p>
          <p>Accounts are created with an invite code issued by our staff to enrolled families.</p>
        </LegalSection>

        <LegalSection n={2} title="Your Account">
          <LegalBullets
            items={[
              "Keep your password confidential and do not share your login with anyone outside your household.",
              "You are responsible for activity that happens under your account.",
              "Provide accurate information, and keep your email address current so you can recover access.",
              "Tell us right away if you believe someone else has accessed your account.",
            ]}
          />
        </LegalSection>

        <LegalSection n={3} title="Acceptable Use">
          <p>When using the Portal, you agree not to:</p>
          <LegalBullets
            items={[
              "Attempt to access another family's data, or probe, scan or test the security of the Portal.",
              "Copy, download, redistribute or repost photos, videos or curriculum content outside the Portal without our written permission.",
              "Upload or submit content that is unlawful, harassing, defamatory or infringing.",
              "Use automated tools to scrape, mirror or overload the Portal.",
              "Misrepresent your identity or your relationship to a student.",
            ]}
          />
          <p>
            We may suspend or terminate access for conduct that violates these Terms or that puts other
            families' information at risk.
          </p>
        </LegalSection>

        <LegalSection n={4} title="Student Information and Accuracy">
          <p>
            Attendance counts, belt ranks, Dojo Points, testing dates and schedules shown in the Portal
            are maintained by our staff and may lag behind what happens on the mat. The Portal is an
            informational convenience; it is not a contract, a guarantee of promotion, and it does not
            replace direct communication with your instructor.
          </p>
        </LegalSection>

        <LegalSection n={5} title="Photos, Videos and Media Release">
          <p>
            Photo and video sharing is opt-in and controlled by you in Account Settings. Media use is
            governed by our Media Release, which forms part of these Terms. You may change your consent
            at any time; changing it going forward does not automatically remove material already
            published elsewhere (for example, printed materials already distributed).
          </p>
        </LegalSection>

        <LegalSection n={6} title="Intellectual Property">
          <p>
            Curriculum videos, written material, branding and Portal design are owned by
            {" "}{TIGERS_DEN_CONTACT.name} or its licensors and are provided for the personal, non-commercial
            use of enrolled families only. All rights not expressly granted are reserved.
          </p>
        </LegalSection>

        <LegalSection n={7} title="Premium Features">
          <p>
            Some Portal features may be offered as part of a premium tier in the future. If a paid tier
            launches, pricing, billing and cancellation terms will be presented to you before you are
            charged, and these Terms will be updated accordingly.
          </p>
        </LegalSection>

        <LegalSection n={8} title="Availability and Changes">
          <p>
            The Portal is provided on an "as is" and "as available" basis. We may modify, suspend or
            discontinue features at any time, and we do not guarantee uninterrupted or error-free
            operation.
          </p>
        </LegalSection>

        <LegalSection n={9} title="Limitation of Liability">
          <p>
            To the maximum extent permitted by law, {TIGERS_DEN_CONTACT.name} is not liable for indirect,
            incidental, special or consequential damages arising from your use of the Portal, or for
            reliance on information displayed in the Portal. Nothing in these Terms limits liability that
            cannot be limited under applicable law. Physical training at our school is covered by the
            separate waiver and enrollment agreement you signed with the school.
          </p>
        </LegalSection>

        <LegalSection n={10} title="Termination">
          <p>
            You may stop using the Portal at any time and request account deletion by contacting us. We
            may deactivate accounts for families who are no longer enrolled, or for violations of these
            Terms. Data handling after termination is described in our Privacy Policy.
          </p>
        </LegalSection>

        <LegalSection n={11} title="Governing Law">
          <p>
            These Terms are governed by the laws of the State of Texas, without regard to its conflict of
            law rules. Any dispute will be brought in the state or federal courts located in Galveston
            County, Texas.
          </p>
        </LegalSection>

        <LegalSection n={12} title="Contact Us">
          <p>
            Questions about these Terms? Contact {TIGERS_DEN_CONTACT.name}, {TIGERS_DEN_CONTACT.address}.
            Phone {TIGERS_DEN_CONTACT.phone}. Email{" "}
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
