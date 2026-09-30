#!/usr/bin/env python3
"""Serve the site locally:  python scripts/serve.py [port]   (then open http://localhost:8000)

The same as `python -m http.server`, except that it answers Range requests. A browser
needs them to seek in a video (the explorer's recordings), and the standard library's
server always sends the whole file.
"""
import functools
import http.server
import os
import re
import sys
from pathlib import Path

SITE = Path(__file__).resolve().parent.parent


class Handler(http.server.SimpleHTTPRequestHandler):
    part = None       # bytes left to send of a range

    def end_headers(self):
        self.send_header("Accept-Ranges", "bytes")
        super().end_headers()

    def send_head(self):
        m = re.fullmatch(r"bytes=(\d*)-(\d*)", (self.headers.get("Range") or "").strip())
        path = self.translate_path(self.path)
        if not m or m.groups() == ("", "") or not os.path.isfile(path):
            return super().send_head()
        size = os.path.getsize(path)
        a, b = m.groups()
        if a == "":                          # the last b bytes
            start, end = max(0, size - int(b)), size - 1
        else:
            start, end = int(a), min(int(b) if b else size - 1, size - 1)
        if start >= size or start > end:
            self.send_response(416)
            self.send_header("Content-Range", f"bytes */{size}")
            self.send_header("Content-Length", "0")
            self.end_headers()
            return None
        f = open(path, "rb")
        f.seek(start)
        self.send_response(206)
        self.send_header("Content-Type", self.guess_type(path))
        self.send_header("Content-Range", f"bytes {start}-{end}/{size}")
        self.send_header("Content-Length", str(end - start + 1))
        self.end_headers()
        self.part = end - start + 1
        return f

    def copyfile(self, source, outputfile):
        if self.part is None:
            return super().copyfile(source, outputfile)
        left, self.part = self.part, None
        while left > 0:
            buf = source.read(min(left, 1 << 16))
            if not buf:
                break
            outputfile.write(buf)
            left -= len(buf)


def main():
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    handler = functools.partial(Handler, directory=str(SITE))
    with http.server.ThreadingHTTPServer(("", port), handler) as httpd:
        print(f"serving {SITE} at http://localhost:{port}/")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
