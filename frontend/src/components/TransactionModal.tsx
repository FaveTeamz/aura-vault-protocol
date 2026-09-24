"use client";

import { useState, useEffect, useRef } from "react";
import { AlertCircle, CheckCircle, XCircle } from "lucide-react";
import PreSignBreakdown from "./PreSignBreakdown";

type TxType = "deposit" | "withdraw";
type Step = 1 | 2 | 3;
type TxStatus = "idle" | "pending" | "success" | "error";

interface Props {
  type: TxType;
  balance: string;
  /** Current share price (XLM per share) used in the pre-sign breakdown. */
  sharePrice?: string;
  /** Timestamp (epoch ms) when sharePrice was last updated. */
  sharePriceUpdatedAt?: number;
  onClose: () => void;
}

function Spinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-current" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

export default function TransactionModal({ type, balance, sharePrice = "1.0", sharePriceUpdatedAt: _sharePriceUpdatedAt, onClose }: Props) {
  const [step, setStep] = useState<Step>(1);
  const [amount, setAmount] = useState("");
  const [amountError, setAmountError] = useState("");
  const [status, setStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState("");
  const [txError, setTxError] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === 1) inputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  function validateAmount(): boolean {
    const n = parseFloat(amount);
    if (!amount || isNaN(n) || n <= 0) {
      setAmountError("Enter an amount greater than 0");
      return false;
    }
    if (n > parseFloat(balance)) {
      setAmountError("Amount exceeds your balance");
      return false;
    }
    setAmountError("");
    return true;
  }

  async function handleNext() {
    if (step === 1 && validateAmount()) {
      setStep(2);
    } else if (step === 2) {
      setStep(3);
      await handleSubmit();
    }
  }

  async function handleSubmit(retrying = false) {
    if (!retrying) {
      setStatus("pending");
      setTxError("");
    }

    try {
      const res = await fetch("/api/vault/transactions/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, amount }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Transaction failed");
      }

      setTxHash(data.hash || `tx-${Date.now()}`);
      setStatus("success");
      setRetryCount(0);
    } catch (err: unknown) {
      const errorMsg = (err instanceof Error ? err.message : "Transaction failed") ?? "Transaction failed";
      setTxError(errorMsg);
      setStatus("error");

      if (retrying) {
        setRetryCount((prev) => prev + 1);
      }
    }
  }

  function handleRetry() {
    setStatus("idle");
    setRetryCount((prev) => prev + 1);
    handleSubmit(true);
  }

  const label = type === "deposit" ? "Deposit" : "Withdraw";
  const balanceNum = parseFloat(balance);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`${label} modal`}
      data-cy="tx-modal"
    >
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl dark:bg-zinc-900 animate-modal-content">
        <button
          data-cy="modal-close"
          onClick={onClose}
          className="absolute right-4 top-4 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          aria-label="Close"
        >
          ✕
        </button>

        <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">{label}</h2>

        {/* Step indicator */}
        <div className="flex gap-2 mb-6">
          {[1, 2, 3].map((s) => (
            <div
              key={s}
              className={`h-1.5 flex-1 rounded-full ${
                s <= step
                  ? "bg-zinc-900 dark:bg-zinc-100"
                  : "bg-zinc-200 dark:bg-zinc-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Amount Input */}
        {step === 1 && (
          <div data-cy="modal-step-1" className="flex flex-col gap-4">
            <p className="text-sm text-zinc-500">
              Available:{" "}
              <span className="font-mono font-semibold text-zinc-800 dark:text-zinc-200">
                {balance}
              </span>
            </p>
            <input
              ref={inputRef}
              data-cy="modal-amount-input"
              type="number"
              min="0"
              step="any"
              placeholder="0.00"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setAmountError("");
              }}
              className="rounded-lg border border-zinc-300 px-4 py-2.5 font-mono text-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100"
            />

            {/* Quick amount buttons */}
            <div className="flex gap-2">
              {[25, 50, 75, 100].map((pct) => (
                <button
                  key={pct}
                  onClick={() => {
                    const amt = (balanceNum * pct) / 100;
                    setAmount(amt.toFixed(2));
                    setAmountError("");
                  }}
                  className="flex-1 rounded-md bg-zinc-100 px-2 py-1.5 text-xs font-medium hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700"
                >
                  {pct}%
                </button>
              ))}
            </div>

            {amountError && (
              <p
                data-cy="modal-amount-error"
                className="text-sm text-red-600 dark:text-red-400 flex items-center gap-2"
                role="alert"
              >
                <AlertCircle size={16} />
                {amountError}
              </p>
            )}

            <button
              data-cy="modal-next-btn"
              onClick={handleNext}
              className="rounded-lg bg-zinc-900 px-4 py-2.5 font-semibold text-white hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-black dark:hover:bg-zinc-300"
            >
              Next
            </button>
          </div>
        )}

        {/* Step 2: Pre-sign Breakdown */}
        {step === 2 && (
          <div data-cy="modal-step-2">
            <PreSignBreakdown
              type={type}
              amount={amount}
              sharePrice={sharePrice}
              onCancel={() => setStep(1)}
              onProceed={handleNext}
            />
          </div>
        )}

        {/* Step 3: Signing / Result */}
        {step === 3 && (
          <div
            data-cy="modal-step-3"
            className="flex flex-col items-center gap-4 py-4 text-center"
          >
            {status === "pending" && (
              <>
                <Spinner />
                <p className="text-sm text-zinc-500">Confirming in wallet…</p>
                <button
                  data-cy="modal-confirm-btn"
                  disabled
                  className="rounded-lg bg-zinc-200 px-4 py-2.5 font-semibold text-zinc-400 dark:bg-zinc-700 dark:text-zinc-500"
                >
                  Waiting…
                </button>
              </>
            )}

            {status === "success" && (
              <div data-cy="modal-success" className="flex flex-col items-center gap-3">
                <CheckCircle size={48} className="text-green-600 dark:text-green-400" />
                <p className="font-semibold text-zinc-900 dark:text-zinc-50">
                  {label} successful!
                </p>
                <p className="text-xs text-zinc-500">
                  Tx:{" "}
                  <span
                    data-cy="modal-tx-hash"
                    className="font-mono"
                  >
                    {txHash.slice(0, 16)}…
                  </span>
                </p>
                <button
                  onClick={onClose}
                  className="mt-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black"
                >
                  Done
                </button>
              </div>
            )}

            {status === "error" && (
              <div data-cy="modal-error" className="flex flex-col items-center gap-3">
                <XCircle size={48} className="text-red-600 dark:text-red-400" />
                <p className="text-sm text-red-600 dark:text-red-400">
                  {txError || "Transaction failed"}
                </p>
                {retryCount < 3 && (
                  <button
                    data-cy="modal-retry-btn"
                    onClick={handleRetry}
                    className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-semibold text-white hover:bg-zinc-700 dark:bg-zinc-100 dark:text-black"
                  >
                    Retry {retryCount > 0 && `(${retryCount}/3)`}
                  </button>
                )}
                <button
                  onClick={() => setStep(1)}
                  className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-semibold hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Start Over
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
