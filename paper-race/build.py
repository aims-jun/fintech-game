"""Create a self-contained player HTML and an offline release archive."""
from pathlib import Path
import base64
import re
import zipfile

ROOT = Path(__file__).resolve().parent

def standalone():
    html = (ROOT / 'index.html').read_text(encoding='utf-8')
    css = '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in ['arena.css','documents.css','receipt-photos.css','form-photos.css'])
    def embed_font(match):
        data = base64.b64encode((ROOT / 'assets' / match.group(1)).read_bytes()).decode('ascii')
        return "url('data:font/woff;base64," + data + "')"
    css = re.sub(r"url\('assets/([^']+\.woff)'\)", embed_font, css)
    html = re.sub(r'<link rel="stylesheet" href="arena\.css\?v=[^\"]+">', lambda _match: '<style>' + css + '</style>', html)
    html = re.sub(r'<link rel="stylesheet" href="(?:documents|receipt-photos|form-photos)\.css\?v=[^\"]+">', '', html)
    html = re.sub(r'<script defer src="[^\"]+"></script>', '', html)
    scripts = '\n'.join((ROOT / name).read_text(encoding='utf-8') for name in ['cases.js', 'casebook.js', 'hospital-forms.js', 'receipt-photos.js', 'form-photos.js', 'documents.js', 'engine.js', 'app.js'])
    # Photo templates must work from a downloaded HTML without a local server.
    for filename in ['receipt-hospital-photo.png', 'receipt-pharmacy-photo.png', 'claim-form-photo.png', 'detail-form-photo.png']:
        data = base64.b64encode((ROOT / 'assets' / filename).read_bytes()).decode('ascii')
        scripts = scripts.replace('assets/' + filename, 'data:image/png;base64,' + data)
    # A downloaded single player file has no separate operator route.
    scripts = scripts.replace("if (new URLSearchParams(location.search).get('view') === 'operator') {", "if (false) {")
    html = html.replace('</body>', '<script>\n' + scripts.replace('</script', '<\\/script') + '\n</script>\n</body>')
    return html

def build(destination):
    destination = Path(destination)
    destination.mkdir(parents=True, exist_ok=True)
    preview = destination / 'AIMS-Paper-Race.html'
    preview.write_text(standalone(), encoding='utf-8')
    archive = destination / 'AIMS-Paper-Race-Arena5.zip'
    with zipfile.ZipFile(archive, 'w', compression=zipfile.ZIP_DEFLATED) as bundle:
        for path in sorted(ROOT.rglob('*')):
            if path.is_file() and not {'__pycache__', 'node_modules', '.git'}.intersection(path.parts) and path.suffix != '.pyc':
                bundle.write(path, 'AIMS-Paper-Race/' + path.relative_to(ROOT).as_posix())
        bundle.write(preview, 'AIMS-Paper-Race/AIMS-Paper-Race.html')
    return preview, archive

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument('--out', default=str(ROOT.parent / 'deliverables'))
    args = parser.parse_args()
    for output in build(args.out):
        print(f'{output.name}: {output.stat().st_size:,} bytes')
