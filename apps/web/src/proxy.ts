import type { NextRequest, NextResponse } from "next/server";

import { refreshSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest): Promise<NextResponse> {
  return refreshSession(request);
}

export const config = {
  matcher: ["/app/:path*", "/login"],
};
