import { relations } from 'drizzle-orm';
import { jsonb, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(),
  email: text('email').notNull(),
  createdAt: timestamp('created_at').defaultNow(),
});

export const appState = pgTable('app_state', {
  id: serial('id').primaryKey(),
  state: jsonb('state').notNull(),
  updatedAt: timestamp('updated_at').defaultNow(),
});
