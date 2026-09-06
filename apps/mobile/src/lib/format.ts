import {formatCurrency, formatDate, formatDateTime} from '@munim/core';

export function money(value: number): string {
  // "INR 1,234.00" — always a space between the currency code and the amount.
  return formatCurrency(value, 'INR ');
}

export {formatDate, formatDateTime};
