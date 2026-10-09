import { Role } from '../../types';

export interface RolePermissions {
  canAccessAdminPanel: boolean;
  canAccessTeacherPanel: boolean;
  canAccessStudentPanel: boolean;
  canManageStudents: boolean;
  canManageTeachers: boolean;
  canManageClasses: boolean;
  canManageSubjects: boolean;
  canManageBranding: boolean;
  canManageSettings: boolean;
  canAccessQuestionBank: boolean;
  canManageQuestionBank: boolean;
  canCreateExams: boolean;
  canEditExams: boolean;
  canProctorExams: boolean;
  canTakeExams: boolean;
  canViewAllResults: boolean;
  canViewAssignedResults: boolean;
  canViewOwnResults: boolean;
  canManageAttendance: boolean;
  canViewReports: boolean;
  canManageTenants: boolean;
}

export const PERMISSIONS_MATRIX: Record<Role | 'superadmin', RolePermissions> = {
  superadmin: {
    canAccessAdminPanel: true,
    canAccessTeacherPanel: true,
    canAccessStudentPanel: false,
    canManageStudents: true,
    canManageTeachers: true,
    canManageClasses: true,
    canManageSubjects: true,
    canManageBranding: true,
    canManageSettings: true,
    canAccessQuestionBank: true,
    canManageQuestionBank: true,
    canCreateExams: true,
    canEditExams: true,
    canProctorExams: true,
    canTakeExams: false,
    canViewAllResults: true,
    canViewAssignedResults: true,
    canViewOwnResults: false,
    canManageAttendance: true,
    canViewReports: true,
    canManageTenants: true
  },
  admin: {
    canAccessAdminPanel: true,
    canAccessTeacherPanel: true,
    canAccessStudentPanel: false,
    canManageStudents: true,
    canManageTeachers: true,
    canManageClasses: true,
    canManageSubjects: true,
    canManageBranding: true,
    canManageSettings: true,
    canAccessQuestionBank: true,
    canManageQuestionBank: true,
    canCreateExams: true,
    canEditExams: true,
    canProctorExams: true,
    canTakeExams: false,
    canViewAllResults: true,
    canViewAssignedResults: true,
    canViewOwnResults: false,
    canManageAttendance: true,
    canViewReports: true,
    canManageTenants: false
  },
  teacher: {
    canAccessAdminPanel: false,
    canAccessTeacherPanel: true,
    canAccessStudentPanel: false,
    canManageStudents: false,
    canManageTeachers: false,
    canManageClasses: false,
    canManageSubjects: false,
    canManageBranding: false,
    canManageSettings: false,
    canAccessQuestionBank: true,
    canManageQuestionBank: true,
    canCreateExams: true,
    canEditExams: true,
    canProctorExams: true,
    canTakeExams: false,
    canViewAllResults: false,
    canViewAssignedResults: true,
    canViewOwnResults: false,
    canManageAttendance: true,
    canViewReports: true,
    canManageTenants: false
  },
  student: {
    canAccessAdminPanel: false,
    canAccessTeacherPanel: false,
    canAccessStudentPanel: true,
    canManageStudents: false,
    canManageTeachers: false,
    canManageClasses: false,
    canManageSubjects: false,
    canManageBranding: false,
    canManageSettings: false,
    canAccessQuestionBank: false,
    canManageQuestionBank: false,
    canCreateExams: false,
    canEditExams: false,
    canProctorExams: false,
    canTakeExams: true,
    canViewAllResults: false,
    canViewAssignedResults: false,
    canViewOwnResults: true,
    canManageAttendance: false,
    canViewReports: false,
    canManageTenants: false
  }
};

export const hasPermission = (
  role: Role | 'superadmin' | null | undefined,
  permission: keyof RolePermissions
): boolean => {
  if (!role) return false;
  const perms = PERMISSIONS_MATRIX[role];
  return perms ? !!perms[permission] : false;
};
