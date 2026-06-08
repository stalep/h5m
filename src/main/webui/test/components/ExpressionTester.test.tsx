import { extractPaths, jqKey } from '@app/components/ExpressionTester';
import { describe, expect, it } from 'vitest';

describe('jqKey', () => {
  it('simple keys are unquoted', () => {
    expect(jqKey('foo')).toBe('.foo');
    expect(jqKey('CPU')).toBe('.CPU');
    expect(jqKey('_private')).toBe('._private');
    expect(jqKey('a123')).toBe('.a123');
  });

  it('keys with hyphens are quoted', () => {
    expect(jqKey('spring3-jvm')).toBe('."spring3-jvm"');
    expect(jqKey('my-key')).toBe('."my-key"');
  });

  it('keys with dots are quoted', () => {
    expect(jqKey('com.example')).toBe('."com.example"');
  });

  it('keys with spaces are quoted', () => {
    expect(jqKey('my key')).toBe('."my key"');
  });

  it('keys starting with numbers are quoted', () => {
    expect(jqKey('3rdParty')).toBe('."3rdParty"');
  });
});

describe('extractPaths', () => {
  it('extracts top-level keys', () => {
    const paths = extractPaths({ foo: 1, bar: 'hello' });
    expect(paths).toContain('.foo');
    expect(paths).toContain('.bar');
  });

  it('extracts nested keys', () => {
    const paths = extractPaths({ config: { version: '3.7', host: 'localhost' } });
    expect(paths).toContain('.config');
    expect(paths).toContain('.config.version');
    expect(paths).toContain('.config.host');
  });

  it('handles arrays', () => {
    const paths = extractPaths({ items: [{ name: 'a' }, { name: 'b' }] });
    expect(paths).toContain('.items');
    expect(paths).toContain('.items[]');
    expect(paths).toContain('.items[].name');
  });

  it('handles deeply nested objects', () => {
    const paths = extractPaths({ a: { b: { c: { d: 42 } } } });
    expect(paths).toContain('.a');
    expect(paths).toContain('.a.b');
    expect(paths).toContain('.a.b.c');
    expect(paths).toContain('.a.b.c.d');
  });

  it('returns empty for null', () => {
    expect(extractPaths(null)).toEqual([]);
  });

  it('returns empty for primitives', () => {
    expect(extractPaths(42)).toEqual([]);
    expect(extractPaths('hello')).toEqual([]);
  });

  it('quotes keys with special characters', () => {
    const paths = extractPaths({ 'my-key': 1, normal: 2 });
    expect(paths).toContain('."my-key"');
    expect(paths).toContain('.normal');
  });

  it('handles realistic upload data with quoted keys', () => {
    const data = {
      env: { HOST: 'mwperf4', BUILD_ID: 167 },
      config: { QUARKUS_VERSION: '3.7.4' },
      results: {
        'quarkus3-jvm': {
          load: { avThroughput: 29490.23 },
        },
      },
    };
    const paths = extractPaths(data);
    expect(paths).toContain('.env');
    expect(paths).toContain('.env.HOST');
    expect(paths).toContain('.config.QUARKUS_VERSION');
    // Keys with hyphens should be quoted
    expect(paths).toContain('.results."quarkus3-jvm"');
    expect(paths).toContain('.results."quarkus3-jvm".load.avThroughput');
  });
});
