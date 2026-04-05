import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const logsDir = path.resolve(process.cwd(), "..", "logs");
    await fs.mkdir(logsDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const level = String(body?.level || "error").toUpperCase();
    const module = String(body?.module || "frontend");
    const message = String(body?.message || "Unknown client-side error");
    const data = body?.data ? JSON.stringify(body.data) : "";

    const line = `${timestamp} ${level} ${module} ${message} ${data}\n`;
    await fs.appendFile(path.join(logsDir, "frontend.log"), line, "utf-8");

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
