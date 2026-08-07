type SupabasePublicConfig = {
  publishableKey: string;
  url: string;
};

export function getSupabasePublicConfig(): SupabasePublicConfig {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !publishableKey) {
    throw new Error("La configuration publique Supabase est incomplète.");
  }

  return { publishableKey, url };
}
