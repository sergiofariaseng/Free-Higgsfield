import { NextResponse } from "next/server";
import { deleteFailedJobs } from "@/lib/db";
import { apiError } from "@/lib/api";
export async function DELETE() { try { return NextResponse.json({ ok: true, removed: await deleteFailedJobs() }); } catch (err) { return apiError(err); } }
