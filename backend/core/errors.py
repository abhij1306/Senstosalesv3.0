"""
Centralized Error Handling System
All routers MUST use these helpers instead of raw HTTPException
"""

import logging

from fastapi import HTTPException

logger = logging.getLogger(__name__)


def bad_request(message: str, log_details: str | None = None) -> HTTPException:
    """
    400 Bad Request - Client sent invalid data
    Use for: validation failures, missing required fields, invalid formats
    """
    if log_details:
        logger.warning(f"Bad Request: {message} | Details: {log_details}")
    else:
        logger.warning(f"Bad Request: {message}")

    return HTTPException(status_code=400, detail=message)


def not_found(message: str, resource_type: str | None = None) -> HTTPException:
    """
    404 Not Found - Resource doesn't exist
    Use for: PO not found, DC not found, Invoice not found
    """
    if resource_type:
        logger.info(f"Not Found ({resource_type}): {message}")
    else:
        logger.info(f"Not Found: {message}")

    return HTTPException(status_code=404, detail=message)


def conflict(message: str, log_details: str | None = None) -> HTTPException:
    """
    409 Conflict - Request conflicts with current state
    Use for: duplicate entries, constraint violations, business rule violations
    """
    if log_details:
        logger.warning(f"Conflict: {message} | Details: {log_details}")
    else:
        logger.warning(f"Conflict: {message}")

    return HTTPException(status_code=409, detail=message)


def internal_error(message: str, exception: Exception | None = None) -> HTTPException:
    """
    500 Internal Server Error - Unexpected server error
    Use for: database errors, unexpected exceptions
    """
    if exception:
        logger.error(f"Internal Error: {message}", exc_info=exception)
    else:
        logger.error(f"Internal Error: {message}")

    return HTTPException(status_code=500, detail=message)


def forbidden(message: str, reason: str | None = None) -> HTTPException:
    """
    403 Forbidden - Operation not allowed
    Use for: editing DC with invoice, deleting protected resources
    """
    if reason:
        logger.warning(f"Forbidden: {message} | Reason: {reason}")
    else:
        logger.warning(f"Forbidden: {message}")

    return HTTPException(status_code=403, detail=message)
