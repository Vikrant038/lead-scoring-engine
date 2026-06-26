/**
 * Mock for Better Auth library in Jest tests.
 * Prevents ESM parsing errors and simulates authentication state for unit/integration tests.
 */

export const betterAuth = jest.fn((options?: any) => {
  if (options?.emailAndPassword?.sendResetPassword) {
    options.emailAndPassword
      .sendResetPassword({ user: { email: 'test@example.com' }, url: 'http://reset' })
      .catch(() => {});
  }
  if (options?.emailVerification?.sendVerificationEmail) {
    options.emailVerification
      .sendVerificationEmail({ user: { email: 'test@example.com' }, url: 'http://verify' })
      .catch(() => {});
  }
  return {
    api: {
      getSession: jest.fn(async ({ headers }: any) => {
        const h = headers || {};
        const cookieStr = String(h.cookie || h.Cookie || '');
        const authStr = String(h.authorization || h.Authorization || '');
        if (cookieStr.includes('better-auth.sid') || authStr) {
          let userId = 'test-user-id';
          let email = 'testuser@example.com';
          let name = 'Test User';

          if (cookieStr.includes('alice')) {
            userId = 'alice-id';
            email = 'alice-iso@example.com';
            name = 'Alice';
          } else if (cookieStr.includes('bob')) {
            userId = 'bob-id';
            email = 'bob-iso@example.com';
            name = 'Bob';
          }

          return {
            user: {
              id: userId,
              name,
              email,
              emailVerified: true,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
            session: {
              id: `sess_${userId}`,
              userId,
              expiresAt: new Date(Date.now() + 86400000),
            },
          };
        }
        return null;
      }),
    },
    handler: jest.fn((req: any, res: any) => {
      res.status(200).json({ success: true });
    }),
  };
});

export const toNodeHandler = jest.fn((_authInstance) => (req: any, res: any) => {
  const info = `${req.originalUrl || ''} ${req.url || ''} ${JSON.stringify(req.body || {})}`;
  let cookieVal = 'test_session';
  if (info.includes('alice')) {
    cookieVal = 'alice_session';
  } else if (info.includes('bob')) {
    cookieVal = 'bob_session';
  }
  res.setHeader('Set-Cookie', `better-auth.sid=${cookieVal}; Path=/; HttpOnly`);
  res.status(200).json({ success: true });
});

export const fromNodeHeaders = jest.fn((headers: any) => headers);

export const drizzleAdapter = jest.fn(() => ({}));

export const hashPassword = jest.fn(async (pw: string) => `hashed_${pw}`);
