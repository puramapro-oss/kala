"""Run the KALA webhook against a private disposable PostgreSQL with synthetic providers."""
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[2]
pg_bin = Path(os.environ.get('PG_BIN') or Path(shutil.which('pg_config') or '/usr/bin/pg_config').parent)
if 'PG_BIN' not in os.environ and shutil.which('pg_config'):
    pg_bin = Path(subprocess.check_output(['pg_config', '--bindir'], text=True).strip())
psql = os.environ.get('PSQL') or str(pg_bin / 'psql')
node = shutil.which('node')
for exe in [pg_bin / 'initdb', pg_bin / 'pg_ctl', psql, node]:
    if not exe or not os.access(exe, os.X_OK):
        raise SystemExit('PostgreSQL (initdb, pg_ctl, psql), btree_gist and Node are required. Select PG_BIN and PSQL if needed.')

with tempfile.TemporaryDirectory(prefix='kala-pg-') as tmp:
    directory = Path(tmp)
    data = directory / 'data'
    password = secrets.token_hex(24)
    pwfile = directory / 'password'
    pwfile.write_text(password + '\n')
    pwfile.chmod(0o600)
    with socket.socket() as port_probe:
        port_probe.bind(('127.0.0.1', 0))
        port = port_probe.getsockname()[1]
    env = {k: v for k, v in os.environ.items() if not k.startswith(('PG', 'SUPABASE', 'STRIPE', 'RESEND', 'KARMA'))}
    env.update(PGHOST='127.0.0.1', PGPORT=str(port), PGUSER='kala_fixture', PGDATABASE='postgres', PGPASSWORD=password,
               PGCONNECT_TIMEOUT='4', PSQL=psql, KALA_FIXTURE_DATA=str(data), KARMA_SHARED_SECRET='local-fixture-signature',
               STRIPE_SECRET_KEY='sk_test_local_fixture', RESEND_API_KEY='re_local_fixture', NEXT_TELEMETRY_DISABLED='1')
    def run(args, **kwargs):
        return subprocess.run(args, env=env, cwd=ROOT, check=True, **kwargs)
    def sql(statement):
        return run([psql, '-XqAt', '-v', 'ON_ERROR_STOP=1'], input=statement, text=True, stdout=subprocess.PIPE).stdout.strip()
    run([str(pg_bin / 'initdb'), '-D', str(data), '-U', 'kala_fixture', '--auth=scram-sha-256', '--pwfile', str(pwfile), '--no-locale', '-E', 'UTF8'], stdout=subprocess.DEVNULL)
    options = f"-h 127.0.0.1 -p {port} -c unix_socket_directories='' -c shared_buffers=16MB"
    run([str(pg_bin / 'pg_ctl'), '-w', '-t', '30', '-D', str(data), '-l', str(directory / 'server.log'), '-o', options, 'start'], stdout=subprocess.DEVNULL)
    try:
        assert sql('SHOW data_directory') == str(data) and sql('SHOW listen_addresses') == '127.0.0.1'
        print('PostgreSQL', sql('SHOW server_version'), flush=True)
        sql('CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS; CREATE SCHEMA auth; CREATE SCHEMA extensions; '
            "CREATE TABLE auth.users(id uuid PRIMARY KEY,email text); CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE "
            "AS $$SELECT (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')::uuid$$;")
        for migration in sorted((ROOT / 'migrations').glob('*.sql')):
            if migration.name == '0009_kala_reglements.sql':
                run([psql, '-Xq', '-v', 'ON_ERROR_STOP=1', '-f', str(ROOT / 'tests/settlement/legacy-fixture.sql')], stdout=subprocess.DEVNULL)
            run([psql, '-Xq', '-v', 'ON_ERROR_STOP=1', '-f', str(migration)], stdout=subprocess.DEVNULL)
        run([psql, '-Xq', '-v', 'ON_ERROR_STOP=1', '-f', str(ROOT / 'tests/settlement/reservations-access.sql')])
        run([node, 'node_modules/vitest/vitest.mjs', 'run', '--config', 'tests/settlement/vitest.config.mts'], timeout=150)
    finally:
        run([str(pg_bin / 'pg_ctl'), '-w', '-t', '20', '-m', 'fast', '-D', str(data), 'stop'], stdout=subprocess.DEVNULL)
