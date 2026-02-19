const EMAIL_SERVICE_URL = process.env.EMAIL_SERVICE_URL ?? 'http://email_service:3001';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET ?? '';

/**
 * Sends a 2FA OTP code to the given email address via the dedicated email microservice.
 * Throws if the email service returns a non-OK response.
 */
export async function sendOtp(to: string, code: string, expiresInMinutes = 10): Promise<void> {
  if (!EMAIL_SERVICE_SECRET) {
    throw new Error('EMAIL_SERVICE_SECRET is not configured');
  }

  const response = await fetch(`${EMAIL_SERVICE_URL}/send-otp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Service-Secret': EMAIL_SERVICE_SECRET,
    },
    body: JSON.stringify({ to, code, expiresInMinutes }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Email service responded with ${response.status}: ${body}`);
  }
}
