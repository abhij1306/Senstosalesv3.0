
import glob
import logging
import os

from backend.core.parsers.po_parser import extract_po_full
from backend.services.ingest_po import POIngestionService

logger = logging.getLogger(__name__)

def parse_po_directory(directory_path, db_conn):
    """
    Parses all HTML files in a directory and ingests them into the database.
    Used by the PSU automation pipeline.
    """
    ingest_service = POIngestionService()
    success_count = 0
    html_files = glob.glob(os.path.join(directory_path, "*.html"))
    
    total = len(html_files)
    logger.info(f"Starting bulk ingestion of {total} files from {directory_path}")

    for i, file_path in enumerate(html_files):
        if i % 100 == 0:
            logger.info(f"Progress: {i}/{total} files processed...")
            
        try:
            with open(file_path, encoding="utf-8", errors="ignore") as f:
                content = f.read()
            
            # Use the ROBUST full parser with validation
            result = extract_po_full(content)
            
            if not result["is_valid"]:
                logger.warning(f"Skipping {file_path}: Failed validation ({result['header'].get('PURCHASE ORDER')})")
                continue
                
            header = result["header"]
            items = result["items"]
                
            success, warnings, _ = ingest_service.ingest_po(db_conn, header, items)
            if success:
                success_count += 1
                # Only log every 100 on bulk to avoid flooding
                if i % 100 == 0:
                    logger.info(f"Successfully ingested {header.get('PURCHASE ORDER')}")
            else:
                logger.error(f"Failed to ingest {file_path}: {warnings}")

        except Exception as e:
            logger.error(f"Error parsing file {file_path}: {e}")
            continue
            
    # Final commit just in case, though ingest_service might not commit
    db_conn.commit()
    logger.info(f"Bulk ingestion complete. {success_count}/{total} files ingested.")
    return success_count
