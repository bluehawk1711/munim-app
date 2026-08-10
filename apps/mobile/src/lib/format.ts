import {formatCurrency, formatDate, formatDateTime} from '@munim/core';

export function money(value: number): string {
  return formatCurrency(value, 'INR');
}

export {formatDate, formatDateTime};
