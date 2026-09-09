from pydantic import BaseModel


class NotificationOut(BaseModel):
    id: int
    kind: str
    title: str
    message: str
    link: str | None
    is_read: bool
    created_at: str


class NotificationCountOut(BaseModel):
    unread: int
