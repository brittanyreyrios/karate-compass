import * as React from 'react'

import {
  Body,
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

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your Tiger's Den Parent Portal verification code</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>Your verification code</Heading>

          <Text style={s.text}>
            You're receiving this because a verification code was requested for your Tiger's Den
            Martial Arts &amp; Fitness Parent Portal account.
          </Text>

          <Text
            style={{
              color: '#ffffff',
              fontSize: '32px',
              fontWeight: 'bold',
              letterSpacing: '0.24em',
              backgroundColor: '#0a0a0a',
              border: `1px solid ${s.RED}`,
              borderRadius: '10px',
              padding: '18px 20px',
              textAlign: 'center' as const,
              margin: '4px 0 28px',
            }}
          >
            {token}
          </Text>

          <Text style={s.muted}>
            This code can only be used once. If you didn't request it, you can safely ignore this
            email — nothing will change on your account.
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

export default ReauthenticationEmail
