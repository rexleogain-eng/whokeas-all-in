import {
  boolean,
  integer,
  jsonb,
  numeric,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

import { products, productVariants } from "./schema";

export const userRole = pgEnum("user_role", [
  "customer",
  "admin",
  "agent",
  "support",
]);

export const orderStatus = pgEnum("order_status", [
  "pending_payment",
  "paid",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
  "refunded",
]);

export const paymentStatus = pgEnum("payment_status", [
  "pending",
  "successful",
  "failed",
  "refunded",
]);

export const shipmentStatus = pgEnum("shipment_status", [
  "pending",
  "processing",
  "shipped",
  "in_transit",
  "delivered",
  "failed",
  "returned",
]);

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  fullName: varchar("full_name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull().unique(),
  email: varchar("email", { length: 200 }).unique(),
  passwordHash: text("password_hash"),
  role: userRole("role").default("customer").notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const addresses = pgTable("addresses", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  label: varchar("label", { length: 50 }).default("Home"),
  recipientName: varchar("recipient_name", { length: 160 }).notNull(),
  phone: varchar("phone", { length: 30 }).notNull(),
  country: varchar("country", { length: 80 })
    .default("Tanzania")
    .notNull(),
  region: varchar("region", { length: 100 }).notNull(),
  district: varchar("district", { length: 100 }),
  ward: varchar("ward", { length: 100 }),
  addressLine: text("address_line").notNull(),
  postalCode: varchar("postal_code", { length: 30 }),
  isDefault: boolean("is_default").default(false).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const orders = pgTable("orders", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderNumber: varchar("order_number", { length: 40 }).notNull().unique(),
  userId: uuid("user_id").references(() => users.id, {
    onDelete: "set null",
  }),

  customerName: varchar("customer_name", { length: 160 }).notNull(),
  customerPhone: varchar("customer_phone", { length: 30 }).notNull(),
  customerEmail: varchar("customer_email", { length: 200 }),

  status: orderStatus("status").default("pending_payment").notNull(),
  currency: varchar("currency", { length: 3 }).default("TZS").notNull(),

  subtotal: numeric("subtotal", { precision: 14, scale: 2 }).notNull(),
  shippingFee: numeric("shipping_fee", {
    precision: 14,
    scale: 2,
  }).default("0").notNull(),
  discountAmount: numeric("discount_amount", {
    precision: 14,
    scale: 2,
  }).default("0").notNull(),
  total: numeric("total", { precision: 14, scale: 2 }).notNull(),
  supplierCostTotal: numeric("supplier_cost_total", {
    precision: 14,
    scale: 2,
  }).default("0").notNull(),

  shippingAddress: jsonb("shipping_address")
    .$type<{
      recipientName: string;
      phone: string;
      country: string;
      countryCode?: string;
      stateProvince?: string;
      city?: string;
      region: string;
      district?: string;
      ward?: string;
      postalCode?: string;
      addressLine: string;
    }>()
    .notNull(),

  source: varchar("source", { length: 50 }).default("website").notNull(),
  customerNotes: text("customer_notes"),
  adminNotes: text("admin_notes"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  productId: uuid("product_id").references(() => products.id, {
    onDelete: "set null",
  }),
  variantId: uuid("variant_id").references(() => productVariants.id, {
    onDelete: "set null",
  }),

  productName: varchar("product_name", { length: 180 }).notNull(),
  variantName: varchar("variant_name", { length: 150 }),
  sku: varchar("sku", { length: 100 }),
  quantity: integer("quantity").notNull(),
  unitPrice: numeric("unit_price", {
    precision: 14,
    scale: 2,
  }).notNull(),
  unitCost: numeric("unit_cost", {
    precision: 14,
    scale: 2,
  }).default("0").notNull(),
  lineTotal: numeric("line_total", {
    precision: 14,
    scale: 2,
  }).notNull(),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  provider: varchar("provider", { length: 60 }).notNull(),
  providerReference: varchar("provider_reference", {
    length: 180,
  }).unique(),

  status: paymentStatus("status").default("pending").notNull(),
  amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  fee: numeric("fee", { precision: 14, scale: 2 }).default("0").notNull(),
  currency: varchar("currency", { length: 3 }).default("TZS").notNull(),

  rawResponse: jsonb("raw_response"),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export const shipments = pgTable("shipments", {
  id: uuid("id").defaultRandom().primaryKey(),
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  supplierType: varchar("supplier_type", { length: 60 }),
  supplierOrderId: varchar("supplier_order_id", { length: 180 }),
  carrier: varchar("carrier", { length: 100 }),
  trackingNumber: varchar("tracking_number", { length: 180 }),
  trackingUrl: text("tracking_url"),

  status: shipmentStatus("status").default("pending").notNull(),
  shippedAt: timestamp("shipped_at", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});
