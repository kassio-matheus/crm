# Twenty Sales CRM

Deploy a complete single-company Twenty stack: server, background worker, PostgreSQL 16 and Redis 7.4 with persistent volumes, plus a private Railway S3 bucket for attachments. The application preserves Twenty's native interface and supports an RD Station CRM migration extension.

Only the Twenty web service is public. Database and queue connections use Railway's private network. The server runs migrations; the worker waits for server health. Independent application and database secrets must be generated afresh on each template deployment.

After deployment, create your administrator and workspace in Twenty. Install the CRM extension following the repository's `docs/RAILWAY.md`; configure SMTP, AI and RD credentials privately. The initial email driver only logs mail. Executable app code uses Twenty's LOCAL driver, so only trusted administrators should install or author code.

Plan for PostgreSQL, Redis and file backups, preserve the encryption keys, and test recovery before production use. Persistent storage does not provide high availability. Billing depends on actual Railway usage and the selected plan.

Template maintainers: before sharing, verify that bucket creation, domain/port, references, volume backup schedules and Dockerfile paths survived template generation. Replace all source-project secrets with template generators and test a fresh deployment. Never publish live credentials or CRM data.
