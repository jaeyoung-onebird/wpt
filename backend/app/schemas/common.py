from typing import Generic, TypeVar
from pydantic import BaseModel

T = TypeVar("T")


class PaginatedResponse(BaseModel, Generic[T]):
    """Generic paginated response"""
    items: list[T]
    total: int
    page: int
    size: int
    pages: int


class MessageResponse(BaseModel):
    """Simple message response"""
    message: str


class IdResponse(BaseModel):
    """Response with just an ID"""
    id: str
