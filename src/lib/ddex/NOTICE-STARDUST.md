# Stardust Distro — extracted DDEX layer (MIT)

Nexo integrates **DDEX generation + delivery patterns** from
[Stardust Distro](https://github.com/daddykev/stardust-distro) (`@stardust-distro/cli`),
MIT License, Copyright (c) 2025 Kevin Marques Moo.

This is **not** a Stardust app install and **not** a Firebase migration.

Reused internally (TypeScript, Supabase-backed):

- Delivery protocol adapters (FTP / SFTP / S3 / REST / Azure / local)
- Package hashing (SHA-256 / MD5)
- Queue retries with exponential backoff and idempotency keys
- Message subtypes Initial / Update / Takedown
- Per-target ERN 4.2 / 3.8.2 XML shape adapted to Nexo’s mapped model

**Not reused:**

- Firebase / Firestore / Cloud Functions
- Vue catalog UI, CLI `create` scaffold, test DSP credentials
- Stardust ERN builders that fabricate `Untitled` / `Unknown Artist` / current-year C/P lines

Primary ERN 4.3.2 XML remains Nexo’s existing XSD-backed generator in this directory.
