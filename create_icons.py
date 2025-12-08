#!/usr/bin/env python3
import struct
import zlib

def create_simple_png(width, height, rgb_data):
    """Create a simple PNG file from RGB data"""
    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xffffffff
        return struct.pack(">I", len(data)) + chunk + struct.pack(">I", crc)
    
    # PNG signature
    png = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)  # 2 = RGB color type
    png += png_chunk(b'IHDR', ihdr)
    
    # IDAT chunk (image data)
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # Filter type
        for x in range(width):
            idx = (y * width + x) * 3
            raw_data += bytes(rgb_data[idx:idx+3])
    
    compressed = zlib.compress(raw_data, 9)
    png += png_chunk(b'IDAT', compressed)
    
    # IEND chunk
    png += png_chunk(b'IEND', b'')
    
    return png

def create_icon(size):
    """Create a YouTube transcript icon"""
    # Red background color
    red = [255, 0, 0]
    white = [255, 255, 255]
    
    rgb_data = []
    
    # Calculate dimensions
    corner_radius = size // 6
    play_size = size // 3
    play_x = size // 6
    play_y = size // 3
    
    for y in range(size):
        for x in range(size):
            # Default to red background
            color = red.copy()
            
            # Draw rounded corners (simple approximation - make corners transparent/red)
            in_corner = False
            # Top-left
            if x < corner_radius and y < corner_radius:
                dx, dy = corner_radius - x, corner_radius - y
                if dx*dx + dy*dy > corner_radius*corner_radius:
                    in_corner = True
            # Top-right
            elif x >= size - corner_radius and y < corner_radius:
                dx, dy = x - (size - corner_radius - 1), corner_radius - y
                if dx*dx + dy*dy > corner_radius*corner_radius:
                    in_corner = True
            # Bottom-left
            elif x < corner_radius and y >= size - corner_radius:
                dx, dy = corner_radius - x, y - (size - corner_radius - 1)
                if dx*dx + dy*dy > corner_radius*corner_radius:
                    in_corner = True
            # Bottom-right
            elif x >= size - corner_radius and y >= size - corner_radius:
                dx, dy = x - (size - corner_radius - 1), y - (size - corner_radius - 1)
                if dx*dx + dy*dy > corner_radius*corner_radius:
                    in_corner = True
            
            if not in_corner:
                # Draw play button (triangle)
                px1, py1 = play_x, play_y
                px2, py2 = play_x + play_size, play_y + play_size // 2
                px3, py3 = play_x, play_y + play_size
                
                if px1 <= x <= px2 and py1 <= y <= py3:
                    # Simple triangle check
                    if x - px1 <= (y - py1) * 2 and x - px1 <= (py3 - y) * 2:
                        color = white.copy()
                
                # Draw horizontal lines (transcript lines)
                line_x = size // 2 + size // 12
                line_width = size // 3
                line_height = max(1, size // 32)
                spacing = size // 6
                
                for i in range(3):
                    line_y = play_y + i * spacing
                    if line_x <= x < line_x + line_width and line_y <= y < line_y + line_height:
                        color = white.copy()
            
            rgb_data.extend(color)
    
    return create_simple_png(size, size, rgb_data)

# Create icons
for size in [16, 48, 128]:
    png_data = create_icon(size)
    with open(f'icon{size}.png', 'wb') as f:
        f.write(png_data)
    print(f'Created icon{size}.png')

print('All icons created successfully!')
