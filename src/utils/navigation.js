export const getRedirectPath = (userDoc) => {
  if (!userDoc) return '/';
  if (!userDoc.role) return '/setup-role';
  if (userDoc.role === 'warden') {
    return userDoc.hostelId ? '/warden/dashboard' : '/warden/setup';
  }
  // Student role
  if (!userDoc.isProfileComplete) return '/student/profile-setup';
  if (!userDoc.isRegistered) return '/student/room-register';
  return '/student/dashboard';
};
