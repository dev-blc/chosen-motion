export type UserRole = 'admin' | 'patient';

export interface BaseUser {
  id: string;
  email: string;
  role: UserRole;
  firstName?: string;
  lastName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface PatientProfile {
  id: string;
  dateOfBirth?: string;
  diagnosis?: string;
  assignedAdminId?: string;
  user?: BaseUser;
}

export interface AdminProfile {
  id: string;
  department?: string;
  accessLevel: 'standard' | 'super';
  user?: BaseUser;
}
