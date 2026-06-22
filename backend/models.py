import uuid
from datetime import datetime, date as date_type
from sqlalchemy import String, ForeignKey, Date, Float, Integer, DateTime, UniqueConstraint, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .database import Base


def _new_id() -> str:
    return uuid.uuid4().hex[:7]


class Account(Base):
    __tablename__ = "accounts"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    user: Mapped[str] = mapped_column(String, unique=True, nullable=False)
    password_hash: Mapped[str] = mapped_column(String, nullable=False)
    company: Mapped[str] = mapped_column(String, default="")


class Department(Base):
    __tablename__ = "departments"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    color: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    employees: Mapped[list["Employee"]] = relationship(
        "Employee", back_populates="department", cascade="all, delete-orphan"
    )


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_new_id)
    name: Mapped[str] = mapped_column(String, nullable=False)
    role: Mapped[str] = mapped_column(String, default="")
    department_id: Mapped[str] = mapped_column(
        String, ForeignKey("departments.id", ondelete="CASCADE"), nullable=False
    )
    overtime_hours: Mapped[float] = mapped_column(Float, default=0.0)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    department: Mapped["Department"] = relationship("Department", back_populates="employees")
    activities: Mapped[list["Activity"]] = relationship(
        "Activity", back_populates="employee", cascade="all, delete-orphan"
    )
    absences: Mapped[list["Absence"]] = relationship(
        "Absence", back_populates="employee", cascade="all, delete-orphan"
    )


class Activity(Base):
    __tablename__ = "activities"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    employee_id: Mapped[str] = mapped_column(
        String, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False
    )
    date: Mapped[date_type] = mapped_column(Date, nullable=False)
    activity: Mapped[str] = mapped_column(String, nullable=False)
    hours: Mapped[float] = mapped_column(Float, nullable=False)
    notes: Mapped[str] = mapped_column(String, default="")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    employee: Mapped["Employee"] = relationship("Employee", back_populates="activities")


class AppSettings(Base):
    __tablename__ = "app_settings"

    key: Mapped[str] = mapped_column(String, primary_key=True)
    value: Mapped[str] = mapped_column(String, nullable=False, default="")


class Absence(Base):
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

    __table_args__ = (
        UniqueConstraint("employee_id", "date", name="uq_absence_emp_date"),
    )
