-- Migration: add big_expense table
CREATE TABLE IF NOT EXISTS [big_expense] ("Date" text,"Amount" integer DEFAULT 0,"Description" text,"Category" text DEFAULT 'Uncategorized');
CREATE INDEX IF NOT EXISTS idx_big_expense_date ON big_expense(Date);
CREATE INDEX IF NOT EXISTS idx_big_expense_category ON big_expense(Category);
CREATE INDEX IF NOT EXISTS idx_big_expense_year ON big_expense(strftime('%Y', Date));
