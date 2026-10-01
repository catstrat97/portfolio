#!/usr/bin/env python3
"""Static dev server for the prototype, with caching disabled.

python3 tools/serve.py [port]

Plain `python3 -m http.server` lets the browser keep ES modules in its memory
cache, so edits don't show up until a hard reload. `no-store` avoids that.
Binds 0.0.0.0 so a phone on the same wifi can open http://<your-ip>:<port>.
"""
import http.server
import os
import socket
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'prototype')


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=os.path.abspath(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, must-revalidate')
        super().end_headers()


def lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(('8.8.8.8', 80))
        return s.getsockname()[0]
    except OSError:
        return '127.0.0.1'
    finally:
        s.close()


if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
    print(f'  local   http://localhost:{port}')
    print(f'  phone   http://{lan_ip()}:{port}   (same wifi)')
    http.server.ThreadingHTTPServer(('0.0.0.0', port), Handler).serve_forever()
