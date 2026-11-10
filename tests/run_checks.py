"""Verifica arquivos locais e executa os fluxos em Chrome/Edge com banco simulado.

Uso: python tests/run_checks.py
Nao acessa o Supabase e nao exige pacotes Python adicionais.
"""
from pathlib import Path
from html import unescape
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
from threading import Thread
import json
import os
import re
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]


class QuietHandler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.scripts = []
        self.assets = []
        self.scopes = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'template':
            self.scopes.append(self.ids)
            self.ids = set()
        if 'id' in attrs:
            assert attrs['id'] not in self.ids, f'ID duplicado: {attrs["id"]}'
            self.ids.add(attrs['id'])
        if tag == 'script' and 'src' in attrs:
            self.scripts.append(attrs['src'])
        for attribute in ('src', 'href'):
            if attrs.get(attribute):
                self.assets.append(attrs[attribute])

    def handle_endtag(self, tag):
        if tag == 'template':
            self.ids = self.scopes.pop()


def main():
    pages = {}
    for path in ROOT.glob('*.html'):
        source = path.read_text(encoding='utf-8')
        page = Page()
        page.feed(source)
        assert len(page.scripts) == len(set(page.scripts)), f'Script duplicado: {path.name}'
        for asset in page.assets:
            if not asset.startswith(('http:', 'https:', '#')):
                assert (ROOT / asset.split('#')[0]).is_file(), f'Arquivo ausente: {asset}'
        if 'js/comum.js' in page.scripts:
            assert page.scripts.index('js/supabase.js') < page.scripts.index('js/comum.js')
        # Troca somente os scripts da API pelo banco simulado. Executa o JS real das telas.
        source = re.sub(r'<script src="https:[^"]+"></script>', '', source)
        source = source.replace('<script src="js/supabase.js"></script>', '')
        source = re.sub(r'<script src="([^"]+)"></script>',
                        lambda m: '<script>' + (ROOT / m[1]).read_text(encoding='utf-8') + '</script>', source)
        source = re.sub(r'<link rel="stylesheet" href="([^"]+)">',
                        lambda m: '<style>' + (ROOT / m[1]).read_text(encoding='utf-8') + '</style>', source)
        source = source.replace('src="logo.png"', 'src="' + (ROOT / 'logo.png').as_uri() + '"')
        pages[path.stem] = source
    print('OK: links locais, IDs e ordem dos scripts em todas as paginas.')

    browsers = [Path(os.environ.get('PROGRAMFILES', 'C:/Program Files')) / 'Google/Chrome/Application/chrome.exe',
                Path(os.environ.get('PROGRAMFILES(X86)', 'C:/Program Files (x86)')) / 'Microsoft/Edge/Application/msedge.exe']
    browser = next((path for path in browsers if path.is_file()), None)
    if browser is None:
        raise SystemExit('Chrome ou Edge nao encontrado para executar os testes de navegador.')

    js = (ROOT / 'tests/browser.js').read_text(encoding='utf-8')
    payload = json.dumps(pages, ensure_ascii=True).replace('<', '\\u003c')
    html = '<!doctype html><meta charset="utf-8"><pre id="results">RUNNING</pre><script>const pages = ' + payload + ';\n' + js + '</script>'
    with tempfile.TemporaryDirectory(prefix='scp-tests-') as temp:
        temp = Path(temp)
        fixture = temp / 'tests.html'
        fixture.write_text(html, encoding='utf-8')
        # Origem HTTP local permite testar âncoras e histórico como no aplicativo real.
        server = ThreadingHTTPServer(('127.0.0.1', 0), partial(QuietHandler, directory=str(temp)))
        Thread(target=server.serve_forever, daemon=True).start()
        try:
            process = subprocess.run([str(browser), '--headless=new', '--disable-gpu', '--no-first-run',
                                      '--no-default-browser-check', '--disable-background-networking',
                                      '--disable-extensions', '--disable-sync', '--disable-crash-reporter',
                                      '--user-data-dir=' + str(temp / 'profile'), '--dump-dom',
                                      '--virtual-time-budget=15000', f'http://127.0.0.1:{server.server_port}/tests.html'],
                                     capture_output=True, timeout=50, encoding='utf-8', errors='replace',
                                     creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        finally:
            server.shutdown()
            server.server_close()
        result = re.search(r'<pre id="results">(.*?)</pre>', process.stdout, re.S)
        if not result:
            raise SystemExit('O navegador nao devolveu resultados. ' + process.stderr[-2000:])
        report = unescape(result[1])
        print(report)
        if 'FAIL' in report or 'COMPLETE' not in report:
            raise SystemExit(1)


if __name__ == '__main__':
    main()
