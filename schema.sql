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
