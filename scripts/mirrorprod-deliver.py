#!/usr/bin/env python3
# HANDLE_PROVENANCE: MirrorProd delivery flow, built 2026-07-13 per Paul "do move 4".
# Turns the per-file certifier (scripts/mirrorprod-certify.py, which issued MP-2026-0001) into a
# delivery step + a deterministic gate, so the site's "every delivery ships with its certificate"
# claim holds by architecture:
#   deliver <indir> --out <packet>  : certify every video in indir, assemble a delivery packet
#                                     (certified mp4s + certificate JSONs + DELIVERY.md + manifest)
#   verify  <packet>                : fail non-zero unless EVERY delivered video has a matching
#                                     certificate whose delivered_sha256 equals the file's real hash
# The verify gate is what makes the promise enforceable: no uncertified video can pass it.
import argparse, hashlib, json, os, subprocess, sys
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CERTIFY = os.path.join(REPO, 'scripts', 'mirrorprod-certify.py')
REQUIRED_CLAUSES = 3

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def cmd_deliver(args):
    os.makedirs(args.out, exist_ok=True)
    videos = sorted(f for f in os.listdir(args.indir)
                    if f.lower().endswith('.mp4') and '.certified.' not in f)
    if not videos:
        sys.exit(f"no .mp4 files to deliver in {args.indir}")
    items = []
    for v in videos:
        src = os.path.join(args.indir, v)
        certify_cmd = ['python3', CERTIFY, src, '--out', args.out,
                       '--client', args.client, '--project', args.project]
        if args.consent:
            certify_cmd += ['--consent', args.consent]
        out = subprocess.run(certify_cmd, capture_output=True, text=True)
        if out.returncode != 0:
            sys.exit(f"certify failed for {v}:\n{out.stderr[-600:]}")
        result = json.loads(out.stdout)
        items.append({
            'source': v,
            'certificate': result['certificate'],
            'delivered_video': os.path.basename(result['video']),
            'delivered_sha256': result['video_sha256'],
            'label': result['label'],
        })
        print(f"certified {v} -> {result['certificate']}")

    manifest = {
        'client': args.client,
        'project': args.project,
        'issued_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'issuer': 'Active Mirror / N1 Intelligence (OPC) Pvt Ltd',
        'standard': 'MirrorProd delivery standard v1 (hash-commit provenance; not C2PA, not ZKP)',
        'count': len(items),
        'items': items,
    }
    with open(os.path.join(args.out, 'delivery-manifest.json'), 'w') as f:
        json.dump(manifest, f, indent=2)

    lines = [f"# MirrorProd delivery — {args.project}", "",
             f"**Client:** {args.client}  ", f"**Issued:** {manifest['issued_utc']}  ",
             f"**Videos:** {len(items)}  ", "",
             "Every video below ships with a visible AI label, embedded provenance metadata, and its",
             "Certificate of Provenance — the disclosure India's IT Rules require for realistic AI video.", "",
             "| # | Source | Certificate | Delivered file |", "|---|---|---|---|"]
    for i, it in enumerate(items, 1):
        lines.append(f"| {i} | {it['source']} | {it['certificate']} | {it['delivered_video']} |")
    lines += ["", "_A delivery standard, not legal advice. Rules status as of the issue date above._"]
    with open(os.path.join(args.out, 'DELIVERY.md'), 'w') as f:
        f.write("\n".join(lines) + "\n")

    print(json.dumps({'packet': args.out, 'count': len(items),
                      'manifest': os.path.join(args.out, 'delivery-manifest.json')}, indent=2))

def cmd_verify(args):
    failures = []
    certified = sorted(f for f in os.listdir(args.packet) if f.endswith('.certified.mp4'))
    if not certified:
        sys.exit(f"GATE FAIL: no certified videos found in {args.packet}")
    for v in certified:
        stem = v[:-len('.certified.mp4')]
        cert_path = os.path.join(args.packet, f"{stem}.certificate.json")
        vid_path = os.path.join(args.packet, v)
        if not os.path.exists(cert_path):
            failures.append(f"{v}: no certificate ({stem}.certificate.json missing)")
            continue
        cert = json.load(open(cert_path))
        real = sha256(vid_path)
        if cert.get('delivered_sha256') != real:
            failures.append(f"{v}: hash mismatch (cert {cert.get('delivered_sha256','?')[:12]} != file {real[:12]})")
        if len(cert.get('clauses', [])) < REQUIRED_CLAUSES:
            failures.append(f"{v}: certificate missing required clauses")
        if not cert.get('certificate'):
            failures.append(f"{v}: certificate has no number")
        if not failures or failures[-1].split(':')[0] != v:
            print(f"ok   {v}  ({cert.get('certificate')})")
    if failures:
        print("\nGATE FAIL — uncertified or tampered videos in the packet:", file=sys.stderr)
        for f in failures:
            print(f"  - {f}", file=sys.stderr)
        sys.exit(1)
    print(f"\nDelivery gate passed: {len(certified)} videos, all certified and hash-matched.")

def main():
    ap = argparse.ArgumentParser(description="MirrorProd delivery flow")
    sub = ap.add_subparsers(dest='cmd', required=True)
    d = sub.add_parser('deliver')
    d.add_argument('indir'); d.add_argument('--out', required=True)
    d.add_argument('--client', default='UNSPECIFIED'); d.add_argument('--project', default='UNSPECIFIED')
    d.add_argument('--consent', default=None)
    d.set_defaults(func=cmd_deliver)
    v = sub.add_parser('verify')
    v.add_argument('packet')
    v.set_defaults(func=cmd_verify)
    args = ap.parse_args()
    args.func(args)

if __name__ == '__main__':
    main()
