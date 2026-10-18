"""Apply only the two additive module migrations to an explicit SQLite database.

Run on the server after preparing the release. Existing unrelated FK errors are
recorded, and must remain identical. Never invokes global migrate deploy/db push.
"""
import datetime
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import sys
import uuid

def additive_sql(name, sql):
    if name == "20261016120000_video_factory_multimedia":
        # Prisma generated table rebuilds for added columns. Use equivalent
        # additive DDL on the live database, preserving existing tables/indexes.
        start = sql.index("-- RedefineTables")
        end = sql.index("-- CreateIndex", start)
        additions = {"VideoFactoryProject": ["research TEXT NOT NULL DEFAULT '[]'", "publishing TEXT NOT NULL DEFAULT '{}'", "planning TEXT NOT NULL DEFAULT '{}'", "deletedAt DATETIME"], "VideoFactoryJob": ["priority INTEGER NOT NULL DEFAULT 0", "nextAttemptAt DATETIME", "attempts INTEGER NOT NULL DEFAULT 0", "actualCostUsd REAL", "storageBytes REAL NOT NULL DEFAULT 0", "sourceJobId TEXT", "plan TEXT NOT NULL DEFAULT '{}'"]}
        ddl = "\n".join('ALTER TABLE "' + table + '" ADD COLUMN ' + column + ';' for table, columns in additions.items() for column in columns)
        sql = sql[:start] + ddl + "\n\n" + sql[end:]

    return sql


root, database, backup_directory = map(lambda value: Path(value).resolve(), sys.argv[1:4])
assert database.is_file() and root.is_dir()
connection = sqlite3.connect(database, timeout=30)
connection.execute("PRAGMA foreign_keys=ON")
print("Checking database baseline", flush=True)
baseline = set(connection.execute("PRAGMA foreign_key_check").fetchall())
assert all(not row[0].startswith("VideoFactory") for row in baseline)
assert connection.execute("select 1 from sqlite_master where name='AuditLog'").fetchone()


def balances():
    return {table: connection.execute("select count(*),coalesce(sum(credits),0) from " + table).fetchone() for table in ["User", "Team"]}


print("Baseline checked", flush=True)
before = balances()
backup_directory.mkdir(parents=True, exist_ok=True)
stamp = datetime.datetime.now(datetime.timezone.utc).strftime("%Y%m%dT%H%M%SZ")
backup = backup_directory / ("pre-video-factory-" + stamp + ".db")
with sqlite3.connect(backup) as destination:
    connection.backup(destination)
os.chmod(backup, 0o600)
print("Consistent backup completed", flush=True)
for name in ["20261016090000_video_factory", "20261016120000_video_factory_multimedia"]:
    print("Inspecting " + name, flush=True)
    applied = connection.execute("select finished_at from _prisma_migrations where migration_name=? and rolled_back_at is null", (name,)).fetchone()
    if applied:
        assert applied[0], "Incomplete migration requires inspection"
        continue
    print("Reading reviewed SQL", flush=True)
    content = (root / "prisma/migrations" / name / "migration.sql").read_bytes()
    sql = content.decode("utf-8")
    sql = additive_sql(name, sql)
    assert not re.search(r"(?:^|;)\s*(DROP|DELETE|TRUNCATE|UPDATE|INSERT)\b", sql, re.I | re.M)
    now = datetime.datetime.now(datetime.timezone.utc).isoformat()
    checksum = hashlib.sha256(content).hexdigest()
    print("Hash verified", flush=True)
    migration_id = str(uuid.uuid4())
    # Migration names, checksum and UUID are fixed/generated values, never user data.
    record = "INSERT INTO _prisma_migrations (id,checksum,migration_name,started_at,finished_at,applied_steps_count) VALUES ('%s','%s','%s','%s','%s',1);" % (migration_id, checksum, name, now, now)
    print("Applying " + name, flush=True)
    connection.executescript("BEGIN IMMEDIATE;\n" + sql + "\n" + record + "\nCOMMIT;")
assert set(connection.execute("PRAGMA foreign_key_check").fetchall()) == baseline
after = balances()
assert before == after, "Balances changed during deployment; inspect concurrent activity"
receipt = {"backup": str(backup), "before": before, "after": after, "preexistingForeignKeyErrors": len(baseline), "newForeignKeyErrors": 0, "moduleTables": connection.execute("select count(*) from sqlite_master where type='table' and name like 'VideoFactory%'").fetchone()[0]}
(root / "vf-migration-receipt.json").write_text(json.dumps(receipt, indent=2))
print(json.dumps(receipt))
connection.close()
