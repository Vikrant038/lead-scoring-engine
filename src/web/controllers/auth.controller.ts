/**
 * Auth controllers (Phase 1). Thin handlers for login, register, logout.
 * Delegates credential logic to BcryptAuthService; session management here.
 */
import type { RequestHandler } from 'express';
import { BcryptAuthService } from '../../lib/auth/bcrypt-auth.service';

const authService = new BcryptAuthService();

// GET /auth/login
export const loginPageController: RequestHandler = (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('login', {
    title: 'Sign In — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: null,
    /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
  });
};

// POST /auth/login
export const loginController: RequestHandler = async (req, res, next) => {
  try {
    const { email, password } = req.body as { email?: string; password?: string };
    if (!email || !password) {
      return res.render('login', {
        title: 'Sign In — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'Email and password are required.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
    const user = await authService.login(email, password);
    if (!user) {
      return res.render('login', {
        title: 'Sign In — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'Invalid email or password.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
    req.session.userId = user.id;
    req.session.userEmail = user.email;
    /* istanbul ignore next */ const destination = req.session.returnTo ?? '/';
    delete req.session.returnTo;
    res.redirect(destination);
  } catch (error) {
    /* istanbul ignore next -- propagates unexpected errors from authService */
    next(error);
  }
};

// GET /auth/register
export const registerPageController: RequestHandler = (req, res) => {
  if (req.session.userId) return res.redirect('/');
  res.render('register', {
    title: 'Create Account — ICP Profiler',
    csrfToken: res.locals.csrfToken,
    error: null,
    /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
  });
};

// POST /auth/register
export const registerController: RequestHandler = async (req, res, next) => {
  try {
    const { email, password, confirm } = req.body as {
      email?: string;
      password?: string;
      confirm?: string;
    };
    if (!email || !password || !confirm) {
      return res.render('register', {
        title: 'Create Account — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'All fields are required.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
    if (password !== confirm) {
      return res.render('register', {
        title: 'Create Account — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'Passwords do not match.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
    if (password.length < 8) {
      return res.render('register', {
        title: 'Create Account — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'Password must be at least 8 characters.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
    try {
      const user = await authService.register(email, password);
      req.session.userId = user.id;
      req.session.userEmail = user.email;
      res.redirect('/');
    } catch {
      return res.render('register', {
        title: 'Create Account — ICP Profiler',
        csrfToken: res.locals.csrfToken,
        error: 'An account with that email already exists.',
        /* istanbul ignore next */ cspNonce: res.locals.cspNonce ?? '',
      });
    }
  } catch (error) {
    /* istanbul ignore next -- propagates unexpected errors from authService */
    next(error);
  }
};

// POST /auth/logout
export const logoutController: RequestHandler = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('icp.sid');
    res.redirect('/auth/login');
  });
};
