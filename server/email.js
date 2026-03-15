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
          <p style="color: #444; font-size: 16px; line-height: 1.6; margin-top: 16px;">
            Congrats — you're part of a select group getting early access to the alpha version of WillFit.
            Your feedback will directly shape how this app evolves, so thank you for being here from the start.
          </p>
          <div style="margin-top: 24px; padding: 16px 20px; background: #f8f4e8; border-left: 4px solid #e6a817; border-radius: 8px;">
            <p style="color: #333; font-size: 14px; line-height: 1.6; margin: 0;">
              <strong>You're using the alpha version of WillFit!</strong> Things are still being built and improved.
              If you run into any bugs or have features you'd like to see added, head to the
              <strong>Profile</strong> tab and tap <strong>Send Feedback</strong> — we'd love to hear from you.
            </p>
          </div>
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
