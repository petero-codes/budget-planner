/**
 * Mailer abstraction. In development (no SMTP configured) messages are
 * logged to the server console and the action link is returned so the UI
 * can surface it for testing. Plug SMTP/Graph API here for production.
 */

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  actionUrl: string;
}

export interface MailResult {
  delivered: boolean;
  /** Present only in development so testers can complete the flow without SMTP. */
  devLink?: string;
}

export async function sendMail(message: MailMessage): Promise<MailResult> {
  const smtpConfigured = Boolean(process.env.SMTP_HOST);

  if (!smtpConfigured) {
    console.log(
      `\n[mail] To: ${message.to}\n[mail] Subject: ${message.subject}\n[mail] ${message.text}\n[mail] Link: ${message.actionUrl}\n`
    );
    return {
      delivered: false,
      devLink:
        process.env.NODE_ENV !== "production" ? message.actionUrl : undefined,
    };
  }

  // TODO(production): send via SMTP (nodemailer) or Microsoft Graph.
  throw new Error("SMTP transport not implemented yet");
}

export function appBaseUrl(): string {
  return process.env.APP_BASE_URL ?? "http://localhost:3000";
}
