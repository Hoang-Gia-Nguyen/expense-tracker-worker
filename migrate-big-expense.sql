-- Migration: recreate big_expense table without Category column
-- D1/SQLite does not support ALTER TABLE DROP COLUMN, so we recreate.

CREATE TABLE IF NOT EXISTS big_expense_new (
  "Date" text,
  "Amount" integer DEFAULT 0,
  "Description" text
);

INSERT INTO big_expense_new ("Date", "Amount", "Description")
SELECT "Date", "Amount", "Description" FROM big_expense;

DROP TABLE IF EXISTS big_expense;

ALTER TABLE big_expense_new RENAME TO big_expense;

CREATE INDEX IF NOT EXISTS idx_big_expense_date ON big_expense(Date);
CREATE INDEX IF NOT EXISTS idx_big_expense_year ON big_expense(strftime('%Y', Date));
