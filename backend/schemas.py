from typing import Optional, Literal
from pydantic import BaseModel, Field


# --- Auth ---

class RegisterIn(BaseModel):
    user: str = Field(min_length=1, max_length=50)
    password: str = Field(min_length=6, max_length=128)
    company: str = Field(min_length=1, max_length=100)


class LoginIn(BaseModel):
    user: str = Field(max_length=50)
    password: str = Field(max_length=128)


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
    name: str = Field(max_length=80)
    color: str = Field(max_length=30)


class DepartmentOut(BaseModel):
    id: str
    name: str
    color: str

    model_config = {"from_attributes": True}


# --- Employee ---

class EmployeeIn(BaseModel):
    name: str = Field(max_length=80)
    role: str = Field(default="", max_length=80)
    departmentId: str = Field(max_length=20)
    overtime: str = Field(default="", max_length=10)


class EmployeePatch(BaseModel):
    name: Optional[str] = Field(default=None, max_length=80)
    role: Optional[str] = Field(default=None, max_length=80)
    departmentId: Optional[str] = Field(default=None, max_length=20)
    overtime: Optional[str] = Field(default=None, max_length=10)


class EmployeeOut(BaseModel):
    id: str
    name: str
    role: str
    departmentId: str
    overtime: str
    hasAvatar: bool = False


# --- Entries ---

class ActivityItem(BaseModel):
    id: str = Field(max_length=40)
    activity: str = Field(max_length=200)
    hours: float
    notes: str = Field(default="", max_length=1000)


class PutEntriesIn(BaseModel):
    activities: list[ActivityItem]


class PutAbsenceIn(BaseModel):
    type: Optional[Literal["ferie", "malattia", "permesso"]] = None


class EntriesOut(BaseModel):
    entries: dict
    absences: dict


# --- Settings ---

class SettingsOut(BaseModel):
    saturday_half_day: bool = False


class SettingsPatch(BaseModel):
    saturday_half_day: Optional[bool] = None


# --- Log ---

class LogEventIn(BaseModel):
    message: str = Field(default="", max_length=500)
    action: str = Field(default="", max_length=200)
    details: dict = {}


class LogPublicEventIn(BaseModel):
    action: str = Field(default="", max_length=200)
