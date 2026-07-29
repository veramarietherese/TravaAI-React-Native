export function formatCurrency(amount: number, currency = "PHP"): string {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency
  }).format(amount);
}
