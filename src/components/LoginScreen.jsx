import React from 'react';
import { Trophy, Sun, Moon } from 'lucide-react';
import NotificationToast from './NotificationToast';
import Spinner from './Spinner';

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
      {/* Dark mode toggle for login page */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="fixed top-[calc(1rem+env(safe-area-inset-top))] right-[calc(1rem+env(safe-area-inset-right))] p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-soft text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors duration-150"
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
                autoComplete="name"
                autoCapitalize="words"
                enterKeyHint="next"
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
              autoComplete="email"
              inputMode="email"
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              enterKeyHint={showForgotPassword ? 'go' : 'next'}
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
                autoComplete={isSignup ? 'new-password' : 'current-password'}
                enterKeyHint="go"
                className="input"
                placeholder="Password"
              />
            </div>
          )}

          {showForgotPassword ? (
            <>
              <button
                onClick={handleForgotPassword}
                className="btn-primary btn-lg w-full"
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
                className="btn-primary btn-lg w-full"
              >
                {loginLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <Spinner size="md" className="border-current" />
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
