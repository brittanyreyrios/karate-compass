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

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({ confirmationUrl }: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset Your Tiger's Den Parent Portal Password</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>Reset your password</Heading>

          <Text style={s.text}>
            You're receiving this because a password reset was requested for your Tiger's Den
            Martial Arts &amp; Fitness Parent Portal account.
          </Text>

          <Button style={s.button} href={confirmationUrl}>
            Choose a new password
          </Button>

          <Text style={s.muted}>
            This link can only be used once. If you didn't request a reset, you can safely
            ignore this email — your password will not change.
          </Text>

          <Text style={s.muted}>
            Questions? This message comes from an unmonitored address — please email us at{' '}
            <Link href="mailto:leaguecity.tigersden@gmail.com" style={s.link}>
              leaguecity.tigersden@gmail.com
            </Link>{' '}
            instead.
          </Text>

          <Hr style={s.hr} />

          <Text style={s.footer}>— Tiger's Den Martial Arts &amp; Fitness, League City</Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail
