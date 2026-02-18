export const env = {
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  jwtSecret: process.env.JWT_SECRET ?? "dev-secret-change-me",
  policyVersion: process.env.POLICY_VERSION ?? "v1",
  resendApiKey: process.env.RESEND_API_KEY,
  alertEmailTo: process.env.ALERT_EMAIL_TO,
  alertFrom: process.env.ALERT_FROM ?? "onboarding@resend.dev"
};
