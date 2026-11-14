"""Draws the app icons (no dependencies): purple tile with a circle, a diamond and a square."""
import struct, zlib, os

def png(path, size):
    S = 4  # supersampling
    N = size * S
    bg = (91, 60, 196); fg = (255, 255, 255); arc = (196, 181, 253)
    def inside(px, py):
        x, y = px / N, py / N
        # stones on a gentle wave: circle (left), diamond (middle), square (right)
        if (x - 0.24) ** 2 + (y - 0.56) ** 2 <= 0.105 ** 2: return fg
        if abs(x - 0.5) + abs(y - 0.44) <= 0.125: return fg
        if abs(x - 0.76) <= 0.095 and abs(y - 0.56) <= 0.095: return fg
        return None
    rows = []
    for y in range(size):
        row = bytearray([0])
        for x in range(size):
            acc = [0, 0, 0]
            for sy in range(S):
                for sx in range(S):
                    c = inside(x * S + sx, y * S + sy) or bg
                    for i in range(3): acc[i] += c[i]
            row += bytes(v // (S * S) for v in acc)
        rows.append(bytes(row))
    raw = b''.join(rows)
    def chunk(t, d): return struct.pack('>I', len(d)) + t + d + struct.pack('>I', zlib.crc32(t + d) & 0xffffffff)
    data = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b'')
    open(path, 'wb').write(data)

out = os.path.join(os.path.dirname(__file__), '..', 'public')
for name, s in [('icon-192.png', 192), ('icon-512.png', 512), ('apple-touch-icon.png', 180)]:
    png(os.path.join(out, name), s)
print('icons ok')
