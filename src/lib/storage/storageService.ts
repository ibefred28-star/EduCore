import { ref, uploadBytes, uploadString, getDownloadURL, deleteObject } from 'firebase/storage';
import { storage } from '../firebase';

/**
 * Storage Path Hierarchies enforcing strict school isolation
 */
export const StoragePaths = {
  schoolLogo: (schoolId: string, ext = 'png') => `schools/${schoolId}/branding/logo.${ext}`,
  studentPhoto: (schoolId: string, studentId: string, ext = 'jpg') => `schools/${schoolId}/students/${studentId}/avatar.${ext}`,
  teacherPhoto: (schoolId: string, teacherId: string, ext = 'jpg') => `schools/${schoolId}/teachers/${teacherId}/avatar.${ext}`,
  questionDiagram: (schoolId: string, questionId: string, fileName: string) => `schools/${schoolId}/questions/${questionId}/${fileName}`,
  reportDocument: (schoolId: string, studentId: string, term: string, session: string) =>
    `schools/${schoolId}/reports/${session.replace(/\//g, '_')}_${term.replace(/\s+/g, '_')}_${studentId}.pdf`
};

export const StorageService = {
  /**
   * Uploads a base64 encoded data-URL or raw binary file to Firebase Storage
   */
  async uploadFile(path: string, file: File | Blob): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return getDownloadURL(storageRef);
  },

  /**
   * Uploads a Base64 data URL string (e.g. from camera, canvas, or file reader)
   */
  async uploadDataUrl(path: string, dataUrl: string): Promise<string> {
    const storageRef = ref(storage, path);
    await uploadString(storageRef, dataUrl, 'data_url');
    return getDownloadURL(storageRef);
  },

  /**
   * Deletes a file from Firebase Storage
   */
  async deleteFile(path: string): Promise<void> {
    const storageRef = ref(storage, path);
    await deleteObject(storageRef);
  }
};
