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

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ confirmationUrl }: SignupEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Confirm your email for Tiger's Den Martial Arts &amp; Fitness</Preview>
    <Body style={s.main}>
      <Container style={s.container}>
        <Section style={s.card}>
          <div style={s.brandBar} />
          <Text style={s.brand}>Tiger's Den</Text>
          <Text style={s.brandSub}>Martial Arts &amp; Fitness</Text>

          <Heading style={s.h1}>Welcome to the Tiger's Den Parent Portal</Heading>

          <Text style={s.text}>
            You're receiving this because someone signed up for the Tiger's Den Martial Arts
            &amp; Fitness Parent portal using this email address.
          </Text>

          <Text style={s.text}>
            Confirm your address to finish setting up your account. Once you're in, you'll be
            able to see your child's belt progress, curriculum and upcoming events.
          </Text>

          <Button style={s.button} href={confirmationUrl}>
            Confirm my email address
          </Button>

          <Text style={s.muted}>
            If you didn't sign up, you can ignore this message — no account will be created.
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

export default SignupEmail
