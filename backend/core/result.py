from typing import Generic, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class ServiceResult(BaseModel, Generic[T]):
    """
    Standardized result container for Service Layer operations.
    Enforces explicit success/failure handling in Routers.
    """

    success: bool
    data: T | None = None
    error_code: str = ""
    message: str = ""

    @classmethod
    def ok(cls, data: T) -> "ServiceResult[T]":
        return cls(success=True, data=data)

    @classmethod
    def fail(cls, message: str, error_code: str = "ERROR") -> "ServiceResult[T]":
        return cls(success=False, message=message, error_code=error_code)

    @property
    def value(self) -> T:
        """Unsafe access to data - raises ValueError if failure"""
        if not self.success:
            raise ValueError(f"Cannot access data of failed result: {self.message}")
        return self.data
