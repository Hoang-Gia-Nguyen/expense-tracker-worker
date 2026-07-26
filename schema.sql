PRAGMA defer_foreign_keys=TRUE;
CREATE TABLE [expense] ("Date" text,"Amount" integer DEFAULT 0,"Description" text,"Category" text);
CREATE INDEX idx_expense_date ON expense(Date);
CREATE INDEX idx_expense_category ON expense(Category);
CREATE INDEX idx_expense_y_m
ON expense (strftime('%Y', Date), strftime('%m', Date));
CREATE VIEW v_expense_clean AS
SELECT
  rowid                           AS expense_id,
  date(Date)                      AS dt,                -- expects ISO-8601 'YYYY-MM-DD'
  strftime('%Y-%m', Date)         AS year_month,
  CAST(Amount AS INTEGER)         AS amount_vnd_pos,    -- treat stored value as positive spend
  -CAST(Amount AS INTEGER)        AS amount_vnd,        -- same value but negative (handy for some calcs)
  Description,
  TRIM(Category)                  AS category
FROM expense;
CREATE VIEW v_monthly_category_spend AS
SELECT
  year_month,
  category,
  SUM(amount_vnd_pos) AS spend_vnd
FROM v_expense_clean
GROUP BY year_month, category;

-- Big expense table (large yearly expenses, excluded from monthly stats)
CREATE TABLE IF NOT EXISTS [big_expense] ("Date" text,"Amount" integer DEFAULT 0,"Description" text);
CREATE INDEX idx_big_expense_date ON big_expense(Date);
CREATE INDEX idx_big_expense_year ON big_expense(strftime('%Y', Date));

-- Investment portfolio table
CREATE TABLE IF NOT EXISTS [investment] (
  "id" INTEGER PRIMARY KEY AUTOINCREMENT,
  "Date" TEXT NOT NULL,
  "Type" TEXT NOT NULL CHECK(Type IN ('BUY', 'SELL')),
  "ProductName" TEXT NOT NULL DEFAULT 'Gold',
  "Quantity" REAL NOT NULL CHECK(Quantity > 0),
  "Unit" TEXT NOT NULL DEFAULT 'unit',
  "UnitPrice" INTEGER NOT NULL CHECK(UnitPrice > 0),
  "TotalValue" INTEGER NOT NULL CHECK(TotalValue > 0),
  "Notes" TEXT DEFAULT '',
  "CreatedAt" TEXT DEFAULT (datetime('now'))
);
CREATE INDEX idx_investment_date ON investment(Date);
CREATE INDEX idx_investment_product ON investment(ProductName);
