"use client";

import type { ParamDef } from "@/lib/models";
import Popover from "./Popover";
import { optionLabel } from "@/lib/locale";

/**
 * Renders one registry parameter. The control type comes from the model
 * definition, so a new model needs no changes here.
 */
export default function ParamPill({
  def,
  value,
  onChange,
}: {
  def: ParamDef;
  value: unknown;
  onChange: (v: unknown) => void;
}) {
  if (def.type === "bool") {
    const on = Boolean(value);
    return (
      <button
        type="button"
        onClick={() => onChange(!on)}
        className={`flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors ${
          on
            ? "border-accent/40 bg-accent/10 text-text"
            : "border-edge-soft bg-panel-2/60 text-muted hover:border-edge hover:text-text"
        }`}
      >
        <span className={on ? "text-text" : "text-faint"}>{def.label}</span>
        <span
          className={`relative h-4 w-7 rounded-full transition-colors ${on ? "bg-accent" : "bg-edge"}`}
        >
          <span
            className={`absolute top-0.5 size-3 rounded-full bg-panel transition-all ${
              on ? "left-3.5" : "left-0.5"
            }`}
          />
        </span>
      </button>
    );
  }

  if (def.type === "enum") {
    return (
      <Popover label={def.label} value={optionLabel(value ?? def.default ?? "")}>
        {(close) => (
          <div className="max-h-64 overflow-y-auto">
            {def.options?.map((opt) => {
              const selected = String(opt) === String(value ?? def.default);
              return (
                <button
                  key={String(opt)}
                  type="button"
                  onClick={() => {
                    onChange(opt);
                    close();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm transition-colors ${
                    selected ? "bg-panel-2 text-text" : "text-muted hover:bg-panel-2/60 hover:text-text"
                  }`}
                >
                  <span>{optionLabel(opt)}</span>
                  {selected && <span className="text-accent">✓</span>}
                </button>
              );
            })}
          </div>
        )}
      </Popover>
    );
  }

  if (def.type === "text") {
    const str = typeof value === "string" ? value : "";
    return (
      <Popover label={def.label} value={str ? truncate(str) : "nenhum"}>
        {() => (
          <div className="w-64 p-1.5">
            <textarea
              rows={3}
              value={str}
              placeholder={def.placeholder}
              onChange={(e) => onChange(e.target.value)}
              className="w-full resize-none rounded-lg border border-edge bg-panel-2 px-2.5 py-2 text-sm outline-none placeholder:text-faint focus:border-accent/50"
            />
          </div>
        )}
      </Popover>
    );
  }

  if (def.type === "seed") {
    const has = value !== undefined && value !== "";
    return (
      <Popover label={def.label} value={has ? String(value) : "automático"}>
        {() => (
          <div className="w-52 space-y-2 p-1.5">
            <p className="text-xs leading-relaxed text-faint">
              Fixe a semente para reproduzir um resultado. Deixe em branco para usar uma nova a cada geração.
            </p>
            <div className="flex gap-1.5">
              <input
                type="number"
                value={has ? String(value) : ""}
                placeholder="automático"
                onChange={(e) => onChange(e.target.value === "" ? undefined : Number(e.target.value))}
                className="min-w-0 flex-1 rounded-lg border border-edge bg-panel-2 px-2.5 py-1.5 text-sm outline-none focus:border-accent/50"
              />
              <button
                type="button"
                onClick={() => onChange(Math.floor(Math.random() * 2_147_483_647))}
                className="rounded-lg border border-edge px-2.5 py-1.5 text-xs text-muted hover:text-text"
                title="Semente aleatória"
              >
                ⟳
              </button>
            </div>
          </div>
        )}
      </Popover>
    );
  }

  // int / float — a slider, since every numeric param in the registry is bounded.
  const num = Number(value ?? def.default ?? 0);
  const step = def.step ?? (def.type === "int" ? 1 : 0.01);
  const decimals = def.type === "int" ? 0 : String(step).split(".")[1]?.length ?? 2;

  // Durations read better with a unit than as a bare number.
  const unit = def.key === "duration" ? "s" : "";

  return (
    <Popover label={def.label} value={`${num.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${unit}`}>
      {() => (
        <div className="w-52 space-y-2.5 p-2">
          <input
            type="range"
            min={def.min ?? 0}
            max={def.max ?? 1}
            step={step}
            value={num}
            onChange={(e) => onChange(Number(e.target.value))}
            className="w-full accent-[var(--accent)]"
          />
          <div className="flex justify-between text-2xs text-faint">
            <span>{def.min ?? 0}</span>
            <span className="font-semibold text-text">
              {num.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}
              {unit}
            </span>
            <span>{def.max ?? 1}</span>
          </div>
        </div>
      )}
    </Popover>
  );
}

function truncate(s: string): string {
  return s.length > 14 ? `${s.slice(0, 14)}…` : s;
}
