import uuid
import requests
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from app.core.database import get_db
from app.core.security import get_current_user, UserPayload
from app.core.config import settings
from app.models.models import User, Patient, Admin
from app.schemas.schemas import (
    UserResponse, 
    UserCreate, 
    UserSignUpRequest, 
    UserLoginRequest, 
    TokenResponse,
    AdminProfileResponse
)

router = APIRouter()

def get_supabase_auth_url() -> str:
    url = settings.SUPABASE_URL.strip()
    if url.endswith("/rest/v1/"):
        return url.replace("/rest/v1/", "/auth/v1")
    elif url.endswith("/rest/v1"):
        return url.replace("/rest/v1", "/auth/v1")
    return f"{url}/auth/v1"

def generate_patient_id(db: Session) -> str:
    if "sqlite" in str(db.bind.url):
        # SQLite fallback for testing
        max_id_row = db.execute(text("SELECT patient_id FROM patients ORDER BY patient_id DESC LIMIT 1")).first()
        start_num = 1
        if max_id_row and max_id_row[0]:
            try:
                start_num = int(max_id_row[0].replace("PAT-", "")) + 1
            except ValueError:
                pass
        while True:
            candidate = f"PAT-{start_num:06d}"
            exists = db.query(Patient).filter(Patient.patient_id == candidate).first()
            if not exists:
                return candidate
            start_num += 1
    else:
        # PostgreSQL sequence
        try:
            db.execute(text("CREATE SEQUENCE IF NOT EXISTS patient_id_seq START 1;"))
            db.commit()
        except Exception:
            pass
        while True:
            next_val = db.execute(text("SELECT nextval('patient_id_seq')")).scalar()
            candidate = f"PAT-{next_val:06d}"
            exists = db.query(Patient).filter(Patient.patient_id == candidate).first()
            if not exists:
                return candidate

def generate_admin_id(db: Session) -> str:
    if "sqlite" in str(db.bind.url):
        # SQLite fallback for testing
        max_id_row = db.execute(text("SELECT admin_id FROM admins ORDER BY admin_id DESC LIMIT 1")).first()
        start_num = 1
        if max_id_row and max_id_row[0]:
            try:
                start_num = int(max_id_row[0].replace("ADM-", "")) + 1
            except ValueError:
                pass
        while True:
            candidate = f"ADM-{start_num:06d}"
            exists = db.query(Admin).filter(Admin.admin_id == candidate).first()
            if not exists:
                return candidate
            start_num += 1
    else:
        # PostgreSQL sequence
        try:
            db.execute(text("CREATE SEQUENCE IF NOT EXISTS admin_id_seq START 1;"))
            db.commit()
        except Exception:
            pass
        while True:
            next_val = db.execute(text("SELECT nextval('admin_id_seq')")).scalar()
            candidate = f"ADM-{next_val:06d}"
            exists = db.query(Admin).filter(Admin.admin_id == candidate).first()
            if not exists:
                return candidate

@router.get("/me", response_model=UserResponse)
def get_my_profile(
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current logged in user's profile from local database.
    """
    try:
        current_user_uuid = uuid.UUID(str(current_user.id))
    except (ValueError, TypeError):
        current_user_uuid = current_user.id
    db_user = db.query(User).filter(User.auth_user_id == current_user_uuid).first()
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User profile not synced. Call /auth/sync first."
        )
    return db_user

@router.post("/sync", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def sync_user(
    user_data: UserCreate,
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Sync Supabase Auth user record into local PostgreSQL database.
    Creates Patient or Admin sub-profile records depending on user role.
    """
    resolved_id = user_data.auth_user_id or user_data.id
    if not resolved_id:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Missing auth_user_id or id in request."
        )

    if str(current_user.id) != str(resolved_id):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot sync profiles for other users."
        )

    try:
        resolved_uuid = uuid.UUID(str(resolved_id))
    except (ValueError, TypeError):
        resolved_uuid = resolved_id

    # Check if user already exists
    db_user = db.query(User).filter(User.auth_user_id == resolved_uuid).first()
    if db_user:
        db_user.role = user_data.role
        db.commit()
        db.refresh(db_user)
        return db_user

    # Create new User
    new_user = User(
        auth_user_id=resolved_uuid,
        email=user_data.email,
        role=user_data.role
    )
    db.add(new_user)
    db.flush()

    # Create role-specific profile if missing
    if user_data.role.lower() == "admin":
        db_admin = db.query(Admin).filter(
            (Admin.auth_user_id == new_user.auth_user_id) | (Admin.email == new_user.email)
        ).first()
        if not db_admin:
            admin_id = generate_admin_id(db)
            admin_profile = Admin(
                admin_id=admin_id,
                auth_user_id=new_user.auth_user_id,
                email=new_user.email,
                full_name="Administrator"
            )
            db.add(admin_profile)
    else:
        db_patient = db.query(Patient).filter(
            (Patient.auth_user_id == new_user.auth_user_id) | (Patient.email == new_user.email)
        ).first()
        if not db_patient:
            patient_id = generate_patient_id(db)
            patient_profile = Patient(
                patient_id=patient_id,
                auth_user_id=new_user.auth_user_id,
                email=new_user.email,
                full_name="Patient"
            )
            db.add(patient_profile)

    db.commit()
    db.refresh(new_user)
    return new_user

@router.post("/signup", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def sign_up_user(
    req: UserSignUpRequest,
    db: Session = Depends(get_db)
):
    """
    Idempotently sign up a new user (admin or patient) through Supabase Auth and create a PostgreSQL profile.
    """
    # Verify email is not already taken in local Postgres DB
    existing_user = db.query(User).filter(User.email == req.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email address already exists."
        )

    auth_url = get_supabase_auth_url()
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": req.email,
        "password": req.password,
        "options": {
            "data": {
                "role": req.role,
                "full_name": req.full_name
            }
        }
    }
    
    resp = requests.post(f"{auth_url}/signup", json=payload, headers=headers)
    if resp.status_code not in (200, 201):
        err_detail = resp.json().get("msg") or resp.json().get("error_description") or "Sign up failed"
        raise HTTPException(status_code=resp.status_code, detail=err_detail)

    resp_data = resp.json()
    user_data = resp_data.get("user")
    if not user_data:
        raise HTTPException(status_code=500, detail="Supabase registration did not return user info.")

    auth_user_id = uuid.UUID(user_data.get("id"))

    # Create/Update User in Postgres
    db_user = db.query(User).filter(User.auth_user_id == auth_user_id).first()
    if not db_user:
        # Check by email (self-healing for admin-created profile)
        db_user = db.query(User).filter(User.email == req.email).first()
        if db_user:
            db_user.auth_user_id = auth_user_id
            db_user.role = req.role
        else:
            db_user = User(
                auth_user_id=auth_user_id,
                email=req.email,
                role=req.role
            )
            db.add(db_user)
        db.flush()

    patient_id = None
    admin_id = None

    if req.role.lower() == "admin":
        db_admin = db.query(Admin).filter(
            (Admin.auth_user_id == auth_user_id) | (Admin.email == req.email)
        ).first()
        if not db_admin:
            admin_id = generate_admin_id(db)
            db_admin = Admin(
                admin_id=admin_id,
                auth_user_id=auth_user_id,
                email=req.email,
                full_name=req.full_name
            )
            db.add(db_admin)
        else:
            db_admin.auth_user_id = auth_user_id
            db_admin.full_name = req.full_name
            admin_id = db_admin.admin_id
        db.commit()
    else:
        db_patient = db.query(Patient).filter(
            (Patient.auth_user_id == auth_user_id) | (Patient.email == req.email)
        ).first()
        if not db_patient:
            patient_id = generate_patient_id(db)
            db_patient = Patient(
                patient_id=patient_id,
                auth_user_id=auth_user_id,
                email=req.email,
                full_name=req.full_name,
                gender=req.gender,
                phone=req.phone,
                date_of_birth=req.date_of_birth
            )
            db.add(db_patient)
        else:
            db_patient.auth_user_id = auth_user_id
            db_patient.full_name = req.full_name
            if req.gender:
                db_patient.gender = req.gender
            if req.phone:
                db_patient.phone = req.phone
            if req.date_of_birth:
                db_patient.date_of_birth = req.date_of_birth
            patient_id = db_patient.patient_id
        db.commit()

    return TokenResponse(
        access_token=resp_data.get("access_token") or "",
        refresh_token=resp_data.get("refresh_token"),
        token_type=resp_data.get("token_type") or "bearer",
        user_id=str(auth_user_id),
        role=req.role,
        patient_id=patient_id,
        admin_id=admin_id
    )

@router.post("/login", response_model=TokenResponse)
def login_user(
    req: UserLoginRequest,
    db: Session = Depends(get_db)
):
    """
    Authenticate user via Supabase, performing automatic self-healing for missing DB records.
    """
    auth_url = get_supabase_auth_url()
    headers = {
        "apikey": settings.SUPABASE_ANON_KEY,
        "Content-Type": "application/json"
    }
    payload = {
        "email": req.email,
        "password": req.password
    }
    
    resp = requests.post(f"{auth_url}/token?grant_type=password", json=payload, headers=headers)
    if resp.status_code not in (200, 201):
        err_detail = resp.json().get("error_description") or resp.json().get("msg") or "Invalid login credentials"
        raise HTTPException(status_code=resp.status_code, detail=err_detail)

    resp_data = resp.json()
    user_data = resp_data.get("user")
    if not user_data:
        raise HTTPException(status_code=500, detail="Supabase login did not return user info.")

    auth_user_id = uuid.UUID(user_data.get("id"))
    user_metadata = user_data.get("user_metadata", {})
    role = user_metadata.get("role") or "patient"
    full_name = user_metadata.get("full_name") or "User"

    # Sync User
    db_user = db.query(User).filter(User.auth_user_id == auth_user_id).first()
    if not db_user:
        # Check by email (self-healing for admin-created profile)
        db_user = db.query(User).filter(User.email == req.email).first()
        if db_user:
            db_user.auth_user_id = auth_user_id
            db_user.role = role
        else:
            db_user = User(
                auth_user_id=auth_user_id,
                email=req.email,
                role=role
            )
            db.add(db_user)
        db.flush()
    else:
        role = db_user.role

    patient_id = None
    admin_id = None

    if role.lower() == "admin":
        db_admin = db.query(Admin).filter(
            (Admin.auth_user_id == auth_user_id) | (Admin.email == req.email)
        ).first()
        if not db_admin:
            admin_id = generate_admin_id(db)
            db_admin = Admin(
                admin_id=admin_id,
                auth_user_id=auth_user_id,
                email=req.email,
                full_name=full_name
            )
            db.add(db_admin)
            db.commit()
            db.refresh(db_admin)
        else:
            db_admin.auth_user_id = auth_user_id
            db.commit()
            admin_id = db_admin.admin_id
    else:
        db_patient = db.query(Patient).filter(
            (Patient.auth_user_id == auth_user_id) | (Patient.email == req.email)
        ).first()
        if not db_patient:
            patient_id = generate_patient_id(db)
            db_patient = Patient(
                patient_id=patient_id,
                auth_user_id=auth_user_id,
                email=req.email,
                full_name=full_name,
                gender=user_metadata.get("gender"),
                phone=user_metadata.get("phone"),
                date_of_birth=None
            )
            db.add(db_patient)
            db.commit()
            db.refresh(db_patient)
        else:
            db_patient.auth_user_id = auth_user_id
            db.commit()
            patient_id = db_patient.patient_id

    return TokenResponse(
        access_token=resp_data.get("access_token") or "",
        refresh_token=resp_data.get("refresh_token"),
        token_type=resp_data.get("token_type") or "bearer",
        user_id=str(auth_user_id),
        role=role,
        patient_id=patient_id,
        admin_id=admin_id
    )

@router.get("/admin/profile", response_model=AdminProfileResponse)
def get_admin_profile(
    current_user: UserPayload = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get current logged in administrator's profile.
    """
    if current_user.role.lower() != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. Admin permissions required."
        )
    admin = db.query(Admin).filter(Admin.auth_user_id == current_user.id).first()
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Admin profile not found."
        )
    return admin
