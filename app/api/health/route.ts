import { NextResponse } from "next/server";
export function GET() { return NextResponse.json({ app: "free-higgsfield-studio", status: "ok" }); }
