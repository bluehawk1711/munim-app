export interface JobLetterData {
  companyName: string;
  companyAddress: string;
  companyEmail: string;
  employeeName: string;
  employeeAddress: string;
  position: string;
  joiningDate: string;
  monthlySalary: number;
  workingHoursDescription: string;
  workingHoursFrom: string;
  workingHoursTo: string;
  timeFormat: "AM" | "PM";
  weeklyOff1: string;
  weeklyOff2: string;
  probationMonths: number;
  additionalTasks: string;
}

export interface BillItem {
  productName: string;
  description: string;
  quantity: number;
  price: number;
}

export interface BillDetails {
  billNo: string;
  date: string;
  customerName: string;
  customerAddress: string;
  customerEmail?: string;
  customerPhone?: string;
  items: BillItem[];
  deliveryCharge: number;
}

export interface BillData extends BillDetails {
  shopDetails: {
    name: string;
    address: string;
    phones: string[];
    email: string;
  };
  settings: {
    twoInOne: boolean;
    template: "jewellery" | "ecommerce";
    mode: "duplicate" | "distinct";
    classicColor: "red" | "yellow";
  };
  secondBill?: BillDetails;
}

export const defaultFormData: JobLetterData = {
  companyName: "Jewellery Wala",
  companyAddress: "Jhalamand Circle, Jodhpur",
  companyEmail: "jewellerywalaonline@gmail.com",
  employeeName: "",
  employeeAddress: "",
  position: "",
  joiningDate: "",
  monthlySalary: 0,
  workingHoursDescription: "",
  workingHoursFrom: "09:00 AM",
  workingHoursTo: "06:00 PM",
  timeFormat: "AM",
  weeklyOff1: "Sunday",
  weeklyOff2: "",
  probationMonths: 3,
  additionalTasks: "",
};

const defaultItems: BillItem[] = [
  { productName: "", description: "", quantity: 1, price: 0 },
];

export const defaultBillData: BillData = {
  billNo: "1900",
  date: new Date().toISOString().split("T")[0],
  customerName: "",
  customerAddress: "",
  customerEmail: "",
  customerPhone: "",
  items: defaultItems,
  deliveryCharge: 0,
  shopDetails: {
    name: "JEWELLERY WALA",
    address: "Jhalamand Circle, Jodhpur",
    phones: ["8094681299", "9460343208"],
    email: "jewellerywalaonline@gmail.com",
  },
  settings: {
    twoInOne: false,
    template: "jewellery",
    mode: "duplicate",
    classicColor: "red",
  },
  secondBill: {
    billNo: "1901",
    date: new Date().toISOString().split("T")[0],
    customerName: "",
    customerAddress: "",
    customerEmail: "",
    customerPhone: "",
    items: [{ productName: "", description: "", quantity: 1, price: 0 }],
    deliveryCharge: 0,
  },
};
