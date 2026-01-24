from enum import Enum


class AppException(Exception):
    """Base class for all application errors"""

    def __init__(
        self,
        message: str,
        error_code: str = "INTERNAL_ERROR",
        status_code: int = 500,
        details: dict = None,
    ):
        super().__init__(message)
        self.message = message
        self.error_code = error_code
        self.status_code = status_code
        self.details = details or {}


class ResourceNotFoundException(AppException):
    def __init__(self, resource: str, id: str):
        super().__init__(
            message=f"{resource} with id {id} not found",
            error_code="RESOURCE_NOT_FOUND",
            status_code=404,
        )


class BusinessRuleViolation(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            error_code="BUSINESS_RULE_VIOLATION",
            status_code=400,
            details=details,
        )


class AuthenticationError(AppException):
    def __init__(self, message: str = "Authentication failed"):
        super().__init__(message=message, error_code="AUTH_ERROR", status_code=401)


class AuthorizationError(AppException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(message=message, error_code="FORBIDDEN", status_code=403)


class InternalServerError(AppException):
    def __init__(self, message: str = "Internal server error"):
        super().__init__(message=message, error_code="INTERNAL_ERROR", status_code=500)


class InvalidOperationError(AppException):
    def __init__(self, message: str):
        super().__init__(message=message, error_code="INVALID_OPERATION", status_code=400)


class RateLimitExceeded(AppException):
    def __init__(self, message: str = "Rate limit exceeded"):
        super().__init__(message=message, error_code="RATE_LIMIT", status_code=429)


class AIserviceError(AppException):
    """Failures in LLM/STT services"""

    def __init__(self, message: str, provider: str = "unknown"):
        super().__init__(
            message=f"AI Service Failure ({provider}): {message}",
            error_code="AI_SERVICE_ERROR",
            status_code=503,
        )


# --- Legacy Exceptions (for backward compatibility) ---
class ValidationError(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(
            message=message,
            error_code="VALIDATION_ERROR",
            status_code=400,
            details=details,
        )


class ConflictError(AppException):
    def __init__(self, message: str, details: dict = None):
        super().__init__(message=message, error_code="CONFLICT", status_code=409, details=details)


ResourceNotFoundError = ResourceNotFoundException

# --- Compatibility Layer for Legacy Code (routers/dc.py etc) ---


class ErrorCode(str, Enum):
    INTERNAL_ERROR = "INTERNAL_ERROR"
    NOT_FOUND = "NOT_FOUND"
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND"
    VALIDATION_ERROR = "VALIDATION_ERROR"
    BUSINESS_RULE_VIOLATION = "BUSINESS_RULE_VIOLATION"
    CONFLICT = "CONFLICT"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    OVER_DISPATCH = "OVER_DISPATCH"
    DC_LOCKED = "DC_LOCKED"
    DUPLICATE_NUMBER = "DUPLICATE_NUMBER"
    INSUFFICIENT_INVENTORY = "INSUFFICIENT_INVENTORY"
    FILE_TYPE_INVALID = "FILE_TYPE_INVALID"
    PARSE_ERROR = "PARSE_ERROR"


class DomainError(AppException):
    def __init__(self, message: str, error_code: ErrorCode, details: dict = None):
        super().__init__(
            message=message,
            error_code=error_code.value,
            status_code=500,  # Will be mapped by map_error_code_to_http_status
            details=details,
        )
        self.original_error_code = error_code


def map_error_code_to_http_status(error_code: ErrorCode) -> int:
    if error_code == ErrorCode.NOT_FOUND:
        return 404
    elif error_code in (ErrorCode.VALIDATION_ERROR, ErrorCode.BUSINESS_RULE_VIOLATION):
        return 400
    elif error_code == ErrorCode.CONFLICT:
        return 409
    elif error_code == ErrorCode.UNAUTHORIZED:
        return 401
    return 500
