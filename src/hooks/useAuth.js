import { useState, useEffect } from 'react';

export function useAuth(supabase, { showNotification, onLeaguesLoaded }) {
  const [currentUser, setCurrentUser] = useState(null);
  const [showLogin, setShowLogin] = useState(true);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [isSignup, setIsSignup] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  // Account settings state
  const [showAccountSettings, setShowAccountSettings] = useState(false);
  const [editName, setEditName] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Restore session on page load and listen for auth changes
  useEffect(() => {
    const loadSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .maybeSingle();

        if (data) {
          setCurrentUser(data);
          setShowLogin(false);
          onLeaguesLoaded(data);
        }
      }
      setLoading(false);
    };
    loadSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setShowResetPassword(true);
        setShowLogin(false);
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setShowLogin(true);
        localStorage.removeItem('currentLeagueId');
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async () => {
    if (!loginEmail.trim() || !loginPassword) {
      showNotification('error', 'Email and password are required');
      return;
    }
    if (isSignup && !signupName.trim()) {
      showNotification('error', 'Name is required');
      return;
    }
    if (loginLoading) return;
    setLoginLoading(true);
    try {
      if (isSignup) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', 'Signup failed: ' + authError.message);
          return;
        }

        if (!authData.user) {
          showNotification('error', 'Signup failed. Please try again.');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .insert([{ id: authData.user.id, email: loginEmail.trim(), name: signupName.trim() }])
          .select()
          .maybeSingle();

        if (userError) {
          showNotification('error', 'Error creating profile: ' + userError.message);
          return;
        }

        setCurrentUser(userData);
        setShowLogin(false);
        onLeaguesLoaded(userData, true);
      } else {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: loginEmail.trim(),
          password: loginPassword,
        });

        if (authError) {
          showNotification('error', 'Invalid email or password');
          return;
        }

        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', authData.user.id)
          .maybeSingle();

        if (userError || !userData) {
          showNotification('error', 'Account not found. Please sign up.');
          await supabase.auth.signOut();
          return;
        }

        setCurrentUser(userData);
        setShowLogin(false);
        onLeaguesLoaded(userData);
      }
    } catch (error) {
      showNotification('error', 'Login error: ' + error.message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!loginEmail.trim()) {
      showNotification('error', 'Please enter your email address first');
      return;
    }
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(loginEmail.trim(), {
        redirectTo: window.location.origin,
      });
      if (error) {
        showNotification('error', 'Error sending reset email: ' + error.message);
      } else {
        showNotification('success', 'Password reset email sent! Check your inbox.');
        setShowForgotPassword(false);
      }
    } catch (error) {
      showNotification('error', 'Error: ' + error.message);
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showNotification('error', 'Password must be at least 6 characters');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showNotification('error', 'Error resetting password: ' + error.message);
      } else {
        showNotification('success', 'Password updated successfully!');
        setShowResetPassword(false);
        setNewPassword('');
      }
    } catch (error) {
      showNotification('error', 'Error: ' + error.message);
    }
  };

  const handleUpdateProfile = async (loadData) => {
    if (!editName || !editEmail) {
      showNotification('error', 'Name and email are required');
      return;
    }

    try {
      if (editEmail !== currentUser.email) {
        const { error: authError } = await supabase.auth.updateUser({ email: editEmail });
        if (authError) {
          showNotification('error', 'Error updating email: ' + authError.message);
          return;
        }
      }

      const { error } = await supabase
        .from('profiles')
        .update({ name: editName, email: editEmail })
        .eq('id', currentUser.id);

      if (error) {
        showNotification('error', 'Error updating profile: ' + error.message);
        return;
      }

      setCurrentUser({ ...currentUser, name: editName, email: editEmail });
      showNotification('success', editEmail !== currentUser.email
        ? 'Profile updated! Check your new email to confirm the change.'
        : 'Profile updated successfully!');
      setShowAccountSettings(false);
      loadData();
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      showNotification('error', 'New password fields are required');
      return;
    }
    if (newPassword !== confirmPassword) {
      showNotification('error', 'New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      showNotification('error', 'Password must be at least 6 characters');
      return;
    }
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        showNotification('error', 'Error updating password: ' + error.message);
        return;
      }
      showNotification('success', 'Password updated successfully!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      showNotification('error', error.message);
    }
  };

  const openAccountSettings = () => {
    setEditName(currentUser.name);
    setEditEmail(currentUser.email);
    setShowAccountSettings(true);
  };

  return {
    currentUser,
    setCurrentUser,
    showLogin,
    loginEmail,
    setLoginEmail,
    loginPassword,
    setLoginPassword,
    signupName,
    setSignupName,
    isSignup,
    setIsSignup,
    showForgotPassword,
    setShowForgotPassword,
    showResetPassword,
    newPassword,
    setNewPassword,
    loginLoading,
    loading,
    showAccountSettings,
    setShowAccountSettings,
    editName,
    setEditName,
    editEmail,
    setEditEmail,
    confirmPassword,
    setConfirmPassword,
    handleLogin,
    handleForgotPassword,
    handleResetPassword,
    handleUpdateProfile,
    handleChangePassword,
    openAccountSettings,
  };
}
