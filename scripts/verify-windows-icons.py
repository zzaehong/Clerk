"""Verify PNG-derived ICO frames are embedded in Windows PE resources (no dependencies)."""
import argparse
import hashlib
import struct
from pathlib import Path


def ico_frames(data):
    reserved, kind, count = struct.unpack_from('<HHH', data)
    if (reserved, kind) != (0, 1) or not count:
        raise ValueError('Invalid ICO header')
    frames = []
    for index in range(count):
        size, offset = struct.unpack_from('<II', data, 6 + index * 16 + 8)
        frame = data[offset:offset + size]
        if len(frame) != size:
            raise ValueError('Truncated ICO frame')
        frames.append(frame)
    return frames


def pe_icons(data):
    pe = struct.unpack_from('<I', data, 0x3c)[0]
    if data[pe:pe + 4] != b'PE\0\0':
        raise ValueError('Invalid PE signature')
    count = struct.unpack_from('<H', data, pe + 6)[0]
    optional_size = struct.unpack_from('<H', data, pe + 20)[0]
    optional = pe + 24
    magic = struct.unpack_from('<H', data, optional)[0]
    directory = optional + {0x10b: 96, 0x20b: 112}[magic]
    resource_rva = struct.unpack_from('<I', data, directory + 16)[0]
    sections = []
    for i in range(count):
        entry = optional + optional_size + i * 40
        virtual_size, rva, raw_size, raw = struct.unpack_from('<IIII', data, entry + 8)
        sections.append((rva, max(virtual_size, raw_size), raw))

    def offset(rva):
        for start, size, raw in sections:
            if start <= rva < start + size:
                return raw + rva - start
        raise ValueError(f'Unmapped RVA: {rva}')

    root = offset(resource_rva)
    icons = []

    def visit(relative, path=()):
        if len(path) > 3:
            raise ValueError('Invalid resource depth')
        directory = root + relative
        named, ids = struct.unpack_from('<HH', data, directory + 12)
        for i in range(named + ids):
            name, target = struct.unpack_from('<II', data, directory + 16 + i * 8)
            next_path = (*path, name)
            if target & 0x80000000:
                visit(target & 0x7fffffff, next_path)
            elif next_path[0] == 3:  # RT_ICON
                rva, size = struct.unpack_from('<II', data, root + target)
                start = offset(rva)
                icons.append(data[start:start + size])

    visit(0)
    return icons


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('executables', nargs='+', type=Path)
    parser.add_argument('--icon', type=Path, default=Path('src-tauri/icons/icon.ico'))
    args = parser.parse_args()
    digest = lambda frame: hashlib.sha256(frame).hexdigest()
    expected = {digest(frame) for frame in ico_frames(args.icon.read_bytes())}
    failed = False
    for path in args.executables:
        actual = {digest(frame) for frame in pe_icons(path.read_bytes())}
        matched = len(expected & actual)
        print(f'{path}: {matched}/{len(expected)} expected icon frames match')
        failed |= not expected.issubset(actual)
    raise SystemExit(1 if failed else 0)


if __name__ == '__main__':
    main()
