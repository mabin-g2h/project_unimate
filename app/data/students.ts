export interface Student {
  n: string;
  g: "M" | "F";
  u: string;
  langs: string[];
  course: string;
  date: string;
  email: string;
  phone: string | null;
}

export const ME_DATE = "8 Feb 2026";

export const uniStudents: Student[] = [
  { n: "Aarav Sharma", g: "M", u: "University of Melbourne", langs: ["Hindi", "English"], course: "MSc Computer Science", date: "8 Feb 2026", email: "aarav.sharma27@gmail.com", phone: "+61 412 668 204" },
  { n: "Diya Patel", g: "F", u: "University of Melbourne", langs: ["Gujarati", "Hindi", "English"], course: "MBA", date: "5 Feb 2026", email: "diya.patel@outlook.com", phone: null },
  { n: "Rohan Mehta", g: "M", u: "University of Melbourne", langs: ["Hindi", "Marathi", "English"], course: "MSc Data Science", date: "8 Feb 2026", email: "rohan.mehta.dev@gmail.com", phone: "+61 423 119 870" },
  { n: "Ananya Iyer", g: "F", u: "University of Melbourne", langs: ["Tamil", "English"], course: "MSc Information Technology", date: "2 Feb 2026", email: "ananya.iyer@gmail.com", phone: null },
  { n: "Karan Singh", g: "M", u: "University of Melbourne", langs: ["Punjabi", "Hindi", "English"], course: "Master of Engineering", date: "9 Feb 2026", email: "karan.singh92@gmail.com", phone: "+61 404 552 318" },
  { n: "Sneha Reddy", g: "F", u: "University of Melbourne", langs: ["Telugu", "English"], course: "Master of Public Health", date: "7 Feb 2026", email: "sneha.reddy@outlook.com", phone: null },
  { n: "Vivaan Nair", g: "M", u: "University of Melbourne", langs: ["Malayalam", "English"], course: "MSc Finance", date: "1 Feb 2026", email: "vivaan.nair@gmail.com", phone: null },
  { n: "Isha Gupta", g: "F", u: "University of Melbourne", langs: ["Hindi", "English"], course: "Master of Marketing", date: "8 Feb 2026", email: "isha.gupta11@gmail.com", phone: "+61 431 207 996" },
  { n: "Aditya Rao", g: "M", u: "University of Melbourne", langs: ["Kannada", "English"], course: "MSc Computer Science", date: "6 Feb 2026", email: "aditya.rao@gmail.com", phone: null },
  { n: "Meera Krishnan", g: "F", u: "University of Melbourne", langs: ["Tamil", "Malayalam", "English"], course: "MSc Data Science", date: "8 Feb 2026", email: "meera.krishnan@outlook.com", phone: "+61 478 330 145" },
  { n: "Arjun Desai", g: "M", u: "University of Melbourne", langs: ["Gujarati", "Hindi", "English"], course: "MBA", date: "3 Feb 2026", email: "arjun.desai@gmail.com", phone: null },
  { n: "Priya Menon", g: "F", u: "University of Melbourne", langs: ["Malayalam", "English"], course: "Master of Architecture", date: "9 Feb 2026", email: "priya.menon@gmail.com", phone: null },
  { n: "Kabir Khanna", g: "M", u: "University of Melbourne", langs: ["Hindi", "Punjabi", "English"], course: "Master of Engineering", date: "8 Feb 2026", email: "kabir.khanna@gmail.com", phone: "+61 415 884 622" },
  { n: "Riya Banerjee", g: "F", u: "University of Melbourne", langs: ["Bengali", "Hindi", "English"], course: "MSc Information Technology", date: "4 Feb 2026", email: "riya.banerjee@outlook.com", phone: null },
  { n: "Dhruv Joshi", g: "M", u: "University of Melbourne", langs: ["Marathi", "Hindi", "English"], course: "MSc Finance", date: "7 Feb 2026", email: "dhruv.joshi@gmail.com", phone: null },
  { n: "Tara Pillai", g: "F", u: "University of Melbourne", langs: ["Tamil", "English"], course: "Master of Public Health", date: "8 Feb 2026", email: "tara.pillai@gmail.com", phone: "+61 422 760 513" },
  { n: "Yash Agarwal", g: "M", u: "University of Melbourne", langs: ["Hindi", "English"], course: "MBA", date: "2 Feb 2026", email: "yash.agarwal@gmail.com", phone: null },
  { n: "Nisha Verma", g: "F", u: "University of Melbourne", langs: ["Hindi", "English"], course: "Master of Marketing", date: "9 Feb 2026", email: "nisha.verma@outlook.com", phone: null },
  { n: "Aryan Kapoor", g: "M", u: "University of Melbourne", langs: ["Hindi", "Punjabi", "English"], course: "MSc Computer Science", date: "8 Feb 2026", email: "aryan.kapoor@gmail.com", phone: "+61 408 915 447" },
  { n: "Saanvi Bhat", g: "F", u: "University of Melbourne", langs: ["Kannada", "English"], course: "MSc Data Science", date: "5 Feb 2026", email: "saanvi.bhat@gmail.com", phone: null },
];

export const cityStudents: Student[] = [
  { n: "Ishaan Choudhary", g: "M", u: "RMIT University", langs: ["Hindi", "English"], course: "Master of IT", date: "8 Feb 2026", email: "ishaan.choudhary@gmail.com", phone: "+61 451 203 778" },
  { n: "Kavya Subramanian", g: "F", u: "Monash University", langs: ["Tamil", "English"], course: "Master of Business", date: "6 Feb 2026", email: "kavya.s@outlook.com", phone: null },
  { n: "Aniket Kulkarni", g: "M", u: "Deakin University", langs: ["Marathi", "Hindi", "English"], course: "Master of Engineering", date: "3 Feb 2026", email: "aniket.kulkarni@gmail.com", phone: null },
  { n: "Pooja Nanda", g: "F", u: "La Trobe University", langs: ["Hindi", "Punjabi", "English"], course: "Master of Public Health", date: "8 Feb 2026", email: "pooja.nanda@gmail.com", phone: "+61 426 590 134" },
  { n: "Rahul Pillai", g: "M", u: "Swinburne University", langs: ["Malayalam", "English"], course: "Master of Design", date: "9 Feb 2026", email: "rahul.pillai@outlook.com", phone: null },
  { n: "Simran Gill", g: "F", u: "RMIT University", langs: ["Punjabi", "Hindi", "English"], course: "Master of Marketing", date: "7 Feb 2026", email: "simran.gill@gmail.com", phone: "+61 433 871 209" },
  { n: "Neha Saxena", g: "F", u: "Monash University", langs: ["Hindi", "English"], course: "Master of Data Science", date: "5 Feb 2026", email: "neha.saxena@gmail.com", phone: null },
  { n: "Varun Shetty", g: "M", u: "Victoria University", langs: ["Kannada", "English"], course: "Master of Finance", date: "2 Feb 2026", email: "varun.shetty@gmail.com", phone: null },
  { n: "Aditi Chauhan", g: "F", u: "Deakin University", langs: ["Hindi", "English"], course: "Master of IT", date: "8 Feb 2026", email: "aditi.chauhan@gmail.com", phone: "+61 410 446 925" },
  { n: "Manav Bhatia", g: "M", u: "RMIT University", langs: ["Hindi", "Punjabi", "English"], course: "Master of Engineering", date: "4 Feb 2026", email: "manav.bhatia@outlook.com", phone: null },
];
