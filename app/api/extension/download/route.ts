import fs from "fs";
import path from "path";
import { unzipSync, zipSync, strToU8 } from "fflate";
import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isPlaceholder(u?: string | null): boolean {
  if (!u) return true;
  const lower = u.toLowerCase();
  return lower.includes("your-localdrop-server") || lower.includes("your-cobalt") || lower.includes("example.com");
}

function resolveHostUrl(request: NextRequest): string {
  const { searchParams } = new URL(request.url);

  // 1. Explicit origin query param from browser (e.g. window.location.origin)
  const queryOrigin = searchParams.get("origin")?.trim();
  if (queryOrigin && (queryOrigin.startsWith("http://") || queryOrigin.startsWith("https://")) && !isPlaceholder(queryOrigin)) {
    return queryOrigin.replace(/\/+$/, "");
  }

  // 2. Platform host headers from Render / Vercel proxy
  const forwardedHost = request.headers.get("x-forwarded-host")?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();
  const proto = request.headers.get("x-forwarded-proto") || (host?.includes("localhost") ? "http" : "https");
  if (host && !isPlaceholder(host)) {
    return `${proto}://${host}`.replace(/\/+$/, "");
  }

  // 3. Platform environment variables (Render / Vercel / custom)
  const envVars = [
    process.env.RENDER_EXTERNAL_URL,
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : undefined,
    process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined,
  ];

  for (const envVal of envVars) {
    if (envVal?.trim() && !isPlaceholder(envVal)) {
      let val = envVal.trim();
      if (!val.startsWith("http://") && !val.startsWith("https://")) {
        val = `https://${val}`;
      }
      return val.replace(/\/+$/, "");
    }
  }

  // 4. Request URL origin fallback
  if (request.nextUrl.origin && !isPlaceholder(request.nextUrl.origin)) {
    return request.nextUrl.origin.replace(/\/+$/, "");
  }

  return "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  try {
    const hostUrl = resolveHostUrl(request);
    console.log(`[Extension Download] Dynamically tailoring extension for host: ${hostUrl}`);

    // Read base zip from public folder
    let baseZipBuffer: Uint8Array | null = null;
    const localZipPath = path.join(process.cwd(), "public", "localdrop-extension.zip");

    if (fs.existsSync(localZipPath)) {
      baseZipBuffer = new Uint8Array(fs.readFileSync(localZipPath));
    } else {
      // In serverless environments where public assets are served via CDN
      const publicAssetUrl = new URL("/localdrop-extension.zip", request.url);
      const res = await fetch(publicAssetUrl);
      if (res.ok) {
        baseZipBuffer = new Uint8Array(await res.arrayBuffer());
      }
    }

    if (!baseZipBuffer) {
      return new NextResponse("Base extension zip not available", { status: 404 });
    }

    // Unzip in-memory
    const unzipped = unzipSync(baseZipBuffer);

    // Create tailored config.js
    const tailoredConfig = `// LocalDrop Extension Configuration
// Automatically configured for host: ${hostUrl}
self.LOCALDROP_CONFIG = {
  defaultServerUrl: ${JSON.stringify(hostUrl)},
};
`;

    // Locate config.js entry in the zip (handles flat and nested structures)
    const configKey = Object.keys(unzipped).find((k) => k.endsWith("config.js")) || "config.js";
    unzipped[configKey] = strToU8(tailoredConfig);

    // Re-compress the zip
    const patchedZip = zipSync(unzipped);

    return new Response(Buffer.from(patchedZip), {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": 'attachment; filename="localdrop-extension.zip"',
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "X-Configured-Host": hostUrl,
      },
    });
  } catch (error) {
    console.error("[Extension Download API] Error building dynamic zip:", error);
    return new NextResponse("Failed to package extension", { status: 500 });
  }
}
