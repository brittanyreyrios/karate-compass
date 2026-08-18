import * as React from 'react'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

import * as s from './theme'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ confirmationUrl }: InviteEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>You're invited to the Tiger's Den Parent Portal</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>You're invited to the Parent Portal</Heading>

          <Text style={s.text}>
            You're receiving this because a Tiger's Den Martial Arts &amp; Fitness staff member
            invited you to the Parent Portal using this email address.
          </Text>

          <Text style={s.text}>
            Accept your invitation to set up your account. Once you're in, you'll be able to see
            your child's belt progress, curriculum and upcoming events.
          </Text>

          <Button style={s.button} href={confirmationUrl}>
            Accept my invitation
          </Button>

          <Text style={s.muted}>
            If you weren't expecting this, you can ignore this message — no account will be
            created.
          </Text>

          <Text style={s.muted}>
            Questions? Email us at{' '}
            <Link href="mailto:leaguecity.tigersden@gmail.com" style={s.link}>
              leaguecity.tigersden@gmail.com
            </Link>{' '}
            — this address doesn't receive replies.
          </Text>

          <Hr style={s.hr} />

          <Text style={s.footer}>— Tiger's Den Martial Arts &amp; Fitness, League City</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
