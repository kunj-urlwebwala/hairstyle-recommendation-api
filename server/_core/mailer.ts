import { ENV } from "./env";

/**
 * Transactional email via the Resend HTTP API.
 * Returns false when RESEND_API_KEY is not configured so callers can fall back
 * to a friendly "email delivery unavailable" message.
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<boolean> {
  if (!ENV.resendApiKey) return false;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      authorization: `Bearer ${ENV.resendApiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      from: ENV.mailFrom,
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    console.error(`[Mailer] send failed (${response.status})${detail ? `: ${detail}` : ""}`);
    return false;
  }

  return true;
}

export function passwordResetEmailTemplate(otp: string): { subject: string; html: string } {
  return {
    subject: `Your Mirror reset code: ${otp}`,
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
        <h2 style="color:#7A3E62">Reset your Mirror password</h2>
        <p>Use this one-time code to finish resetting your password. It expires in 10 minutes.</p>
        <p style="font-size:32px;font-weight:800;letter-spacing:6px;color:#211D21">${otp}</p>
        <p style="color:#8E8587;font-size:13px">If you did not request this, you can ignore this email and your password stays unchanged.</p>
      </div>
    `,
  };
}
