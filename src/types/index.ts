export type Role = "owner" | "staff";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: Role;
  created_at: string;
}

export interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost_price: number;
  stock_quantity: number;
  image_url: string | null;
  is_deleted: boolean;
  created_at: string;
}
export interface Sale {
  id: string;
  recorded_by: string;
  total_amount: number;
  payment_method: string;
  notes: string | null;
  sale_date: string;
  created_at: string;
}

export interface SaleItem {
  id: string;
  sale_id: string;
  product_id: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  product?: Product;
}

export interface CartItem {
  product: Product;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}
