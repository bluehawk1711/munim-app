// Converts numbers to words using the Indian numbering system (lakh/crore).
// Ported from job-and-bill-gen so all three apps share one implementation.
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
function convertToWords(num) {
    if (num === 0)
        return "Zero";
    if (num < 0)
        return "Minus " + convertToWords(Math.abs(num));
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
        }
        else {
            words += tens[Math.floor(num / 10)];
            if (num % 10 > 0) {
                words += " " + ones[num % 10];
            }
        }
    }
    return words.trim();
}
export function numberToWords(num) {
    if (num === 0)
        return "Zero Rupees Only";
    const words = convertToWords(num);
    return `${words} Rupees Only`;
}
/** Full amount-in-words including paise, e.g. "One Thousand Two Hundred Thirty Four Rupees and Fifty Six Paise Only". */
export function amountInWords(amount) {
    const rupees = Math.floor(Math.abs(amount));
    const paise = Math.round((Math.abs(amount) - rupees) * 100);
    let out = convertToWords(rupees);
    if (paise > 0) {
        out += ` Rupees and ${convertToWords(paise)} Paise`;
    }
    else {
        out += " Rupees";
    }
    return `${out} Only`;
}
//# sourceMappingURL=numberToWords.js.map