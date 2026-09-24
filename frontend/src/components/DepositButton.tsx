"use client";
import { ReactNode } from "react";
export type ButtonTxState = "idle"|"pending"|"success"|"error";
interface DepositButtonProps { txState?: ButtonTxState; onClick?: () => void; className?: string; children?: ReactNode; "data-cy"?: string; }
export default function DepositButton({ onClick, className="", children }: DepositButtonProps) {
  return <button onClick={onClick} className={className}>{children}</button>;
}
