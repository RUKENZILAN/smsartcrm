// Channel senders. All credentials come from process.env — never hardcoded.
// Missing creds -> the send is reported as skipped, never throws.

export interface SendResult {
  status: "sent" | "failed" | "skipped";
  detail: string;
}

export async function sendEmail(args: {
  to: string;
  subject: string;
  body: string;
}): Promise<SendResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "onboarding@resend.dev";
  if (!key) {
    return {
      status: "skipped",
      detail: "Email channel not configured (set RESEND_API_KEY secret).",
    };
  }
  if (!args.to) return { status: "failed", detail: "Contact has no email address." };

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [args.to],
        subject: args.subject || "(no subject)",
        text: args.body,
      }),
    });
    if (!res.ok) {
      const txt = await res.text();
      return { status: "failed", detail: `Resend ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { status: "sent", detail: "Email sent via Resend." };
  } catch (e: unknown) {
    return { status: "failed", detail: `Email error: ${(e as Error).message}` };
  }
}

function twilioCreds() {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_PHONE_NUMBER;
  if (!sid || !token || !from) return null;
  return { sid, token, from };
}

export async function sendSms(args: { to: string; body: string }): Promise<SendResult> {
  const c = twilioCreds();
  if (!c) {
    return {
      status: "skipped",
      detail: "SMS channel not configured (set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER).",
    };
  }
  if (!args.to) return { status: "failed", detail: "Contact has no phone number." };

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Messages.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${c.sid}:${c.token}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: args.to, From: c.from, Body: args.body.slice(0, 1500) }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { status: "failed", detail: `Twilio SMS ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { status: "sent", detail: "SMS sent via Twilio." };
  } catch (e: unknown) {
    return { status: "failed", detail: `SMS error: ${(e as Error).message}` };
  }
}

export async function sendCall(args: { to: string; body: string }): Promise<SendResult> {
  const c = twilioCreds();
  if (!c) {
    return {
      status: "skipped",
      detail: "Call channel not configured (set TWILIO_* secrets).",
    };
  }
  if (!args.to) return { status: "failed", detail: "Contact has no phone number." };
  const safe = args.body.replace(/[<>&]/g, " ").slice(0, 1500);
  const twiml = `<Response><Say voice="alice">${safe}</Say></Response>`;
  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${c.sid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: "Basic " + btoa(`${c.sid}:${c.token}`),
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ To: args.to, From: c.from, Twiml: twiml }),
      },
    );
    if (!res.ok) {
      const txt = await res.text();
      return { status: "failed", detail: `Twilio Call ${res.status}: ${txt.slice(0, 200)}` };
    }
    return { status: "sent", detail: "Voice call initiated via Twilio." };
  } catch (e: unknown) {
    return { status: "failed", detail: `Call error: ${(e as Error).message}` };
  }
}
