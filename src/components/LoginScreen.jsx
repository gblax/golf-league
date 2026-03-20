import React from 'react';
import { Trophy, Sun, Moon } from 'lucide-react';
import NotificationToast from './NotificationToast';

const LoginScreen = React.memo(function LoginScreen({
  notification,
  darkMode,
  setDarkMode,
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
  loginLoading,
  handleLogin,
  handleForgotPassword,
}) {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex items-center justify-center p-6 transition-colors duration-300">
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-4 right-4 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150"
        aria-label="Toggle dark mode"
      >
        {darkMode ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <NotificationToast notification={notification} />

      <div className="card p-8 max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-emerald-600 dark:bg-emerald-500 rounded-2xl mb-4">
            <Trophy className="text-white" size={40} />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Golf One and Done</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">{showForgotPassword ? 'Reset Password' : isSignup ? 'Create Account' : 'Welcome Back'}</p>
        </div>

        <div className="space-y-5">
          {isSignup && (
            <div>
              <label className="label">Name</label>
              <input
                type="text"
                value={signupName}
                onChange={(e) => setSignupName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="input"
                placeholder="Your name"
              />
            </div>
          )}

          <div>
            <label className="label">Email</label>
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (showForgotPassword ? handleForgotPassword() : handleLogin())}
              className="input"
              placeholder="your@email.com"
            />
          </div>

          {!showForgotPassword && (
            <div>
              <label className="label">Password</label>
              <input
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
                className="input"
                placeholder="Password"
              />
            </div>
          )}

          {showForgotPassword ? (
            <>
              <button
                onClick={handleForgotPassword}
                className="w-full btn-primary w-full py-3"
              >
                Send Reset Email
              </button>
              <button
                onClick={() => setShowForgotPassword(false)}
                className="w-full text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium transition-colors duration-150"
              >
                Back to sign in
              </button>
            </>
          ) : (
            <>
              <button
                onClick={handleLogin}
                disabled={loginLoading}
                className="btn-primary w-full py-3"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    {isSignup ? 'Creating Account...' : 'Signing In...'}
                  </span>
                ) : (
                  isSignup ? 'Create Account' : 'Sign In'
                )}
              </button>

              {!isSignup && (
                <button
                  onClick={() => setShowForgotPassword(true)}
                  className="w-full text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 text-sm font-medium transition-colors duration-150"
                >
                  Forgot password?
                </button>
              )}

              <button
                onClick={() => setIsSignup(!isSignup)}
                className="w-full text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 text-sm font-medium transition-colors duration-150"
              >
                {isSignup ? 'Already have an account? Sign in' : 'Need an account? Sign up'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
});

export default LoginScreen;
