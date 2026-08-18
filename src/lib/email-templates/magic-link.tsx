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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your sign-in link for Tiger's Den Martial Arts &amp; Fitness</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>Your sign-in link</Heading>

          <Text style={s.text}>
            You're receiving this because a sign-in link was requested for your Tiger's Den
            Martial Arts &amp; Fitness Parent Portal account.
          </Text>

          <Button style={s.button} href={confirmationUrl}>
            Sign in to the Parent Portal
          </Button>

          <Text style={s.muted}>
            This link can only be used once and expires shortly. If you didn't request it, you
            can safely ignore this email — nothing will change on your account.
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

export default MagicLinkEmail
