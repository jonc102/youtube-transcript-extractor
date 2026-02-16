#!/usr/bin/env python3
"""Generate extension icons: white document+play symbol on #6C5CE7 purple rounded square."""
import struct
import zlib
import math


def create_png_rgba(width, height, rgba_data):
    """Create a PNG file from RGBA pixel data."""
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xFFFFFFFF
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)

    png = b'\x89PNG\r\n\x1a\n'
    # color_type 6 = RGBA
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png += png_chunk(b'IHDR', ihdr)

    raw = b''
    for y in range(height):
        raw += b'\x00'  # filter: none
        for x in range(width):
            idx = (y * width + x) * 4
            raw += bytes(rgba_data[idx:idx + 4])

    png += png_chunk(b'IDAT', zlib.compress(raw, 9))
    png += png_chunk(b'IEND', b'')
    return png


def dist(ax, ay, bx, by):
    """Euclidean distance between two points."""
    return math.sqrt((ax - bx) ** 2 + (ay - by) ** 2)


def point_in_triangle(px, py, x1, y1, x2, y2, x3, y3):
    """Return True if point (px, py) is inside triangle defined by three vertices."""
    def sign(ax, ay, bx, by, cx, cy):
        return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy)

    d1 = sign(px, py, x1, y1, x2, y2)
    d2 = sign(px, py, x2, y2, x3, y3)
    d3 = sign(px, py, x3, y3, x1, y1)

    has_neg = (d1 < 0) or (d2 < 0) or (d3 < 0)
    has_pos = (d1 > 0) or (d2 > 0) or (d3 > 0)
    return not (has_neg and has_pos)


def in_rounded_rect(x, y, rx, ry, rw, rh, radius):
    """Return True if (x, y) is inside a rounded rectangle."""
    # Interior bands (no radius needed)
    if rx + radius <= x <= rx + rw - radius and ry <= y <= ry + rh:
        return True
    if rx <= x <= rx + rw and ry + radius <= y <= ry + rh - radius:
        return True
    # Corner arcs
    corners = [
        (rx + radius, ry + radius),
        (rx + rw - radius, ry + radius),
        (rx + radius, ry + rh - radius),
        (rx + rw - radius, ry + rh - radius),
    ]
    for cx, cy in corners:
        if dist(x, y, cx, cy) <= radius:
            return True
    return False


def create_icon(size):
    """Create a logo icon at the given pixel size.

    Design: purple (#6C5CE7) rounded square with a white document shape
    containing transcript lines and a small play triangle cutout.
    """
    # Colors
    purple = (108, 92, 231)   # #6C5CE7
    white = (255, 255, 255)

    s = size  # shorthand
    rgba = []

    # Background rounded square
    bg_radius = s * 0.22  # ~20% corner radius (iOS style)

    # Document dimensions — centered, with comfortable padding
    doc_pad_x = s * 0.22
    doc_pad_top = s * 0.16
    doc_pad_bot = s * 0.18
    doc_left = doc_pad_x
    doc_right = s - doc_pad_x
    doc_top = doc_pad_top
    doc_bottom = s - doc_pad_bot
    doc_w = doc_right - doc_left
    doc_h = doc_bottom - doc_top
    doc_radius = s * 0.08  # slight rounding on the document

    # Dog-ear (folded corner) on top-right of document
    ear_size = doc_w * 0.25

    # Transcript lines — 3 lines inside the document
    line_margin_l = doc_left + doc_w * 0.14
    line_margin_r = doc_right - doc_w * 0.14
    line_thickness = max(1, round(s * 0.055))
    # Vertical positioning: distribute 3 lines in the middle-to-lower area of the doc
    lines_region_top = doc_top + doc_h * 0.38
    lines_region_bot = doc_bottom - doc_h * 0.15
    line_spacing = (lines_region_bot - lines_region_top) / 2
    line_lengths = [0.95, 0.70, 0.50]  # relative to available width

    # Play triangle — small, bottom-left area of document interior
    play_cx = doc_left + doc_w * 0.30
    play_cy = doc_top + doc_h * 0.22
    play_r = doc_w * 0.16  # "radius" of the play triangle

    for y in range(s):
        for x in range(s):
            # 1. Background: rounded square or transparent
            if not in_rounded_rect(x, y, 0, 0, s - 1, s - 1, bg_radius):
                rgba.extend([0, 0, 0, 0])  # transparent
                continue

            # Start with purple background
            r, g, b, a = purple[0], purple[1], purple[2], 255

            # 2. Document shape — rounded rect with dog-ear
            in_doc = in_rounded_rect(
                x, y, doc_left, doc_top, doc_w, doc_h, doc_radius
            )

            # Cut out the dog-ear triangle (top-right corner of document)
            in_ear = False
            if in_doc:
                ear_x = doc_right - ear_size
                ear_y = doc_top + ear_size
                if x >= ear_x and y <= doc_top + (ear_y - doc_top) * ((doc_right - x) / max(ear_size, 1)):
                    # Above the diagonal — this is the cut corner
                    if y < ear_y and x > ear_x:
                        in_ear = True

            if in_doc and not in_ear:
                r, g, b = white

                # 3. Play triangle — cut out from white (show purple through)
                # Rightward-pointing equilateral-ish triangle
                tri_x1 = play_cx - play_r * 0.5  # left vertex
                tri_y1 = play_cy - play_r * 0.85
                tri_x2 = play_cx - play_r * 0.5  # bottom-left vertex
                tri_y2 = play_cy + play_r * 0.85
                tri_x3 = play_cx + play_r * 0.9   # right point
                tri_y3 = play_cy

                if point_in_triangle(x, y, tri_x1, tri_y1, tri_x2, tri_y2, tri_x3, tri_y3):
                    r, g, b = purple  # punch through to purple

                # 4. Transcript lines — draw purple on white
                avail_w = line_margin_r - line_margin_l
                for i, length_frac in enumerate(line_lengths):
                    ly = lines_region_top + i * line_spacing
                    lw = avail_w * length_frac
                    if (line_margin_l <= x <= line_margin_l + lw and
                            ly <= y <= ly + line_thickness):
                        r, g, b = purple

            # Dog-ear fold triangle (small darker triangle to suggest fold)
            if in_ear:
                ear_fold_x = doc_right - ear_size
                ear_fold_y = doc_top
                # Draw a small triangle for the fold flap
                fold_x1 = ear_fold_x
                fold_y1 = doc_top
                fold_x2 = doc_right
                fold_y2 = doc_top
                fold_x3 = doc_right
                fold_y3 = doc_top + ear_size
                if point_in_triangle(x, y, fold_x1, fold_y1, fold_x2, fold_y2, fold_x3, fold_y3):
                    # Lighter purple fold
                    r, g, b = (200, 195, 240)  # light lavender fold
                    a = 180

            rgba.extend([r, g, b, a])

    return create_png_rgba(s, s, rgba)


# Generate icons at all required sizes
for size in [16, 48, 128]:
    png_data = create_icon(size)
    with open(f'icon{size}.png', 'wb') as f:
        f.write(png_data)
    print(f'Created icon{size}.png ({size}x{size})')

print('All icons created successfully!')
