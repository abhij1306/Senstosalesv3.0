
import logging

from backend.db.session import get_connection

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def clean_rc_numbers():
    conn = get_connection()
    try:
        cursor = conn.cursor()
        
        # Check count before
        logger.info("Checking for garbage RC Numbers...")
        
        # Patterns identified from user feedback
        garbage_patterns = [
            '%ORDER DETAILS%', 
            '%HASE%', 
            '%SRV%',
            '%PURCHASE ORDER%'
        ]
        
        total_cleaned = 0
        
        for pattern in garbage_patterns:
            cursor.execute("SELECT COUNT(*) FROM purchase_orders WHERE rc_no LIKE ?", (pattern,))
            count = cursor.fetchone()[0]
            if count > 0:
                logger.info(f"Found {count} rows matching pattern '{pattern}'")
                
                cursor.execute("UPDATE purchase_orders SET rc_no = NULL WHERE rc_no LIKE ?", (pattern,))
                total_cleaned += cursor.rowcount
                
        conn.commit()
        
        if total_cleaned > 0:
            logger.info(f"SUCCESS: Cleaned {total_cleaned} Purchase Orders with invalid RC Numbers.")
        else:
            logger.info("No garbage RC Numbers found. Database is clean.")
            
    except Exception as e:
        logger.error(f"Error cleaning RC numbers: {e}")
        conn.rollback()
    finally:
        conn.close()

if __name__ == "__main__":
    clean_rc_numbers()
