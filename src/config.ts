import dotenv from 'dotenv';
dotenv.config();

function require_env(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional_env(key: string, fallback = ''): string {
  return process.env[key] ?? fallback;
}

export const config = {
  anthropic: {
    apiKey: require_env('ANTHROPIC_API_KEY'),
    model: 'claude-opus-4-6' as const,
  },
  supabase: {
    url: require_env('SUPABASE_URL'),
    serviceKey: require_env('SUPABASE_SERVICE_KEY'),
  },
  hostex: {
    apiKey: require_env('HOSTEX_API_KEY'),
    baseUrl: optional_env('HOSTEX_BASE_URL', 'https://api.hostex.io/v3'),
  },
  hms: {
    ownerEmail: optional_env('HMS_OWNER_EMAIL', 'otainadal@gmail.com'),
    ownerName: optional_env('HMS_OWNER_NAME', 'Oscar Nadal'),
    companyDomain: optional_env('HMS_COMPANY_DOMAIN', 'hostmyspot.com.do'),
    approvalWebhookUrl: optional_env('APPROVAL_WEBHOOK_URL'),
  },
} as const;

export type Config = typeof config;
