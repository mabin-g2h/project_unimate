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

const BRAND = '#0942BD';
const CORAL = '#EE5B36';

function wrap(body: string) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F5F5F7;font-family:'SF Pro Text',-apple-system,'Helvetica Neue',Helvetica,Arial,sans-serif;">
<div style="max-width:560px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 4px 0 rgba(0,0,0,0.08), 0 8px 24px 0 rgba(0,0,0,0.08);">
  <div style="background:#ffffff;padding:24px 32px;border-bottom:1px solid rgba(0,0,0,0.08);">
    <img src="${process.env.APP_URL}/unimatelogo.png" alt="UniMate" width="130" style="display:block;width:130px;height:auto;border:0;" />
  </div>
  <div style="padding:32px;">${body}</div>
  <div style="padding:18px 32px;border-top:1px solid rgba(0,0,0,0.12);text-align:center;color:#8E8E93;font-size:12px;">
    UniMate · FlyMate Network — This is an automated email, please do not reply.
  </div>
</div>
</body></html>`;
}

export async function sendVerificationEmail(to: string, token: string) {
  const url = `${process.env.APP_URL}/api/auth/verify-email?token=${token}`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Verify your email — UniMate',
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">Verify your email address</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 28px;">
        You're one step away from joining the UniMate FlyMate network. Click the button below to verify your email address.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Verify Email Address
      </a>
      <p style="color:#8E8E93;font-size:13px;margin:16px 0 0;">This link expires in 12 hours. If you didn't create an account, ignore this email.</p>
    `),
  });
}

export async function sendRegistrationAcknowledgement(to: string, name: string) {
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Application received — UniMate',
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">We've got your application, ${name.split(' ')[0]}!</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your profile and documents have been submitted successfully. Our team will verify your details and get back to you within <strong>1-2 days</strong>.
      </p>
      <div style="background:#E8ECFA;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#0635A0;font-weight:700;font-size:14px;margin:0 0 10px;">What happens next?</p>
        <ol style="color:#0635A0;font-size:14px;line-height:2;margin:0;padding-left:18px;">
          <li>Our team reviews your submitted documents</li>
          <li>You receive an approval or follow-up email</li>
          <li>Once approved, log in to access your FlyMate dashboard</li>
        </ol>
      </div>
      <p style="color:#8E8E93;font-size:13px;margin:0;">Need help? Reply to this email or contact our support team.</p>
    `),
  });
}

export async function sendAdminRegistrationNotification(adminEmail: string, studentName: string, studentEmail: string) {
  const adminPortalUrl = `${process.env.APP_URL}/admin`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to: adminEmail,
    subject: 'New student application — UniMate',
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">New application awaiting review</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 20px;">
        A new student has submitted their registration and is awaiting your approval.
      </p>
      <div style="background:#E8ECFA;border-radius:12px;padding:20px;margin-bottom:24px;">
        <p style="color:#0635A0;font-weight:700;font-size:14px;margin:0 0 8px;">Applicant details</p>
        <p style="color:#0635A0;font-size:14px;margin:0;line-height:1.8;">
          <strong>Name:</strong> ${studentName}<br/>
          <strong>Email:</strong> ${studentEmail}
        </p>
      </div>
      <a href="${adminPortalUrl}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Review in admin portal
      </a>
    `),
  });
}

export async function sendApprovalEmail(to: string, name: string) {
  const url = `${process.env.APP_URL}/login`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: "You're approved — UniMate 🎉",
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">Congratulations, ${name.split(' ')[0]}! 🎉</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your profile has been <strong style="color:#2E9D5C;">verified and approved</strong>. You can now log in and access your FlyMate dashboard to connect with fellow students travelling to your destination.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Go to My Dashboard
      </a>
      <p style="color:#8E8E93;font-size:13px;margin:0;">Welcome to the UniMate FlyMate network!</p>
    `),
  });
}

export async function sendAdminInviteEmail(to: string, inviteUrl: string) {
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: "You've been invited to join UniMate as an admin",
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">Admin Invitation</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 28px;">
        You've been invited to join the <strong>UniMate</strong> admin portal. Click the button below to set your password and activate your account.
      </p>
      <a href="${inviteUrl}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Accept Invitation
      </a>
      <p style="color:#8E8E93;font-size:13px;margin:16px 0 0;">This invitation expires in 48 hours. If you were not expecting this email, you can safely ignore it.</p>
    `),
  });
}

export async function sendPasswordResetEmail(to: string, token: string) {
  const url = `${process.env.APP_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Reset your password — UniMate',
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">Reset your password</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 28px;">
        We received a request to reset the password for your UniMate account. Click the button below to set a new password.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        Reset Password
      </a>
      <p style="color:#8E8E93;font-size:13px;margin:16px 0 0;">This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email — your password won't change.</p>
    `),
  });
}

export async function sendNewPeerNotificationEmail(to: string, newStudentName: string, universityName: string) {
  const url = `${process.env.APP_URL}/`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: `New UniMate peer at ${universityName} — UniMate`,
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">You have a new UniMate peer!</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 28px;">
        <strong>${newStudentName.split(' ')[0]}</strong> has just joined UniMate from <strong>${universityName}</strong>. Log in to connect with them.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;margin-bottom:24px;">
        View FlyMate Dashboard
      </a>
    `),
  });
}

export async function sendRejectionEmail(to: string, name: string, reason: string) {
  const url = `${process.env.APP_URL}/login`;
  await transporter.sendMail({
    from: `"UniMate" <${process.env.GMAIL_USER}>`,
    to,
    subject: 'Application update — UniMate',
    html: wrap(`
      <h2 style="color:#1D1D1F;font-size:22px;font-weight:800;margin:0 0 12px;">Application Update</h2>
      <p style="color:#6E6E73;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi ${name.split(' ')[0]}, after reviewing your application we were unable to approve it at this time.
      </p>
      <div style="background:#FBE2D8;border-radius:12px;padding:20px;margin-bottom:24px;border-left:4px solid ${CORAL};">
        <p style="color:#C9421F;font-weight:700;font-size:14px;margin:0 0 8px;">Reason for rejection</p>
        <p style="color:#C9421F;font-size:14px;margin:0;">${reason}</p>
      </div>
      <p style="color:#6E6E73;font-size:14px;line-height:1.6;margin:0 0 20px;">
        If you'd like to re-apply with updated documents, you can log in and submit a new application.
      </p>
      <a href="${url}" style="display:inline-block;background:${BRAND};color:#fff;font-weight:700;font-size:15px;padding:14px 32px;border-radius:12px;text-decoration:none;">
        Log In to Re-apply
      </a>
    `),
  });
}
