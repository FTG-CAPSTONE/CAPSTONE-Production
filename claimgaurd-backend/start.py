"""
ClaimGuard multi-process launcher — replaces honcho.
Starts uvicorn, celery worker, and celery beat as subprocesses.
Zero dependencies beyond the Python standard library.

Usage (Render start command):
    python start.py
"""
from __future__ import annotations

import os
import signal
import subprocess
import sys
import time

PORT = os.environ.get("PORT", "8000")

PROCESSES = [
    # (label, command)
    ("web   ", [
        sys.executable, "-m", "uvicorn",
        "app.main:app",
        "--host", "0.0.0.0",
        "--port", PORT,
        "--workers", "1",
    ]),
    ("worker", [
        sys.executable, "-m", "celery",
        "-A", "workers.celery_app", "worker",
        "--loglevel=info",
        "-Q", "default,etl,ml,notifications",
        "--concurrency=1",
    ]),
    ("beat  ", [
        sys.executable, "-m", "celery",
        "-A", "workers.celery_app", "beat",
        "--loglevel=info",
        "--schedule", "/tmp/celerybeat-schedule",
    ]),
]


def _prefix_output(label: str, stream) -> None:
    """Read lines from stream and print them prefixed with the process label."""
    import threading

    def _reader():
        try:
            for line in stream:
                sys.stdout.write(f"[{label}] {line}")
                sys.stdout.flush()
        except Exception:
            pass

    t = threading.Thread(target=_reader, daemon=True)
    t.start()


def main() -> None:
    procs: list[subprocess.Popen] = []

    def _shutdown(signum=None, frame=None):
        print("\n[launcher] Shutting down all processes...", flush=True)
        for p in procs:
            try:
                p.terminate()
            except Exception:
                pass
        time.sleep(2)
        for p in procs:
            try:
                p.kill()
            except Exception:
                pass
        sys.exit(0)

    signal.signal(signal.SIGTERM, _shutdown)
    signal.signal(signal.SIGINT, _shutdown)

    # Start all processes
    for label, cmd in PROCESSES:
        p = subprocess.Popen(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
        _prefix_output(label, p.stdout)
        procs.append(p)
        print(f"[launcher] Started {label.strip()} (pid={p.pid})", flush=True)

    # Monitor — if any process dies unexpectedly, shut everything down
    while True:
        time.sleep(5)
        for i, p in enumerate(procs):
            if p.poll() is not None:
                label = PROCESSES[i][0]
                print(
                    f"[launcher] {label.strip()} exited with code {p.returncode}. "
                    "Shutting down.",
                    flush=True,
                )
                _shutdown()


if __name__ == "__main__":
    main()
