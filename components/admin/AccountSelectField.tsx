import type { PaymentAccountOption } from "@/lib/payment-accounts";

type Props = {
  accounts: PaymentAccountOption[];
  name?: string;
  label: string;
  hint?: string;
  defaultValue?: string;
  required?: boolean;
  allowEmpty?: boolean;
  emptyLabel?: string;
  className?: string;
};

export default function AccountSelectField({
  accounts,
  name = "account_id",
  label,
  hint,
  defaultValue = "",
  required = false,
  allowEmpty = true,
  emptyLabel = "Select account",
  className = "w-full rounded-xl border border-slate-200 px-4 py-3 text-sm",
}: Props) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-semibold text-slate-700">
        {label}
      </span>
      <select
        name={name}
        required={required && !allowEmpty}
        defaultValue={defaultValue}
        className={className}
      >
        {allowEmpty ? <option value="">{emptyLabel}</option> : null}
        {accounts.map((account) => (
          <option key={account.id} value={account.id}>
            {account.label}
          </option>
        ))}
      </select>
      {hint ? (
        <span className="mt-1 block text-xs text-slate-500">{hint}</span>
      ) : null}
    </label>
  );
}
