"""Client Chrome DevTools Protocol tối giản — chỉ dùng thư viện chuẩn.

Vì sao cần: `chrome --dump-dom` chỉ chụp được DOM sau khi tải, không bấm được
nút nào. Nhiều lỗi của trang chỉ xuất hiện SAU một thao tác (gõ vào ô tìm kiếm,
bấm nút), và `TestClient` của FastAPI thì không chạy JavaScript.

Không cài playwright/selenium để giữ phần phụ thuộc của đồ án gọn; bắt tay
WebSocket và đóng khung dữ liệu viết tay hết khoảng 60 dòng.
"""

import base64
import hashlib
import json
import os
import re
import socket
import struct
import subprocess
import time
import urllib.request


class Cdp:
    def __init__(self, ws_url):
        m = re.match(r"ws://([^:/]+):(\d+)(/.*)", ws_url)
        host, cong, duong = m.group(1), int(m.group(2)), m.group(3)
        self.sock = socket.create_connection((host, cong))
        self.sock.settimeout(30)
        khoa = base64.b64encode(os.urandom(16)).decode()
        self.sock.sendall(
            f"GET {duong} HTTP/1.1\r\nHost: {host}:{cong}\r\n"
            f"Upgrade: websocket\r\nConnection: Upgrade\r\n"
            f"Sec-WebSocket-Key: {khoa}\r\nSec-WebSocket-Version: 13\r\n\r\n"
            .encode()
        )
        mong_doi = base64.b64encode(hashlib.sha1(
            (khoa + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").encode()).digest()).decode()
        dem = b""
        while b"\r\n\r\n" not in dem:
            dem += self.sock.recv(4096)
        assert mong_doi in dem.decode(errors="replace"), "bắt tay WebSocket thất bại"
        self._du = dem.split(b"\r\n\r\n", 1)[1]
        self._id = 0

    # ── khung WebSocket ──────────────────────────────────────────────────────
    def _gui(self, text):
        data = text.encode()
        khung = bytearray([0x81])
        n, mask = len(data), os.urandom(4)
        if n < 126:
            khung.append(0x80 | n)
        elif n < 65536:
            khung.append(0x80 | 126); khung += struct.pack(">H", n)
        else:
            khung.append(0x80 | 127); khung += struct.pack(">Q", n)
        khung += mask + bytes(b ^ mask[i % 4] for i, b in enumerate(data))
        self.sock.sendall(khung)

    def _doc_byte(self, n):
        while len(self._du) < n:
            them = self.sock.recv(65536)
            if not them:
                raise ConnectionError("Chrome đóng kết nối")
            self._du += them
        ra, self._du = self._du[:n], self._du[n:]
        return ra

    def _nhan(self):
        b1, b2 = self._doc_byte(2)
        n = b2 & 0x7F
        if n == 126:
            n = struct.unpack(">H", self._doc_byte(2))[0]
        elif n == 127:
            n = struct.unpack(">Q", self._doc_byte(8))[0]
        return json.loads(self._doc_byte(n).decode())

    # ── CDP ──────────────────────────────────────────────────────────────────
    def goi(self, method, **params):
        self._id += 1
        self._gui(json.dumps({"id": self._id, "method": method, "params": params}))
        while True:
            tin = self._nhan()
            if tin.get("id") == self._id:
                if "error" in tin:
                    raise RuntimeError(f"{method}: {tin['error']}")
                return tin.get("result", {})

    def js(self, bieu_thuc, cho=False):
        r = self.goi("Runtime.evaluate", expression=bieu_thuc,
                     returnByValue=True, awaitPromise=cho)
        if r.get("exceptionDetails"):
            raise RuntimeError(r["exceptionDetails"].get("text"))
        return r["result"].get("value")

    def mo(self, url):
        self.goi("Page.navigate", url=url)

    def cho_co(self, bieu_thuc, giay=20, moi=0.25):
        """Chờ tới khi biểu thức JS trả về giá trị đúng."""
        het = time.time() + giay
        while time.time() < het:
            try:
                if self.js(bieu_thuc):
                    return True
            except RuntimeError:
                pass
            time.sleep(moi)
        raise TimeoutError(f"quá {giay}s mà chưa thoả: {bieu_thuc}")

    def dong(self):
        try:
            self.sock.close()
        except OSError:
            pass


def mo_chrome(thu_muc_ho_so, cong=9222):
    """Bật Chrome headless có cổng gỡ lỗi, trả (tiến trình, Cdp)."""
    p = subprocess.Popen(
        ["google-chrome", "--headless=new", "--no-sandbox", "--disable-gpu",
         f"--remote-debugging-port={cong}", f"--user-data-dir={thu_muc_ho_so}",
         "--window-size=1400,1000", "about:blank"],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )
    het = time.time() + 25
    while time.time() < het:
        try:
            ds = json.load(urllib.request.urlopen(
                f"http://127.0.0.1:{cong}/json/list", timeout=2))
            trang = [t for t in ds if t.get("type") == "page"]
            if trang:
                c = Cdp(trang[0]["webSocketDebuggerUrl"])
                c.goi("Runtime.enable")
                c.goi("Page.enable")
                return p, c
        except Exception:
            time.sleep(0.4)
    p.kill()
    raise RuntimeError("không bật được Chrome có cổng gỡ lỗi")
