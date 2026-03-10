import { Resend } from 'resend';

export async function sendWelcomeEmail(email) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping welcome email');
    return;
  }

  const resend = new Resend(process.env.RESEND_API_KEY);

  try {
    await resend.emails.send({
      from: 'WillFit <noreply@will-fit.shop>',
      to: email,
      subject: 'Welcome to WillFit!',
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; padding: 32px;">
          <h1 style="color: #111; font-size: 28px; margin-bottom: 8px;">Welcome to WillFit 💪</h1>
          <p style="color: #444; font-size: 16px; line-height: 1.6;">
            Your account has been created. You're all set to start tracking your workouts,
            logging personal bests, and building programs.
          </p>
          <a href="https://will-fit.shop"
             style="display: inline-block; margin-top: 24px; padding: 12px 24px;
                    background: #111; color: #fff; text-decoration: none;
                    border-radius: 8px; font-size: 15px;">
            Go to WillFit
          </a>
          <p style="color: #999; font-size: 13px; margin-top: 32px;">
            If you didn't sign up for WillFit, you can ignore this email.
          </p>
        </div>
      `,
    });
  } catch (err) {
    // Don't fail signup if email sending fails
    console.error('Failed to send welcome email:', err.message);
  }
}
