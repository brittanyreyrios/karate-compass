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

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your new email for Tiger's Den Martial Arts &amp; Fitness</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>Confirm your new email</Heading>

          <Text style={s.text}>
            You're receiving this because an email change was requested for your Tiger's Den
            Martial Arts &amp; Fitness Parent Portal account
            {oldEmail ? ` (${oldEmail})` : ''}
            {newEmail ? ` to ${newEmail}` : ''}.
          </Text>

          <Button style={s.button} href={confirmationUrl}>
            Confirm my new email address
          </Button>

          <Text style={s.muted}>
            This link can only be used once. If you didn't request this change, you can safely
            ignore this email — your address will not change.
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

export default EmailChangeEmail
