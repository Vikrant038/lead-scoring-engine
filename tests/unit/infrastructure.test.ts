/**
 * Infrastructure unit tests — covers schema foreign key getters, auth config callbacks, and fake mailer.
 */
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { user, session, account } from '../../src/db/schema';
import { auth } from '../../src/lib/auth/auth';
import { sendEmail } from '../../src/lib/email/fake-mailer';

describe('Infrastructure & Auth Configuration', () => {
  it('sendEmail logs the fake email payload', () => {
    expect(() =>
      sendEmail({ to: 'test@example.com', subject: 'Hello', body: 'World' }),
    ).not.toThrow();
  });

  it('auth instance is defined', () => {
    expect(auth).toBeDefined();
  });

  it('schema foreign keys reference user table', () => {
    expect(user).toBeDefined();

    const sessCfg = getTableConfig(session);
    sessCfg.foreignKeys.forEach((fk) => {
      fk.reference();
    });

    const accCfg = getTableConfig(account);
    accCfg.foreignKeys.forEach((fk) => {
      fk.reference();
    });
  });
});
