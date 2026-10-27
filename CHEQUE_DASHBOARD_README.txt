Upcoming cheque payments dashboard update

Merge the src/ folder into the corresponding existing project. Apply BOTH the
frontend and backend archives and rebuild/restart them using your usual commands.
No database migration or ETL refresh is required.

Behavior:
- The dashboard groups CHK transactions due from tomorrow onward by due date.
- Counts and sums use live transactions, independent of dashboard date filters.
- Dates display in the Persian calendar.
- Each date links to its matching cheque transaction list; a link opens all future cheques.
- Server-side paymentType filtering is retained across transaction-list pages.
- Includes every transaction type paid by cheque. The current model has no cleared status.

Verification: filter URL round-trip, pagination parameters, API forwarding,
default/reset behavior, date boundary, cash exclusion, grouping and empty results
were checked. List/count query predicates were compared for equality.
Full application build and SQL Server integration were not run: the uploads
contain only src folders, without package.json, Maven/Gradle build files or a database.

Changed files in this archive:
- src/api/dashboardApi.js
- src/api/transactionsApi.js
- src/components/transactions/TransactionsListPage.jsx
- src/pages/dashboard/DashboardPage.jsx
