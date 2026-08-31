import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const businessDocuments = sqliteTable(
  "business_documents",
  {
    id: text("id").primaryKey(),
    ownerUserId: text("owner_user_id").notNull(),
    customerName: text("customer_name").notNull(),
    customerEmail: text("customer_email"),
    customerPhone: text("customer_phone"),
    customerCrn: text("customer_crn"),
    documentType: text("document_type").notNull(),
    amountAgorot: integer("amount_agorot").notNull(),
    documentDate: text("document_date").notNull(),
    dueDate: text("due_date"),
    paymentType: integer("payment_type"),
    paymentDetailsJson: text("payment_details_json").notNull().default("{}"),
    description: text("description").notNull().default(""),
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
  ],
);
