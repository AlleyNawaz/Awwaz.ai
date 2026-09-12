from typing import Any, Optional
from fastapi import HTTPException, status


class ErrorCode:
    VALIDATION_ERROR = "VALIDATION_ERROR"
    UNAUTHORIZED = "UNAUTHORIZED"
    FORBIDDEN = "FORBIDDEN"
    NOT_FOUND = "NOT_FOUND"
    CONFLICT = "CONFLICT"
    INVALID_STATE_TRANSITION = "INVALID_STATE_TRANSITION"
    RATE_LIMITED = "RATE_LIMITED"
    AI_UNAVAILABLE = "AI_UNAVAILABLE"
    AI_INVALID_OUTPUT = "AI_INVALID_OUTPUT"
    EXTERNAL_SERVICE_UNAVAILABLE = "EXTERNAL_SERVICE_UNAVAILABLE"
    ACTION_ALREADY_EXECUTED = "ACTION_ALREADY_EXECUTED"
    STORAGE_FAILURE = "STORAGE_FAILURE"
    INTERNAL_ERROR = "INTERNAL_ERROR"


class AwwazException(HTTPException):
    def __init__(
        self,
        code: str,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        details: Optional[Any] = None,
    ):
        self.code = code
        self.message = message
        self.details = details
        super().__init__(status_code=status_code, detail=message)


class ValidationException(AwwazException):
    def __init__(self, message: str = "Invalid request payload", details: Optional[Any] = None):
        super().__init__(
            code=ErrorCode.VALIDATION_ERROR,
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            details=details,
        )


class UnauthorizedException(AwwazException):
    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            code=ErrorCode.UNAUTHORIZED,
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenException(AwwazException):
    def __init__(self, message: str = "Permission denied"):
        super().__init__(
            code=ErrorCode.FORBIDDEN,
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
        )


class NotFoundException(AwwazException):
    def __init__(self, message: str = "Resource not found"):
        super().__init__(
            code=ErrorCode.NOT_FOUND,
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
        )


class ConflictException(AwwazException):
    def __init__(self, message: str = "State conflict or concurrency version mismatch"):
        super().__init__(
            code=ErrorCode.CONFLICT,
            message=message,
            status_code=status.HTTP_409_CONFLICT,
        )


class InvalidStateTransitionException(AwwazException):
    def __init__(self, current_state: str, target_state: str):
        super().__init__(
            code=ErrorCode.INVALID_STATE_TRANSITION,
            message=f"Cannot transition complaint from '{current_state}' to '{target_state}'",
            status_code=status.HTTP_400_BAD_REQUEST,
        )


class ActionAlreadyExecutedException(AwwazException):
    def __init__(self, message: str = "Action has already been executed"):
        super().__init__(
            code=ErrorCode.ACTION_ALREADY_EXECUTED,
            message=message,
            status_code=status.HTTP_409_CONFLICT,
        )


class ExternalServiceUnavailableException(AwwazException):
    def __init__(self, message: str = "External civic service currently unavailable"):
        super().__init__(
            code=ErrorCode.EXTERNAL_SERVICE_UNAVAILABLE,
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
