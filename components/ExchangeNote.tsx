import type { ExchangeRate } from "@/lib/currency";

export default function ExchangeNote({ exchange }: { exchange: ExchangeRate | null | undefined }) {
  return (
    <div className="rounded-xl border border-edge-soft bg-panel/50 px-4 py-3 text-xs leading-relaxed text-faint">
      <p className="font-medium text-muted">
        {exchange ? (
          <>
            Cotação usada: US$ 1 = R$ {exchange.rate.toLocaleString("pt-BR", { minimumFractionDigits: 4, maximumFractionDigits: 4 })}
            {" · "}{exchange.date.split("-").reverse().join("/")}
            {" · "}<a href="https://frankfurter.dev/" target="_blank" rel="noopener noreferrer" className="underline decoration-dotted underline-offset-2">Frankfurter</a>
            {exchange.stale && " · Última cotação salva; atualização indisponível."}
          </>
        ) : exchange === undefined ? "Carregando cotação do dólar…" : "Cotação indisponível no momento. Os gastos em dólar continuam disponíveis."}
      </p>
      <p className="mt-1">Os valores em reais são estimativas dos custos registrados, convertidos pela cotação acima, sem impostos ou taxas do cartão. A cobrança e o limite continuam em dólar.</p>
    </div>
  );
}
