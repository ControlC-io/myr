import dotenv from 'dotenv';

dotenv.config();

import express, { Request, Response, NextFunction } from 'express';
import sgMail from '@sendgrid/mail';

const PORT = parseInt(process.env.EMAIL_SERVICE_PORT ?? '3001', 10);
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY ?? '';
const SENDGRID_FROM_EMAIL = process.env.SENDGRID_FROM_EMAIL ?? '';
const EMAIL_SERVICE_SECRET = process.env.EMAIL_SERVICE_SECRET ?? '';

if (!SENDGRID_API_KEY) {
  console.error('FATAL: SENDGRID_API_KEY is not set');
  process.exit(1);
}
if (!SENDGRID_FROM_EMAIL) {
  console.error('FATAL: SENDGRID_FROM_EMAIL is not set');
  process.exit(1);
}
if (!EMAIL_SERVICE_SECRET) {
  console.error('FATAL: EMAIL_SERVICE_SECRET is not set');
  process.exit(1);
}

sgMail.setApiKey(SENDGRID_API_KEY);

const app = express();
app.use(express.json());

// ─── Shared-secret guard ──────────────────────────────────────────────────────
// All routes below this middleware require a valid X-Service-Secret header.
// This ensures only the backend (which knows the secret) can trigger sends.
function requireServiceSecret(req: Request, res: Response, next: NextFunction): void {
  const provided = req.headers['x-service-secret'];
  if (!provided || provided !== EMAIL_SERVICE_SECRET) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}

// ─── Routes ───────────────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'email-service' });
});

interface SendOtpBody {
  to: string;
  code: string;
  expiresInMinutes?: number;
}

app.post('/send-otp', requireServiceSecret, async (req: Request, res: Response) => {
  const { to, code, expiresInMinutes = 10 } = req.body as SendOtpBody;

  if (!to || !code) {
    res.status(400).json({ error: '`to` and `code` are required' });
    return;
  }

  const msg = {
    to,
    from: SENDGRID_FROM_EMAIL,
    subject: 'Your verification code',
    text: `Your verification code is: ${code}\n\nThis code expires in ${expiresInMinutes} minutes. Do not share it with anyone.`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;border:1px solid #e5e7eb;border-radius:8px;">
        <h2 style="margin-top:0;color:#111827;">Verification Code</h2>
        <p style="color:#374151;">Use the code below to complete your sign-in. It expires in <strong>${expiresInMinutes} minutes</strong>.</p>
        <div style="font-size:2rem;font-weight:700;letter-spacing:0.25em;text-align:center;padding:16px;background:#f3f4f6;border-radius:6px;color:#111827;">
          ${code}
        </div>
        <p style="margin-bottom:0;font-size:0.875rem;color:#6b7280;">If you did not request this code, you can safely ignore this email.</p>
      </div>
    `,
  };

  try {
    await sgMail.send(msg);
    console.log(`OTP sent to ${to}`);
    res.json({ success: true });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('SendGrid error:', message);
    res.status(502).json({ error: 'Failed to send email', detail: message });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Email service running on port ${PORT}`);
  console.log(`From address: ${SENDGRID_FROM_EMAIL}`);
});
