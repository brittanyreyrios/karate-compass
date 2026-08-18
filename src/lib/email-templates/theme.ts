// Shared Tiger's Den email styling — bold black / white / red athletic look.
// Email clients need inline styles, so these are plain style objects.

export const RED = '#e11d2e'

export const main = {
  backgroundColor: '#0a0a0a',
  fontFamily: 'Helvetica, Arial, sans-serif',
  margin: '0',
  padding: '0',
}

export const container = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 24px 40px',
}

export const card = {
  backgroundColor: '#121212',
  border: '1px solid #262626',
  borderRadius: '16px',
  padding: '32px 28px',
}

export const brandBar = {
  height: '4px',
  backgroundColor: RED,
  borderRadius: '2px',
  margin: '0 0 24px',
  fontSize: '1px',
  lineHeight: '4px',
}

export const brand = {
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.18em',
  textTransform: 'uppercase' as const,
  margin: '0 0 4px',
}

export const brandSub = {
  color: '#8a8a8a',
  fontSize: '11px',
  letterSpacing: '0.22em',
  textTransform: 'uppercase' as const,
  margin: '0 0 28px',
}

export const h1 = {
  color: '#ffffff',
  fontSize: '24px',
  fontWeight: 'bold' as const,
  lineHeight: '1.2',
  textTransform: 'uppercase' as const,
  margin: '0 0 20px',
}

export const text = {
  color: '#d4d4d4',
  fontSize: '15px',
  lineHeight: '1.6',
  margin: '0 0 20px',
}

export const button = {
  backgroundColor: RED,
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 'bold' as const,
  letterSpacing: '0.06em',
  textTransform: 'uppercase' as const,
  borderRadius: '10px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
  margin: '4px 0 28px',
}

export const link = { color: RED, textDecoration: 'underline' }

export const muted = {
  color: '#a3a3a3',
  fontSize: '13px',
  lineHeight: '1.6',
  margin: '0 0 16px',
}

export const hr = {
  borderColor: '#262626',
  margin: '28px 0 20px',
}

export const footer = {
  color: '#737373',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: '0',
}
