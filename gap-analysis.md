

Missing or Unclear items:

To close the main gaps, I need your decisions on these points. Brief answers are fine; “use sensible defaults” works where you don’t have a preference.

1. Users and permissions: Who will use the app, and what can each role do? For example: upload feeds, search, edit prices, manage users.
A: Consider store manager / store admin
2. CSV imports: Should an upload add records, replace existing records, or support both? How should duplicates, invalid rows, and partially valid files be handled? Any file-size or row-count limit?
A: Append record and archive the previous prices changes, report the duplicate or invalid rows once the price updates done, Support partial valid upload with 5 mb max upload size limit but configurable in dotenv
3. Search and editing: Which fields must be searchable or filterable? Should results be paginated or sortable? Can users edit all fields, or only price? Should edits take effect immediately? Basic search, filter support with paginated. Edit price only field and price edit must be scheduled / effective date and update older price with effective till date when new price uploaded.
4. Change history: Must the app retain old values, who changed them, and when? Should users be able to undo or review changes?
A: Yes
5. Countries and pricing: Which countries are in scope? Should each record include currency? What date format and timezone should uploads use?
A: Take from the user account profile settings and if missing use the system default settings values.
6. Scale and performance: How many pricing records, uploads, and simultaneous users should the system support? What response time is acceptable for search and upload?
A: Consider the queueing the job and maintain the status in database. Use nodejs child workers to perform the asynchronus updates.
7. Reliability and security: Any required availability or recovery targets? Are there compliance, data-residency, or retention requirements? Should login use the stack you mentioned, and is role-based access required?
A: Must support RBAC
8. Technology and delivery: Is the previously listed stack mandatory, or may the implementation choose? What should the deliverables include beyond source code: runnable app, diagrams, setup instructions, tests, or deployment configuration?
A: First preference

----------------------------------------------------------
Your answers establish a useful baseline for imports, price history, asynchronous processing, RBAC, and the preferred stack (requirement.md:24). A few decisions still need definition to avoid implementation assumptions:

1. Role boundaries: Does a store manager see and edit only their own store’s prices? Can a store admin access all stores and manage users?
A: Yes
2. Duplicate rules: What makes a row a duplicate: same store and SKU, same effective date too, or an exact repeated row? Should a duplicate be skipped, rejected, or treated as an update?
A: a row duplicate: same store and SKU, same effective date. Skipped and in final report share the skipped updates list
3. Price scheduling: Is the CSV Date the price’s effective-from date? How should overlapping or backdated price periods be handled? Should a scheduled price be editable or cancellable before it takes effect?
A: Effective date (must be future date) missing in CSV then consider future of the date uploaded. Scheduled price can be edit and cancel.
4. Country settings: Account profile settings can determine display format and timezone, but the store or product should determine currency. Can one upload contain stores from different countries?
A: Take record from store account settings. Consider single store update when store manager login and store admin. Currently not supporting CSV multi store and multi country upload
5. Import completion: Should valid rows apply even when other rows fail? What should the job report: counts, row numbers, error reasons, and a downloadable error file? Should users be able to retry failed rows?
A: Yes
6. History and undo: How long is history retained, who can view it, and does “undo” mean restoring a previous price or creating a new compensating change?
A: Keep history forever util delete manaual and undo mean creating a new conpensating change
7. Scale and service targets: A queue and worker approach describes processing, but not expected volume or performance. Please specify approximate records/uploads per day, concurrent users, and acceptable search/import times.
A: consider minimal resource use and high performing and scalable system
8. Search and deliverables: Name the required filters (likely store, SKU, product name, and effective-date range). Also clarify whether “First preference” means the listed stack is preferred but alternatives are acceptable, and which deliverables are expected beyond source code.
A: Use basic defaults

The most consequential open items are role boundaries, duplicate identity, and effective-date conflict rules. The rest could use documented defaults if you’d like to keep the brief lean.

----------------------------------------------------------
Your answers resolve most of the earlier gaps and give a workable direction. A few points still need precision before they can be implemented consistently (gap-analysis.md:25):

1. “Yes” on roles is ambiguous. I’d record this explicitly: store managers can view and change prices for their assigned store only; store admins can access all stores and manage users. For admin uploads, specify that they select one store per upload.
A: Yes
2. Default effective date needs an exact rule. “Future of the date uploaded” could mean tomorrow, the next business day, or another default. Define it using the store’s timezone, and state whether same-day effective dates are ever allowed.
A: Tomorrow
3. Price-period rules are still open. Specify what happens when a newly scheduled price overlaps another scheduled price, or is entered before the current price ends. The system should define the prior price’s effective-through date consistently.
A: A price upload will take effect over the previous prices even overlapping and scheduled
4. Import reporting needs confirmation. “Yes” appears to accept counts, row numbers, reasons, an error file, and retries. Confirm that interpretation. Also define whether retries process only failed rows, and how duplicate rows appear in the final skipped list.
A: Create price upload job and keep track of success, failed, skipped, errors and provide the output with job completion list of messages with count and downloadable csv for verfication or see the issue in case of error or failed
5. “Basic defaults” should be made explicit. A reasonable default is search by store, SKU, product name, and effective-date range, with pagination and sorting. Confirm this or document it as an assumption.
A: Search by product name, SKU, price and default name sorting
6. Scale and reliability remain unmeasurable. “Minimal resource use, high performing, and scalable” is a design goal, not a testable target. For an initial implementation, document assumed volumes and performance targets; availability, backup, and recovery targets are also still unspecified.
A: Provide your question with specified list
7. Retention and stack need a final interpretation. “Keep history forever until manually deleted” should specify who can delete it and whether deletion is audited. “First preference” likely means the listed stack is preferred; state that explicitly, and clarify which deliverables are expected.
A: Only store admin can delete price history

The cleanest next step is to document sensible defaults for the remaining items, especially date handling, overlapping schedules, retries, and measurable initial scale.

----------------------------------------------------------
Your answers clarify the roles, imports, scheduling, search, and history policy. For item 6, here’s a concrete list of targets to confirm or adjust. These are proposed starting assumptions, not requirements you’ve already specified:

Data volume: 3,000 stores; assume up to 10,000 active SKUs per store (30 million current prices). Price history grows separately and is retained until an authorized admin deletes it.
Usage: Up to 100 concurrent users and 10 imports processing at once; additional imports wait in the queue.
Import size and speed: Keep the 5 MB configurable limit. Assume up to 50,000 rows per file and completion within 2 minutes for a valid 5 MB file.
Search speed: First page of results returns within 2 seconds for 95% of searches.
Availability: 99.5% monthly availability.
Recovery: Daily backups, 30-day backup retention, recovery point within 24 hours, and service restoration within 8 hours.
Two details also remain worth pinning down:

1. Overlapping scheduled prices: Should a new price cancel all later scheduled prices for the same store and SKU, or should later schedules remain and take effect after the new price? A common default is to end the previous price the day before the new effective date and preserve later scheduled prices.
A: Yes. End the previous price the day before the new effective date and preserve later scheduled prices.
2. Import retries: Should retrying a job process only failed rows? I’d treat duplicates as skipped, report row number and reason, and include those rows in the downloadable results CSV.
A: Yes. Treat duplicates as skipped, report row number and reason, and include those rows in the downloadable results CSV.
3. The default date rule can be recorded as: if the CSV has no effective date, use tomorrow in the store’s timezone. The file’s “tomorrow” answer doesn’t explicitly state the timezone, so this makes that assumption visible.
A: Agree
