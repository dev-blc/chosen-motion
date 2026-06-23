"""Resolve Patient records from Supabase JWT identity (sub) vs local id/auth_user_id."""
from __future__ import annotations

import uuid
from typing import Optional, Union

from fastapi import HTTPException, status
from sqlalchemy import or_
from sqlalchemy.orm import Session

from app.core.security import UserPayload
from app.models.models import Patient, User

AuthId = Union[uuid.UUID, str]


def to_uuid(value: AuthId) -> Optional[uuid.UUID]:
    try:
        return uuid.UUID(str(value))
    except (ValueError, TypeError):
        return None


def resolve_patient_for_user(
    current_user: UserPayload,
    db: Session,
    *,
    link_auth: bool = True,
) -> Optional[Patient]:
    """
    Find a patient for the authenticated Supabase user.

    JWT `sub` is the Supabase auth user id and maps to `auth_user_id` in our tables.
    Some legacy/admin-created rows may store the internal `users.id` or only match by email;
    this resolver checks all common cases and optionally relinks `auth_user_id`.
    """
    uid = to_uuid(current_user.id)
    if not uid:
        return None

    # 1. Direct match on patient auth_user_id or internal patient id
    patient = db.query(Patient).filter(
        or_(Patient.auth_user_id == uid, Patient.id == uid)
    ).first()
    if patient:
        return _ensure_patient_auth_link(patient, uid, db, link_auth)

    # 2. Resolve through users table (auth_user_id vs internal users.id)
    user = db.query(User).filter(
        or_(User.auth_user_id == uid, User.id == uid)
    ).first()

    if user:
        patient = db.query(Patient).filter(
            or_(
                Patient.auth_user_id == user.auth_user_id,
                Patient.id == user.auth_user_id,
                Patient.email == user.email,
            )
        ).first()
        if patient:
            return _ensure_patient_auth_link(patient, user.auth_user_id, db, link_auth)

    # 3. Email fallback using JWT email claim
    if current_user.email:
        patient = db.query(Patient).filter(
            Patient.email.ilike(str(current_user.email))
        ).first()
        if patient:
            return _ensure_patient_auth_link(patient, uid, db, link_auth)

    return None


def _ensure_patient_auth_link(
    patient: Patient,
    auth_user_id: uuid.UUID,
    db: Session,
    link_auth: bool,
) -> Patient:
    if link_auth and patient.auth_user_id != auth_user_id:
        patient.auth_user_id = auth_user_id
        db.commit()
        db.refresh(patient)
    return patient


def get_patient_for_user(
    current_user: UserPayload,
    db: Session,
    *,
    link_auth: bool = True,
) -> Patient:
    patient = resolve_patient_for_user(current_user, db, link_auth=link_auth)
    if not patient:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Patient profile not found.",
        )
    return patient
