import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

const BRAND = '#0E6E62';
const CORAL = '#EE5B36';

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F4EFE3;font-family:'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(22,33,28,.12);">
  <div style="background:${BRAND};padding:26px 32px;display:flex;align-items:center;gap:12px;">
    <span style="font-size:22px;">✈️</span>
    <div>
      <div style="color:#fff;font-size:20px;font-weight:800;letter-spacing:-0.5px;">Uni Mate</div>
      <div style="color:rgba(255,255,255,.75);font-size:11px;letter-spacing:1.5px;text-transform:uppercase;">FlyMate Network</div>
    </div>
  </div>
  <div style="padding:32px;">${body}</div>
  <div style="padding:18px 32px;border-top:1px solid #E3DAC8;text-align:center;color:#8A9189;font-size:12px;">
    Uni Mate · FlyMate Network — This is an automated email, please do not reply.
  </div>
</div>
</body></html>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.APP_URL}/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"Uni Mate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify your email — Uni Mate',
    html: wrap(`
      <h2 style="color:#16211C;font-size:22px;font-weight:800;margin:0 0 12px;">Verify your email address</h2>
      <p style="color:#56615A;font-size:15px;line-height:1.6;margin:0 0 28px;">
        You're one step away from joining the Uni Mate FlyMate network. Click the button below to verify your email address.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Verify Email Address
      </a>
      <p style="color:#8A9189;font-size:13px;margin:16px 0 0;">This link expires in 24 hours. If you didn't create an account, ignore this email.</p>
    `),
  });
}

export async function sendRegistrationAcknowledgement(to: string, name: string) {
  await transporter.sendMail({
    from: `"Uni Mate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Application received — Uni Mate',
    html: wrap(`
      <h2 style="color:#16211C;font-size:22px;font-weight:800;margin:0 0 12px;">We've got your application, ${name.split(' ')[0]}!</h2>
      <p style="color:#56615A;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your profile and documents have been submitted successfully. Our team will verify your details and get back to you within <strong>2–3 business days</strong>.
      </p>
      <div style="background:#DBEBE6;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#0A4A42;font-weight:700;font-size:14px;margin:0 0 10px;">What happens next?</p>
        <ol style="color:#0A4A42;font-size:14px;line-height:2;margin:0;padding-left:18px;">
          <li>Our team reviews your submitted documents</li>
          <li>You receive an approval or follow-up email</li>
          <li>Once approved, log in to access your FlyMate dashboard</li>
        </ol>
      </div>
      <p style="color:#8A9189;font-size:13px;margin:0;">Need help? Reply to this email or contact our support team.</p>
    `),
  });
}

export async function sendApprovalEmail(to: string, name: string) {
  const url = `${process.env.APP_URL}/login`;
  await transporter.sendMail({
    from: `"Uni Mate" <${process.env.GMAIL_USER}>`,
    to,
    subject: "You're approved — Uni Mate 🎉",
    html: wrap(`
      <h2 style="color:#16211C;font-size:22px;font-weight:800;margin:0 0 12px;">Congratulations, ${name.split(' ')[0]}! 🎉</h2>
      <p style="color:#56615A;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your profile has been <strong style="color:#2E9D5C;">verified and approved</strong>. You can now log in and access your FlyMate dashboard to connect with fellow students travelling to your destination.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Go to My Dashboard
      </a>
      <p style="color:#8A9189;font-size:13px;margin:0;">Welcome to the Uni Mate FlyMate network!</p>
    `),
  });
}

export async function sendRejectionEmail(to: string, name: string, reason: string) {
  const url = `${process.env.APP_URL}/login`;
  await transporter.sendMail({
    from: `"Uni Mate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Application update — Uni Mate',
    html: wrap(`
      <h2 style="color:#16211C;font-size:22px;font-weight:800;margin:0 0 12px;">Application Update</h2>
      <p style="color:#56615A;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi ${name.split(' ')[0]}, after reviewing your application we were unable to approve it at this time.
      </p>
      <div style="background:#FBE2D8;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid ${CORAL};">
        <p style="color:#C9421F;font-weight:700;font-size:14px;margin:0 0 8px;">Reason for rejection</p>
        <p style="color:#C9421F;font-size:14px;margin:0;">${reason}</p>
      </div>
      <p style="color:#56615A;font-size:14px;line-height:1.6;margin:0 0 20px;">
        If you'd like to re-apply with updated documents, you can log in and submit a new application.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Log In to Re-apply
      </a>
    `),
  });
}
