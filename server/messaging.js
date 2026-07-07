import nodemailer from 'nodemailer'
import twilio from 'twilio'

function isPlaceholder(value) {
  const text = String(value || '')
  return (
    !text ||
    text.includes('your-provider.com') ||
    text.includes('pedalspower@example.com') ||
    text.includes('replace-with-smtp-password') ||
    text.includes('replace-with-account-sid') ||
    text.includes('replace-with-auth-token') ||
    text === '+10000000000'
  )
}

function hasSmtpConfig() {
  return Boolean(
    process.env.EMAIL_PROVIDER === 'smtp' &&
      process.env.SMTP_HOST &&
      process.env.SMTP_PORT &&
      process.env.SMTP_USER &&
      process.env.SMTP_PASS &&
      process.env.EMAIL_FROM &&
      !isPlaceholder(process.env.SMTP_HOST) &&
      !isPlaceholder(process.env.SMTP_USER) &&
      !isPlaceholder(process.env.SMTP_PASS) &&
      !isPlaceholder(process.env.EMAIL_FROM),
  )
}

function hasTwilioConfig() {
  return Boolean(
      process.env.SMS_PROVIDER === 'twilio' &&
      process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_PHONE_NUMBER &&
      !isPlaceholder(process.env.TWILIO_ACCOUNT_SID) &&
      !isPlaceholder(process.env.TWILIO_AUTH_TOKEN) &&
      !isPlaceholder(process.env.TWILIO_PHONE_NUMBER),
  )
}

export function getMessagingStatus() {
  const emailLive = hasSmtpConfig()
  const smsLive = hasTwilioConfig()

  return {
    email: {
      enabled: emailLive,
      mode: emailLive ? 'Live Provider' : 'Local Log',
      provider: emailLive ? 'SMTP' : 'Local Log',
    },
    sms: {
      enabled: smsLive,
      mode: smsLive ? 'Live Provider' : 'Local Log',
      provider: smsLive ? 'Twilio' : 'Local Log',
    },
  }
}

async function sendRegistrationEmail(participant) {
  const subject = 'Pedals Power registration complete'
  const body = `Hello ${participant.name}, your ${participant.selectedChallenge.toLowerCase()} registration is confirmed for ${participant.plannedActivityDate}.`

  if (!hasSmtpConfig()) {
    return {
      channel: 'Email',
      recipient: participant.email,
      subject,
      body,
      mode: 'Local Log',
      provider: 'Local Log',
    }
  }

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  })

  await transporter.sendMail({
    from: process.env.EMAIL_FROM,
    to: participant.email,
    subject,
    text: body,
  })

  return {
    channel: 'Email',
    recipient: participant.email,
    subject,
    body,
    mode: 'Live Provider',
    provider: 'SMTP',
  }
}

async function sendRegistrationSms(participant) {
  const subject = 'Pedals Power registration complete'
  const body = `Pedals Power: registration confirmed for ${participant.name}. Challenge activity: ${participant.selectedChallenge}. Planned date: ${participant.plannedActivityDate}.`

  if (!hasTwilioConfig()) {
    return {
      channel: 'SMS',
      recipient: participant.phone,
      subject,
      body,
      mode: 'Local Log',
      provider: 'Local Log',
    }
  }

  const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)

  await client.messages.create({
    from: process.env.TWILIO_PHONE_NUMBER,
    to: participant.phone,
    body,
  })

  return {
    channel: 'SMS',
    recipient: participant.phone,
    subject,
    body,
    mode: 'Live Provider',
    provider: 'Twilio',
  }
}

export async function sendRegistrationNotifications(participant) {
  const [emailNotification, smsNotification] = await Promise.all([
    sendRegistrationEmail(participant),
    sendRegistrationSms(participant),
  ])

  return [emailNotification, smsNotification]
}
