#!/usr/bin/env python3
"""
Knowledge Base Ingestion Script

Extracts text from PDFs and EPUBs, chunks it, and stores in a SQLite FTS5
database for fast full-text search (BM25 ranking).

Usage:
    python scripts/ingest_knowledge.py /path/to/books [--output /path/to/knowledge.db]
    python scripts/ingest_knowledge.py --dedup /path/to/books   # Dedup mode: find duplicates

Runs locally or on the Pi. Generates a SQLite DB that the backend reads at runtime.
"""

import argparse
import hashlib
import os
import re
import sqlite3
import sys
import zipfile
from pathlib import Path
from collections import defaultdict

# --- Text Extraction ---

def extract_pdf_text(filepath: str) -> str:
    """Extract text from a PDF file using pdfplumber."""
    try:
        import pdfplumber
        text_parts = []
        with pdfplumber.open(filepath) as pdf:
            for page in pdf.pages:
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(page_text)
        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"  [WARN] Failed to extract PDF {filepath}: {e}")
        return ""


def extract_epub_text(filepath: str) -> str:
    """Extract text from an EPUB file (ZIP with HTML content)."""
    try:
        from bs4 import BeautifulSoup
        text_parts = []
        with zipfile.ZipFile(filepath, 'r') as zf:
            for name in zf.namelist():
                if name.endswith(('.html', '.xhtml', '.htm')):
                    try:
                        content = zf.read(name).decode('utf-8', errors='replace')
                        soup = BeautifulSoup(content, 'lxml')
                        # Remove script and style tags
                        for tag in soup(['script', 'style', 'nav']):
                            tag.decompose()
                        text = soup.get_text(separator='\n', strip=True)
                        if text and len(text) > 50:
                            text_parts.append(text)
                    except Exception:
                        pass
        return "\n\n".join(text_parts)
    except Exception as e:
        print(f"  [WARN] Failed to extract EPUB {filepath}: {e}")
        return ""


def extract_text(filepath: str) -> str:
    """Extract text from a file based on extension."""
    ext = Path(filepath).suffix.lower()
    if ext == '.pdf':
        return extract_pdf_text(filepath)
    elif ext == '.epub':
        return extract_epub_text(filepath)
    else:
        # Try reading as plain text
        try:
            with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
                return f.read()
        except Exception:
            return ""


# --- Text Chunking ---

def chunk_text(text: str, chunk_size: int = 1500, overlap: int = 200) -> list:
    """
    Split text into overlapping chunks of roughly chunk_size characters.
    Uses paragraph boundaries when possible.
    """
    if not text or len(text) < 100:
        return []

    # Clean up excessive whitespace
    text = re.sub(r'\n{3,}', '\n\n', text)
    text = re.sub(r' {3,}', ' ', text)

    paragraphs = text.split('\n\n')
    chunks = []
    current_chunk = ""

    for para in paragraphs:
        para = para.strip()
        if not para:
            continue

        if len(current_chunk) + len(para) + 2 <= chunk_size:
            current_chunk += ("\n\n" + para if current_chunk else para)
        else:
            if current_chunk:
                chunks.append(current_chunk.strip())
                # Overlap: keep last portion
                if overlap > 0 and len(current_chunk) > overlap:
                    current_chunk = current_chunk[-overlap:]
                else:
                    current_chunk = ""
            # If a single paragraph is larger than chunk_size, split it
            if len(para) > chunk_size:
                words = para.split()
                sub_chunk = ""
                for word in words:
                    if len(sub_chunk) + len(word) + 1 <= chunk_size:
                        sub_chunk += (" " + word if sub_chunk else word)
                    else:
                        if sub_chunk:
                            chunks.append(sub_chunk.strip())
                        sub_chunk = word
                if sub_chunk:
                    current_chunk = sub_chunk
            else:
                current_chunk += ("\n\n" + para if current_chunk else para)

    if current_chunk and len(current_chunk.strip()) > 50:
        chunks.append(current_chunk.strip())

    return chunks


# --- Category Detection ---

def detect_category(filepath: str, base_dir: str) -> str:
    """Detect category from directory structure."""
    rel_path = os.path.relpath(filepath, base_dir)
    parts = Path(rel_path).parts

    if len(parts) > 1:
        return parts[0].lower().replace(' ', '_')
    else:
        # Top-level file, guess from filename
        name = Path(filepath).stem.lower()
        if any(w in name for w in ['survival', 'army', 'military']):
            return 'survival'
        elif any(w in name for w in ['build', 'generator', 'motor']):
            return 'building'
        return 'general'


# --- Deduplication ---

def find_duplicates(source_dir: str):
    """Find duplicate files by MD5 hash and near-duplicate names."""
    print(f"\n=== Scanning for duplicates in {source_dir} ===\n")

    hash_map = defaultdict(list)
    name_map = defaultdict(list)
    empty_files = []
    total_files = 0

    for root, dirs, files in os.walk(source_dir):
        for fname in files:
            filepath = os.path.join(root, fname)
            total_files += 1

            # Check empty
            try:
                size = os.path.getsize(filepath)
                if size == 0:
                    empty_files.append(filepath)
                    continue
            except OSError:
                continue

            # Hash for exact duplicates
            try:
                h = hashlib.md5()
                with open(filepath, 'rb') as f:
                    for block in iter(lambda: f.read(8192), b''):
                        h.update(block)
                hash_map[h.hexdigest()].append(filepath)
            except Exception:
                pass

            # Normalize name for near-duplicates
            stem = Path(fname).stem.lower()
            # Remove (1), (2), (copy), -copy patterns
            stem = re.sub(r'\s*\(\d+\)\s*$', '', stem)
            stem = re.sub(r'\s*[-_]?copy\s*\d*\s*$', '', stem)
            stem = re.sub(r'\s+', '_', stem)
            name_map[stem].append(filepath)

    # Report exact duplicates
    exact_dupes = {h: paths for h, paths in hash_map.items() if len(paths) > 1}
    if exact_dupes:
        print(f"EXACT DUPLICATES ({len(exact_dupes)} groups):")
        for h, paths in exact_dupes.items():
            print(f"  Hash: {h[:12]}...")
            for p in paths:
                size = os.path.getsize(p) / 1024
                print(f"    - {os.path.relpath(p, source_dir)} ({size:.0f}KB)")
            print()
    else:
        print("No exact duplicates found.\n")

    # Report near-duplicate names
    near_dupes = {n: paths for n, paths in name_map.items() if len(paths) > 1}
    # Filter out ones already caught as exact dupes
    if near_dupes:
        print(f"NEAR-DUPLICATE NAMES ({len(near_dupes)} groups):")
        for name, paths in near_dupes.items():
            print(f"  Base name: {name}")
            for p in paths:
                size = os.path.getsize(p) / 1024
                print(f"    - {os.path.relpath(p, source_dir)} ({size:.0f}KB)")
            print()
    else:
        print("No near-duplicate names found.\n")

    # Report empty files
    if empty_files:
        print(f"EMPTY FILES ({len(empty_files)}):")
        for p in empty_files:
            print(f"  - {os.path.relpath(p, source_dir)}")
        print()

    # Directory summary
    print(f"SUMMARY:")
    print(f"  Total files: {total_files}")
    print(f"  Exact duplicate groups: {len(exact_dupes)}")
    print(f"  Near-duplicate name groups: {len(near_dupes)}")
    print(f"  Empty files: {len(empty_files)}")

    # Count by category
    categories = defaultdict(int)
    for root, dirs, files in os.walk(source_dir):
        for fname in files:
            cat = detect_category(os.path.join(root, fname), source_dir)
            categories[cat] += 1

    print(f"\n  Categories:")
    for cat, count in sorted(categories.items()):
        print(f"    {cat}: {count} files")

    return exact_dupes, near_dupes, empty_files


def remove_duplicates(source_dir: str, exact_dupes: dict, empty_files: list):
    """Remove duplicate and empty files, keeping the first of each group."""
    removed = 0

    for h, paths in exact_dupes.items():
        # Keep the first file (shortest path), remove the rest
        paths_sorted = sorted(paths, key=lambda p: len(p))
        for p in paths_sorted[1:]:
            try:
                os.remove(p)
                print(f"  Removed duplicate: {os.path.relpath(p, source_dir)}")
                removed += 1
            except OSError as e:
                print(f"  Failed to remove {p}: {e}")

    for p in empty_files:
        try:
            os.remove(p)
            print(f"  Removed empty: {os.path.relpath(p, source_dir)}")
            removed += 1
        except OSError as e:
            print(f"  Failed to remove {p}: {e}")

    print(f"\nRemoved {removed} files.")
    return removed


# --- Database Creation ---

def create_database(db_path: str):
    """Create the FTS5 knowledge base database."""
    conn = sqlite3.connect(db_path)
    cur = conn.cursor()

    # Drop existing tables for clean rebuild
    cur.execute("DROP TABLE IF EXISTS chunks")
    cur.execute("DROP TABLE IF EXISTS sources")
    cur.execute("DROP TABLE IF EXISTS metadata")

    # Source files table
    cur.execute("""
        CREATE TABLE sources (
            id INTEGER PRIMARY KEY,
            filepath TEXT NOT NULL,
            filename TEXT NOT NULL,
            category TEXT NOT NULL,
            chunk_count INTEGER DEFAULT 0,
            char_count INTEGER DEFAULT 0,
            extracted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)

    # FTS5 virtual table for full-text search with BM25 ranking
    cur.execute("""
        CREATE VIRTUAL TABLE chunks USING fts5(
            content,
            source_id UNINDEXED,
            source_file UNINDEXED,
            category,
            chunk_index UNINDEXED
        )
    """)

    # Metadata table
    cur.execute("""
        CREATE TABLE metadata (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)

    conn.commit()
    return conn


def ingest_directory(source_dir: str, db_path: str):
    """Walk directory, extract text, chunk, and store in FTS5 database."""
    print(f"\n=== Ingesting Knowledge Base ===")
    print(f"Source: {source_dir}")
    print(f"Output: {db_path}")

    # Collect all processable files
    extensions = {'.pdf', '.epub', '.txt', '.md'}
    files_to_process = []
    for root, dirs, files in os.walk(source_dir):
        # Skip hidden directories
        dirs[:] = [d for d in dirs if not d.startswith('.')]
        for fname in files:
            if Path(fname).suffix.lower() in extensions:
                files_to_process.append(os.path.join(root, fname))

    print(f"Found {len(files_to_process)} files to process\n")

    if not files_to_process:
        print("No files found to process!")
        return

    conn = create_database(db_path)
    cur = conn.cursor()

    total_chunks = 0
    total_chars = 0
    processed = 0
    failed = 0
    categories = defaultdict(int)

    for i, filepath in enumerate(sorted(files_to_process), 1):
        rel_path = os.path.relpath(filepath, source_dir)
        filename = Path(filepath).name
        category = detect_category(filepath, source_dir)

        print(f"  [{i}/{len(files_to_process)}] {rel_path}...", end=" ", flush=True)

        text = extract_text(filepath)
        if not text or len(text) < 100:
            print("SKIP (no text)")
            failed += 1
            continue

        chunks = chunk_text(text)
        if not chunks:
            print("SKIP (no chunks)")
            failed += 1
            continue

        # Insert source record
        cur.execute(
            "INSERT INTO sources (filepath, filename, category, chunk_count, char_count) VALUES (?, ?, ?, ?, ?)",
            (rel_path, filename, category, len(chunks), len(text))
        )
        source_id = cur.lastrowid

        # Insert chunks into FTS5
        for idx, chunk in enumerate(chunks):
            cur.execute(
                "INSERT INTO chunks (content, source_id, source_file, category, chunk_index) VALUES (?, ?, ?, ?, ?)",
                (chunk, str(source_id), filename, category, str(idx))
            )

        total_chunks += len(chunks)
        total_chars += len(text)
        categories[category] += 1
        processed += 1
        print(f"OK ({len(chunks)} chunks, {len(text):,} chars)")

    # Store metadata
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("source_dir", source_dir))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("total_files", str(processed)))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("total_chunks", str(total_chunks)))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("total_chars", str(total_chars)))
    cur.execute("INSERT INTO metadata (key, value) VALUES (?, ?)", ("ingested_at", str(__import__('datetime').datetime.now().isoformat())))

    conn.commit()
    conn.close()

    # Report
    db_size = os.path.getsize(db_path) / (1024 * 1024)
    print(f"\n=== Ingestion Complete ===")
    print(f"  Processed: {processed} files ({failed} failed)")
    print(f"  Chunks: {total_chunks:,}")
    print(f"  Characters: {total_chars:,}")
    print(f"  Database size: {db_size:.1f} MB")
    print(f"\n  Categories:")
    for cat, count in sorted(categories.items()):
        print(f"    {cat}: {count} files")
    print(f"\n  Database saved to: {db_path}")


# --- Main ---

def main():
    parser = argparse.ArgumentParser(description="Knowledge Base Ingestion")
    parser.add_argument("source_dir", help="Directory containing PDFs and EPUBs")
    parser.add_argument("--output", "-o", default=None, help="Output database path (default: <source_dir>/knowledge.db)")
    parser.add_argument("--dedup", action="store_true", help="Scan for duplicates and report")
    parser.add_argument("--dedup-clean", action="store_true", help="Remove exact duplicates and empty files")

    args = parser.parse_args()

    source_dir = os.path.abspath(args.source_dir)
    if not os.path.isdir(source_dir):
        print(f"Error: {source_dir} is not a directory")
        sys.exit(1)

    if args.dedup or args.dedup_clean:
        exact, near, empty = find_duplicates(source_dir)
        if args.dedup_clean and (exact or empty):
            print(f"\n--- Cleaning duplicates ---")
            remove_duplicates(source_dir, exact, empty)
        return

    output_path = args.output or os.path.join(source_dir, "knowledge.db")
    ingest_directory(source_dir, output_path)


if __name__ == "__main__":
    main()
