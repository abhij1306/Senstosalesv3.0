import functools
import logging
import os

# Set environment variable BEFORE any multipart imports
os.environ["MULTIPART_MAX_FILES"] = "5000"
os.environ["MULTIPART_MAX_FIELDS"] = "5000"

logger = logging.getLogger("app.core.multipart_fix")


def apply_multipart_fix():
    """
    Patch starlette's MultiPartParser to increase file upload limits.
    The limit is set as a default parameter in __init__, so we need to wrap the init method.
    """
    logger.debug("Applying multipart fix...")
    try:
        # Patch Starlette's MultiPartParser
        from starlette.formparsers import MultiPartParser

        # Get the original __init__ method
        original_init = MultiPartParser.__init__

        # Create a wrapper that changes the default max_files parameter
        @functools.wraps(original_init)
        def patched_init(self, headers, stream, max_files=5000, max_fields=5000):
            # Call original init with our new defaults
            return original_init(self, headers, stream, max_files=max_files, max_fields=max_fields)

        # Replace the __init__ method
        MultiPartParser.__init__ = patched_init

        logger.info("Patched starlette.formparsers.MultiPartParser: max_files default 1000 -> 5000")

    except ImportError as e:
        logger.warning(f"Could not import starlette: {e}")
    except Exception as e:
        logger.warning(f"Error applying multipart fix: {e}", exc_info=True)


# Apply immediately on import
logger.debug("multipart_fix.py module loaded")
apply_multipart_fix()
logger.debug("multipart_fix.py initialization completed")
