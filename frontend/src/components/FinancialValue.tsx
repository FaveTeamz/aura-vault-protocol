"use client";
interface FinancialValueProps { value: string; sentiment?: "positive"|"negative"|"warning"|"neutral"; className?: string; }
export function FinancialValue({ value, className="" }: FinancialValueProps) { return <span className={className}>{value}</span>; }
