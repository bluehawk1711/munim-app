// Convert number to words in Indian numbering system
const ones = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const tens = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

function convertToWords(num: number): string {
  if (num === 0) return "Zero";
  if (num < 0) return "Minus " + convertToWords(Math.abs(num));

  let words = "";

  if (Math.floor(num / 10000000) > 0) {
    words += convertToWords(Math.floor(num / 10000000)) + " Crore ";
    num %= 10000000;
  }

  if (Math.floor(num / 100000) > 0) {
    words += convertToWords(Math.floor(num / 100000)) + " Lakh ";
    num %= 100000;
  }

  if (Math.floor(num / 1000) > 0) {
    words += convertToWords(Math.floor(num / 1000)) + " Thousand ";
    num %= 1000;
  }

  if (Math.floor(num / 100) > 0) {
    words += convertToWords(Math.floor(num / 100)) + " Hundred ";
    num %= 100;
  }

  if (num > 0) {
    if (num < 20) {
      words += ones[num];
    } else {
      words += tens[Math.floor(num / 10)];
      if (num % 10 > 0) {
        words += " " + ones[num % 10];
      }
    }
  }

  return words.trim();
}

export function numberToWords(num: number): string {
  if (num === 0) return "Zero Rupees Only";
  const words = convertToWords(num);
  return `${words} Rupees Only`;
}

export function formatCurrency(num: number): string {
  return new Intl.NumberFormat("en-IN").format(num);
}
