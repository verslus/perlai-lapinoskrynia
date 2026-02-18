import { env } from "@/lib/env";

type AlertInput = {
  subject: string;
  text: string;
};

export async function sendCriticalAlert(input: AlertInput) {
  const to = env.alertEmailTo;
  const apiKey = env.resendApiKey;
  if (!to || !apiKey) return;

  const from = env.alertFrom;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: input.subject,
        text: input.text
      })
    });
  } catch (error) {
    console.error("Nepavyko išsiųsti alert laiško", error);
  }
}
