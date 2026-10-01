-- Runs once when the local PostgreSQL container is first created.
-- project_db is created by POSTGRES_DB; this adds the separate auth database.
CREATE DATABASE auth_db;
