"""
SQLAlchemy ORM models — the database schema.

Tables: accounts, departments, employees, activities, app_settings, absences.
Short 7-char hex ids keep URLs and logs compact. Cascading deletes mirror the
real-world hierarchy (delete a department -> its employees -> their activities).
"""
import uuid
from datetime import datetime, date as date_type
from typing import Optional
from sqlalchemy import String, ForeignKey, Date, Float, Integer, DateTime, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def _new_id() -> str:
    """Generate a short, unique primary key (first 7 hex chars of a UUID4)."""
    return uuid.uuid4().hex[:7]


class Account(Base):
    """The single login account (plus the virtual master account, which has no row)."""
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    user: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    # Argon2id hash only — the clear password is never stored.
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String, default="")


class Department(Base):
    """A workshop department; groups employees and carries a display colour."""
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)  # CSS colour string
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    # Deleting a department cascades to its employees (and onward to activities).
    employees: Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="department", cascade="all, delete-orphan"
    )


class Employee(Base):
    """A person belonging to one department, with daily activities and absences."""
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="")
    department_id: Mapped[str] = mapped_column(
        String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    # ISO date (YYYY-MM-DD) the employee was dismissed; from this day onward they
    # are shown as "licenziato" in every view. NULL = currently employed.
    terminated_from: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    department: Mapped["Department"] = relationship("Department", back_populates="employees")
    activities: Mapped[list["Activity"]] = relationship(
        "Activity", back_populates="employee", cascade="all, delete-orphan"
    )
    absences: Mapped[list["Absence"]] = relationship(
        "Absence", back_populates="employee", cascade="all, delete-orphan"
    )


class Activity(Base):
    """One planned task for an employee on a given day (id supplied by the client)."""
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        String, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    activity: Mapped[str] = mapped_column(String, nullable=False)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(String, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)  # preserves row order in the UI

    employee: Mapped["Employee"] = relationship("Employee", back_populates="activities")


class AppSettings(Base):
    """Simple key/value store for global toggles (e.g. saturday_half_day)."""
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False, default="")


class Absence(Base):
    """A whole-day absence for an employee. 'licenziato' is NOT stored here — it is
    derived from Employee.terminated_from, so the CHECK constraint stays limited to
    the three real absence types."""
    __tablename__ = "absences"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    employee_id: Mapped[str] = mapped_column(
        String, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    type: Mapped[str] = mapped_column(
        String,
        CheckConstraint("type IN ('ferie', 'malattia', 'permesso')", name="ck_absence_type"),
        nullable=False,
    )

    employee: Mapped["Employee"] = relationship("Employee", back_populates="absences")

    # At most one absence row per employee per day.
    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_absence_emp_date"),
    )
