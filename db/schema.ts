import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const businesses = sqliteTable(
  "businesses",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    businessName: text("business_name").notNull().default(""),
    ownerName: text("owner_name").notNull().default(""),
    businessNumber: text("business_number"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    taxYear: integer("tax_year"),
    exemptDealerCeilingAgorot: integer("exempt_dealer_ceiling_agorot"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    uniqueIndex("idx_businesses_owner").on(table.ownerUserId),
  ],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    name: text("name").notNull(),
    businessNumber: text("business_number"),
    identityNumber: text("identity_number"),
    email: text("email"),
    phone: text("phone"),
    address: text("address"),
    notes: text("notes"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
    deletedAt: text("deleted_at"),
  },
  (table) => [
    index("idx_clients_owner_name").on(table.ownerUserId, table.name),
    index("idx_clients_owner_active").on(table.ownerUserId, table.deletedAt),
  ],
);

export const businessDocuments = sqliteTable(
  "business_documents",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    clientId: text("client_id").references(() => clients.id),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerCrn: text("customer_crn"),
    documentType: text("document_type").notNull(),
    amountAgorot: integer("amount_agorot").notNull(),
    currency: text("currency").notNull().default("ILS"),
    documentDate: text("document_date").notNull(),
    dueDate: text("due_date"),
    paymentType: integer("payment_type"),
    paymentDate: text("payment_date"),
    transactionType: text("transaction_type"),
    paymentDetailsJson: text("payment_details_json").notNull().default("{}"),
    description: text("description").notNull().default(""),
    notes: text("notes"),
    status: text("status").notNull(),
    ezcountDocNumber: text("ezcount_doc_number"),
    ezcountDocUuid: text("ezcount_doc_uuid"),
    pdfLink: text("pdf_link"),
    errorMessage: text("error_message"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_documents_owner_created").on(
      table.ownerUserId,
      table.createdAt,
    ),
    index("idx_documents_owner_status").on(table.ownerUserId, table.status),
    index("idx_documents_owner_client").on(table.ownerUserId, table.clientId),
  ],
);

export const payments = sqliteTable(
  "payments",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    documentId: text("document_id")
      .notNull()
      .references(() => businessDocuments.id),
    paymentDate: text("payment_date").notNull(),
    amountAgorot: integer("amount_agorot").notNull(),
    paymentMethod: text("payment_method").notNull(),
    transactionType: text("transaction_type").notNull(),
    bank: text("bank"),
    branch: text("branch"),
    account: text("account"),
    reference: text("reference"),
    notes: text("notes"),
    cardType: text("card_type"),
    cardLastFour: text("card_last_four"),
    createdAt: text("created_at").notNull(),
    updatedAt: text("updated_at").notNull(),
  },
  (table) => [
    index("idx_payments_owner_document").on(
      table.ownerUserId,
      table.documentId,
    ),
    index("idx_payments_owner_date").on(table.ownerUserId, table.paymentDate),
  ],
);

export const auditLogs = sqliteTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id"),
    outcome: text("outcome").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    createdAt: text("created_at").notNull(),
  },
  (table) => [
    index("idx_audit_owner_created").on(table.ownerUserId, table.createdAt),
  ],
);
