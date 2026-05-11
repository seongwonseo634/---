import { Timestamp } from "firebase/firestore";

export type TransactionType = "income" | "expense";

export interface UserProfile {
  id: string;
  email: string;
  name: string;
  photoURL?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PersonalTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  paymentMethod?: string;
  receiptUrl?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  ownerId: string;
  memberIds: string[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupMember {
  userId: string;
  role: "admin" | "member";
  joinedAt: Timestamp;
}

export interface GroupTransaction {
  id: string;
  amount: number;
  type: TransactionType;
  category: string;
  date: string;
  description: string;
  paymentMethod?: string;
  receiptUrl?: string;
  createdBy: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface GroupDue {
  id: string;
  amount: number;
  title: string;
  dueDate: string; // YYYY-MM-DD
  createdAt: Timestamp;
  createdBy: string;
}

export interface GroupDuePayment {
  userId: string;
  isPaid: boolean;
  amountPaid?: number;
  paidAt?: Timestamp;
}
