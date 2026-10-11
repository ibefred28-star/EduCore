import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User as FirebaseUser,
  IdTokenResult,
  Unsubscribe
} from 'firebase/auth';
import { auth } from '../firebase';
import { UserService } from './userService';
import { AuditService } from '../firestore/auditService';
import { EduCoreCustomClaims, AuthenticatedUser, formatInternalAuthEmail } from './authTypes';
import { Role } from '../../types';

export interface LegacyAccountCheckResult {
  found: boolean;
  mismatchedRole?: Role;
  passwordMatches?: boolean;
  displayName?: string;
  classes?: string[];
}

export type LegacyAccountChecker = (
  schoolId: string,
  role: Role,
  username: string,
  pass: string
) => LegacyAccountCheckResult;

const SUPERADMIN_DEFAULT_PASS = 'admin123';

export const AuthService = {
  /**
   * Authoritatively signs in a user through Firebase Authentication.
   * If the account exists in the legacy school roster but has not yet been
   * provisioned in Firebase Auth, performs an automatic, secure one-time migration.
   */
  async signInWithCredentials(
    schoolId: string | null,
    role: Role | 'superadmin',
    username: string,
    pass: string,
    legacyChecker?: LegacyAccountChecker
  ): Promise<{ user: AuthenticatedUser | null; error?: string }> {
    const trimmedId = (username || '').trim().toLowerCase();
    const trimmedPass = (pass || '').trim();

    if (!trimmedPass) {
      return { user: null, error: 'Please enter your password.' };
    }

    // 1. Super Admin Authentication Flow
    if (role === 'superadmin') {
      const email = 'superadmin@educore.internal';
      try {
        const userCredential = await signInWithEmailAndPassword(auth, email, trimmedPass);
        const fbUser = userCredential.user;

        // Fetch or create Firestore user profile
        let profile = await UserService.getUserProfile('global', 'superadmin');
        if (!profile) {
          profile = await UserService.upsertUserProfile('global', {
            uid: fbUser.uid,
            username: 'superadmin',
            name: 'Super Administrator',
            email,
            role: 'superadmin',
            status: 'active'
          });
        }

        if (profile.status === 'disabled') {
          await firebaseSignOut(auth);
          return { user: null, error: 'Super Administrator account is disabled.' };
        }

        await AuditService.log({
          schoolId: 'global',
          actorId: 'superadmin',
          actorRole: 'superadmin',
          action: 'AUTH_LOGIN_SUCCESS',
          targetType: 'auth'
        });

        return {
          user: {
            uid: fbUser.uid,
            email: fbUser.email,
            schoolId: 'global',
            role: 'superadmin',
            userId: 'superadmin',
            displayName: profile.name || 'Super Administrator'
          }
        };
      } catch (err: any) {
        // If account does not exist in Firebase Auth yet, allow initial bootstrap
        if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
          // Check if password satisfies initial setup requirements
          if (trimmedPass === SUPERADMIN_DEFAULT_PASS || trimmedPass.length >= 8) {
            try {
              const newCredential = await createUserWithEmailAndPassword(auth, email, trimmedPass);
              const fbUser = newCredential.user;

              await UserService.upsertUserProfile('global', {
                uid: fbUser.uid,
                username: 'superadmin',
                name: 'Super Administrator',
                email,
                role: 'superadmin',
                status: 'active'
              });

              await AuditService.log({
                schoolId: 'global',
                actorId: 'superadmin',
                actorRole: 'superadmin',
                action: 'AUTH_SUPERADMIN_PROVISIONED',
                targetType: 'auth',
                details: { method: 'first_run_bootstrap' }
              });

              return {
                user: {
                  uid: fbUser.uid,
                  email: fbUser.email,
                  schoolId: 'global',
                  role: 'superadmin',
                  userId: 'superadmin',
                  displayName: 'Super Administrator'
                }
              };
            } catch (createErr: any) {
              if (createErr.code === 'auth/email-already-in-use') {
                return { user: null, error: 'Incorrect administrator password. Please try again.' };
              }
              console.warn('Superadmin bootstrap error:', createErr);
              return { user: null, error: 'Could not initialize superadmin in Firebase Authentication.' };
            }
          }
          return { user: null, error: 'Incorrect administrator credentials. Please try again.' };
        }
        return { user: null, error: mapAuthError(err) };
      }
    }

    // 2. School Tenant Member Flow (Student, Teacher, Admin)
    if (!schoolId) {
      return { user: null, error: 'Please enter a valid School ID.' };
    }
    if (!trimmedId) {
      return { user: null, error: 'Please enter your Username / ID.' };
    }

    const email = formatInternalAuthEmail(schoolId, role, trimmedId);

    try {
      // Primary authentication attempt against Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, email, trimmedPass);
      const fbUser = userCredential.user;

      // Authoritative profile validation
      let profile = await UserService.getUserProfile(schoolId, trimmedId);
      if (profile && profile.status === 'disabled') {
        await firebaseSignOut(auth);
        return { user: null, error: 'Your account has been deactivated. Please contact your school administrator.' };
      }

      if (!profile) {
        // Profile recovery if user exists in Auth but not Firestore
        profile = await UserService.upsertUserProfile(schoolId, {
          uid: fbUser.uid,
          username: trimmedId,
          name: fbUser.displayName || trimmedId,
          email,
          role,
          status: 'active'
        });
      }

      await AuditService.log({
        schoolId,
        actorId: trimmedId,
        actorRole: role,
        action: 'AUTH_LOGIN_SUCCESS',
        targetType: 'auth'
      });

      return {
        user: {
          uid: fbUser.uid,
          email: fbUser.email,
          schoolId,
          role: profile.role || role,
          userId: trimmedId,
          displayName: profile.name || trimmedId
        }
      };
    } catch (err: any) {
      // Handle legacy migration fallback if user not yet registered in Firebase Auth
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
        if (legacyChecker) {
          const check = legacyChecker(schoolId, role, trimmedId, trimmedPass);
          
          if (check.mismatchedRole) {
            const roleLabel = check.mismatchedRole === 'admin' ? 'School Administrator' : check.mismatchedRole === 'teacher' ? 'Teacher' : 'Student';
            return {
              user: null,
              error: `ID "${trimmedId}" belongs to a ${roleLabel}. Please select "${roleLabel}" in the Role dropdown.`
            };
          }

          if (check.found) {
            if (check.passwordMatches) {
              // Authorize and migrate account into Firebase Authentication
              try {
                const newCredential = await createUserWithEmailAndPassword(auth, email, trimmedPass);
                const fbUser = newCredential.user;

                const profile = await UserService.upsertUserProfile(schoolId, {
                  uid: fbUser.uid,
                  username: trimmedId,
                  name: check.displayName || trimmedId,
                  email,
                  role,
                  classes: check.classes || [],
                  status: 'active'
                });

                await AuditService.log({
                  schoolId,
                  actorId: trimmedId,
                  actorRole: role,
                  action: 'AUTH_LEGACY_MIGRATED',
                  targetType: 'auth',
                  details: { method: 'automatic_on_login' }
                });

                return {
                  user: {
                    uid: fbUser.uid,
                    email: fbUser.email,
                    schoolId,
                    role,
                    userId: trimmedId,
                    displayName: profile.name || trimmedId
                  }
                };
              } catch (migrationErr: any) {
                console.warn('Migration error into Firebase Auth:', migrationErr);
                return { user: null, error: mapAuthError(migrationErr) };
              }
            } else {
              return { user: null, error: 'Incorrect password. Please try again.' };
            }
          }
        }

        const roleLabel = role === 'admin' ? 'School Administrator' : role === 'teacher' ? 'Teacher' : 'Student';
        return { user: null, error: `No ${roleLabel} account found with ID "${username}".` };
      }

      return { user: null, error: mapAuthError(err) };
    }
  },

  /**
   * Authoritatively signs out the current session
   */
  async signOut(): Promise<void> {
    await firebaseSignOut(auth);
  },

  /**
   * Subscribes to Firebase Authentication state observer to restore sessions
   */
  initAuthObserver(callback: (user: AuthenticatedUser | null) => void): Unsubscribe {
    return onAuthStateChanged(auth, async (fbUser: FirebaseUser | null) => {
      if (!fbUser || !fbUser.email) {
        callback(null);
        return;
      }

      try {
        // Parse email schema: school.role.user@educore.internal or superadmin@educore.internal
        if (fbUser.email === 'superadmin@educore.internal') {
          callback({
            uid: fbUser.uid,
            email: fbUser.email,
            schoolId: 'global',
            role: 'superadmin',
            userId: 'superadmin',
            displayName: fbUser.displayName || 'Super Administrator'
          });
          return;
        }

        const parts = fbUser.email.split('@')[0].split('.');
        if (parts.length >= 3) {
          const schoolId = parts[0];
          const role = parts[1] as Role;
          const userId = parts.slice(2).join('.');

          // Check profile status
          const profile = await UserService.getUserProfile(schoolId, userId);
          if (profile && profile.status === 'disabled') {
            await firebaseSignOut(auth);
            callback(null);
            return;
          }

          callback({
            uid: fbUser.uid,
            email: fbUser.email,
            schoolId,
            role: (profile?.role as Role) || role,
            userId,
            displayName: profile?.name || fbUser.displayName || userId
          });
        } else {
          // Standard token claims fallback
          const tokenResult: IdTokenResult = await fbUser.getIdTokenResult();
          const claims = tokenResult.claims as unknown as EduCoreCustomClaims;

          callback({
            uid: fbUser.uid,
            email: fbUser.email,
            schoolId: claims.schoolId || '',
            role: claims.role || 'student',
            userId: claims.userId || fbUser.uid,
            displayName: fbUser.displayName || fbUser.email
          });
        }
      } catch (err) {
        console.warn('Error in auth observer reconciliation:', err);
        callback(null);
      }
    });
  }
};

function mapAuthError(err: any): string {
  if (!err) return 'Authentication failed.';
  if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
    return 'Incorrect password. Please verify and try again.';
  }
  if (err.code === 'auth/user-not-found') {
    return 'No account found matching these credentials.';
  }
  if (err.code === 'auth/too-many-requests') {
    return 'Too many failed attempts. Please wait a moment before trying again.';
  }
  if (err.code === 'auth/network-request-failed') {
    return 'Network error. Please check your internet connection.';
  }
  if (err.code === 'auth/user-disabled') {
    return 'This account has been deactivated.';
  }
  return err.message || 'Authentication failed.';
}
