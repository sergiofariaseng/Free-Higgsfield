import { NextResponse } from "next/server";
import { StoreError } from "./github";
import { BadRequest } from "./payload";
import { HiggsfieldError, MissingCredentialsError } from "./higgsfield";
export function apiError(error: unknown) {
  if (error instanceof StoreError || error instanceof HiggsfieldError) return NextResponse.json({ error: error.message }, { status: error.status >= 400 && error.status <= 599 ? error.status : 503 });
  if (error instanceof BadRequest || error instanceof SyntaxError) return NextResponse.json({ error: error.message }, { status: 400 });
  if (error instanceof MissingCredentialsError) return NextResponse.json({ error: error.message }, { status: 503 });
  return NextResponse.json({ error: "Não foi possível concluir a operação. Tente novamente." }, { status: 503 });
}
