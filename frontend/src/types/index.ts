// --- AUTHENTICATION & USERS ---
export interface Role {
  id: string;
  name: string;
  description?: string;
}

export interface User {
  id: string;
  email: string;
  username?: string;
  first_name: string;
  last_name: string;
  is_active: boolean;
  is_staff: boolean;
  role?: Role;
}

// --- CUSTOMERS ---
export interface Customer {
  id: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  email?: string;
  phone?: string;
  tax_id?: string; // RFC / Cédula / RUC
  address?: string;
  city?: string;
  customer_type?: string;
  created_at?: string;
}

// --- MENU & PRODUCTS ---
export interface Category {
  id: string;
  name: string;
  description?: string;
}

export interface Product {
  id: string;
  name: string;
  description?: string;
  price: number;
  image?: string;
  category: string; // Category ID
  is_available: boolean;
}

// --- TABLES & RESTAURANT CROQUIS ---
export interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'inactive';
  current_order_id?: string;
}

// --- ORDERS ---
export interface OrderItem {
  id: string;
  product: Product;
  quantity: number;
  price: number; // Unit price at order time
  notes?: string;
  is_paid: boolean;
}

export interface Order {
  id: string;
  order_number: string;
  table?: Table;
  customer?: Customer;
  status: 'pending' | 'preparing' | 'delivered' | 'completed' | 'cancelled';
  items: OrderItem[];
  subtotal: number;
  tax: number;
  total: number;
  amount_paid: number;
  created_at: string;
  updated_at: string;
}

// --- PAYMENTS ---
export interface PaymentMethod {
  id: string;
  name: string; // e.g. "Efectivo", "Tarjeta de Crédito"
  method_type: 'cash' | 'card' | 'transfer' | 'other';
}

export interface Payment {
  id: string;
  order: string; // Order ID
  payment_method: PaymentMethod;
  amount: number;
  transaction_id?: string;
  created_at: string;
}

// --- RESERVATIONS ---
export interface Reservation {
  id: string;
  customer: Customer;
  table?: Table;
  reservation_time: string;
  number_of_people: number;
  status: 'pending' | 'confirmed' | 'seated' | 'cancelled';
}
