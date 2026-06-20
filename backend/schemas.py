from typing import Optional, Literal
from pydantic import BaseModel, Field


# --- Auth ---

class RegisterIn(BaseModel):
    user: str
    password: str
    company: str = ""


class LoginIn(BaseModel):
    user: str
    password: str


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"


class AuthStatusOut(BaseModel):
    registered: bool


class ChangePasswordIn(BaseModel):
    current: str
    new_password: str = Field(alias="next")

    model_config = {"populate_by_name": True}


class AccountOut(BaseModel):
    user: str
    company: str


# --- Department ---

class DepartmentIn(BaseModel):
    name: str
    color: str


class DepartmentOut(BaseModel):
    id: str
    name: str
    color: str

    model_config = {"from_attributes": True}


# --- Employee ---

class EmployeeIn(BaseModel):
    name: str
    role: str = ""
    departmentId: str
    overtime: str = ""


class EmployeePatch(BaseModel):
    name: Optional[str] = None
    role: Optional[str] = None
    departmentId: Optional[str] = None
    overtime: Optional[str] = None


class EmployeeOut(BaseModel):
    id: str
    name: str
    role: str
    departmentId: str
    overtime: str
    hasAvatar: bool = False


# --- Entries ---

class ActivityItem(BaseModel):
    id: str
    activity: str
    hours: float
    notes: str = ""


class PutEntriesIn(BaseModel):
    activities: list[ActivityItem]


class PutAbsenceIn(BaseModel):
    type: Optional[Literal["ferie", "malattia", "permesso"]] = None


class EntriesOut(BaseModel):
    entries: dict
    absences: dict


# --- Log ---

class LogEventIn(BaseModel):
    action: str
    details: dict = {}
