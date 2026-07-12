#!/usr/bin/env python3
# HANDLE_PROVENANCE: ffmpeg/ffprobe present per video-stream tool receipts; sample paths from
# public/videos catalog receipts; certificate schema from the MirrorProd spec (compliance wedge,
# MeitY labelling+provenance obligations effective 2026-02-20, 4-source verified this session).
#
# MirrorProd certification pipeline v1 — makes the "ships with its certificate" claim real.
# Per delivery it produces:
#   I.   a visible AI label burned onto the video (bottom-left, MeitY-visible),
#   II.  provenance metadata embedded in the file container + hash-committed sidecar,
#   III. a consent-receipt slot (hash of the signed consent artifact when a real likeness appears),
# and a Certificate of Provenance JSON with a sequential cert number.
#
# v1 is operator-invoked per delivery. Hash-commit provenance, NOT real C2PA and NOT a ZKP —
# labelled accordingly in the certificate itself (ZKP_READY_NOT_ZKP_PROVEN).
#
# Usage:
#   python3 scripts/mirrorprod-certify.py INPUT.mp4 --out OUT_DIR \
#       [--client "Name"] [--project "Campaign"] [--consent consent.pdf] [--no-burn]
import argparse, hashlib, json, os, subprocess, sys
from datetime import datetime, timezone

REPO = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CERT_DIR = os.path.join(REPO, 'ops', 'certificates')
FONT = '/System/Library/Fonts/Helvetica.ttc'
LABEL = 'AI-GENERATED'

def make_label_png(path):
    # HANDLE_PROVENANCE: Pillow 12.2.0 import-verified on this body (python3 -c receipt, this session);
    # this ffmpeg build lacks drawtext (No such filter receipt), so the label rides the stream-sanctioned
    # lane: Pillow-rendered PNG composited with the core `overlay` filter.
    from PIL import Image, ImageDraw, ImageFont
    W, H, PAD = 560, 104, 22
    img = Image.new('RGBA', (W, H), (0, 0, 0, 150))
    d = ImageDraw.Draw(img)
    font = ImageFont.truetype(FONT, 56)
    tw = d.textlength(LABEL, font=font)
    d.text(((W - tw) / 2, PAD), LABEL, font=font, fill=(255, 255, 255, 240))
    img.save(path)
    return path

def sha256(path):
    h = hashlib.sha256()
    with open(path, 'rb') as f:
        for chunk in iter(lambda: f.read(1 << 20), b''):
            h.update(chunk)
    return h.hexdigest()

def next_cert_number():
    os.makedirs(CERT_DIR, exist_ok=True)
    existing = [f for f in os.listdir(CERT_DIR) if f.startswith('MP-') and f.endswith('.json')]
    return f"MP-2026-{len(existing) + 1:04d}"

def run(cmd):
    p = subprocess.run(cmd, capture_output=True, text=True)
    if p.returncode != 0:
        sys.exit(f"FAILED: {' '.join(cmd)}\n{p.stderr[-800:]}")
    return p.stdout

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('input')
    ap.add_argument('--out', required=True)
    ap.add_argument('--client', default='UNSPECIFIED')
    ap.add_argument('--project', default='UNSPECIFIED')
    ap.add_argument('--consent', default=None, help='path to signed consent artifact (required when a real likeness appears)')
    ap.add_argument('--generator', default='MirrorProd (Veo pipeline)', help='generation system, honestly stated')
    ap.add_argument('--no-burn', action='store_true', help='skip label burn if the source already carries a visible label')
    args = ap.parse_args()

    if not os.path.exists(args.input):
        sys.exit(f"input not found: {args.input}")
    os.makedirs(args.out, exist_ok=True)

    cert_no = next_cert_number()
    src_hash = sha256(args.input)
    stem = os.path.splitext(os.path.basename(args.input))[0]
    out_video = os.path.join(args.out, f"{stem}.certified.mp4")

    provenance = {
        'certificate': cert_no,
        'standard': 'MirrorProd delivery standard v1 (hash-commit provenance; not C2PA, not ZKP)',
        'legal_basis': 'India IT Rules SGI amendments, labelling+provenance effective 2026-02-20',
        'generator': args.generator,
        'source_sha256': src_hash,
        'client': args.client,
        'project': args.project,
        'issued_utc': datetime.now(timezone.utc).isoformat(timespec='seconds'),
        'issuer': 'Active Mirror / N1 Intelligence (OPC) Pvt Ltd',
    }

    # I. visible label (Pillow PNG composited bottom-left via core overlay filter,
    # sized to ~1/5 of video width via scale2ref) + II. embedded provenance
    meta = json.dumps(provenance, separators=(',', ':'))
    cmd = ['ffmpeg', '-loglevel', 'error', '-y', '-i', args.input]
    if not args.no_burn:
        label_png = make_label_png(os.path.join(args.out, '_ai_label.png'))
        flt = ("[1:v][0:v]scale2ref=w=main_w/5:h=main_w/5*104/560[lbl][vid];"
               "[vid][lbl]overlay=x=W/50:y=H-h-H/40")
        cmd += ['-i', label_png, '-filter_complex', flt]
    cmd += ['-metadata', f'comment={meta}', '-metadata', f'title=MirrorProd delivery {cert_no}',
            '-c:a', 'copy' if args.no_burn else 'aac', '-movflags', '+faststart', out_video]
    if args.no_burn:
        cmd[cmd.index('-c:a'):cmd.index('-c:a')] = ['-c:v', 'copy']
    run(cmd)

    out_hash = sha256(out_video)

    # III. consent receipt slot
    consent = {'present': False, 'note': 'no real likeness declared, or consent pending'}
    if args.consent:
        consent = {'present': True, 'artifact': os.path.basename(args.consent), 'sha256': sha256(args.consent)}

    certificate = {
        **provenance,
        'delivered_sha256': out_hash,
        'visible_label': 'burned' if not args.no_burn else 'pre-existing (declared by operator)',
        'consent_receipt': consent,
        'clauses': [
            'I. Visible AI label on the video',
            'II. Provenance metadata embedded in the file (container comment) + this hash-committed certificate',
            'III. Consent receipt travels with the project when a real likeness appears',
        ],
    }
    cert_path = os.path.join(CERT_DIR, f"{cert_no}.json")
    with open(cert_path, 'w') as f:
        json.dump(certificate, f, indent=2)
    side_path = os.path.join(args.out, f"{stem}.certificate.json")
    with open(side_path, 'w') as f:
        json.dump(certificate, f, indent=2)

    # verify: embedded metadata really present
    probe = run(['ffprobe', '-v', 'error', '-show_entries', 'format_tags=comment,title', '-of', 'json', out_video])
    tags = json.loads(probe).get('format', {}).get('tags', {})
    assert cert_no in tags.get('title', '') and src_hash in tags.get('comment', ''), 'embedded provenance verification failed'

    print(json.dumps({'certificate': cert_no, 'video': out_video, 'video_sha256': out_hash,
                      'cert_record': cert_path, 'sidecar': side_path,
                      'embedded_ok': True, 'label': certificate['visible_label']}, indent=2))

if __name__ == '__main__':
    main()
