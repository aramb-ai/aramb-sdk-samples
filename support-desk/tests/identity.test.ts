import { describe, expect, it } from 'vitest';
import { companyOf, domainOf, isAdmin, parseAdminEmails, subTenantFor } from '../lib/identity';

describe('subTenantFor', () => {
  it('maps a Google account to u_g_<sub>', () => {
    expect(subTenantFor('google', '109876543210987654321')).toBe('u_g_109876543210987654321');
  });

  it('refuses a Google id outside the charset', () => {
    expect(() => subTenantFor('google', 'abc:def')).toThrow();
  });

  it('maps a dev login to u_d_ + the first 32 hex chars of sha256(lowercased email)', () => {
    // printf %s ada@acme.test | sha256sum → 3ba15ffe92f621bb26c812374e3b4fb0…
    expect(subTenantFor('dev', 'ada@acme.test')).toBe('u_d_3ba15ffe92f621bb26c812374e3b4fb0');
  });

  it('gives the same id whatever the case or surrounding spaces of the email', () => {
    expect(subTenantFor('dev', '  Ada@ACME.test ')).toBe(subTenantFor('dev', 'ada@acme.test'));
  });

  it('gives different people different ids', () => {
    expect(subTenantFor('dev', 'ada@acme.test')).not.toBe(subTenantFor('dev', 'bob@acme.test'));
  });

  it('only ever uses [a-z0-9_] (never a channel prefix like "whatsapp:")', () => {
    for (const id of [subTenantFor('google', '1234567890'), subTenantFor('dev', 'Zoë+tag@Example.com')]) {
      expect(id).toMatch(/^[a-z0-9_]+$/);
    }
  });
});

describe('company and admin', () => {
  it('uses the email domain as the company', () => {
    expect(domainOf('Ada@Acme.Test')).toBe('acme.test');
    expect(companyOf('ada@acme.test')).toBe('acme.test');
  });

  it.each(['gmail.com', 'googlemail.com', 'outlook.com', 'hotmail.com', 'live.com', 'yahoo.com', 'icloud.com', 'proton.me', 'protonmail.com'])(
    'gives a person on public domain %s no company',
    (domain) => {
      expect(companyOf(`someone@${domain}`)).toBeNull();
    },
  );

  it('rejects a string that is not an email address', () => {
    expect(() => domainOf('not-an-email')).toThrow();
    expect(() => domainOf('trailing@')).toThrow();
  });

  it('makes an admin only of a listed email on a company domain', () => {
    const admins = parseAdminEmails(' Ada@acme.test, , someone@gmail.com ');
    expect(isAdmin('ada@ACME.test', admins)).toBe(true);
    expect(isAdmin('bob@acme.test', admins)).toBe(false);
    expect(isAdmin('someone@gmail.com', admins)).toBe(false);
  });

  it('has no admins when ADMIN_EMAILS is unset', () => {
    expect(isAdmin('ada@acme.test', parseAdminEmails(undefined))).toBe(false);
  });
});
