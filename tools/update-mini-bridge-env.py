#!/usr/bin/env python3
"""Update the Mini bridge env from stdin without printing secrets."""

from __future__ import annotations

import pathlib
import sys


ENV_PATH = pathlib.Path("/Users/mirror-admin/.activemirror/secrets/mini-mirror-bridge.env")


def main() -> int:
    secret = sys.stdin.readline().rstrip("\n")
    if not secret:
        print("openai_key=missing")
        return 1

    items: dict[str, str] = {}
    if ENV_PATH.exists():
        for line in ENV_PATH.read_text().splitlines():
            if "=" in line and not line.lstrip().startswith("#"):
                key, value = line.split("=", 1)
                items[key] = value

    items["MIRROR_PROVIDER"] = "openai"
    items["OPENAI_MODEL"] = "gpt-5.4-mini"
    items["OPENAI_API_KEY"] = secret

    ENV_PATH.write_text("".join(f"{key}={value}\n" for key, value in items.items()))
    ENV_PATH.chmod(0o600)
    print("bridge_env=updated")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
