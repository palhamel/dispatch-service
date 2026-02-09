import { describe, it, expect } from 'vitest'
import { sanitize, sanitizeEmail, truncate } from '../../../src/utils/sanitize.js'

describe('sanitize', () => {
  it('strips HTML tags', () => {
    expect(sanitize('<p>Hello</p>')).toBe('Hello')
    expect(sanitize('<script>alert("xss")</script>')).toBe('alert("xss")')
    expect(sanitize('Hello <b>world</b>')).toBe('Hello world')
  })

  it('strips nested and malformed HTML', () => {
    expect(sanitize('<div><span>text</span></div>')).toBe('text')
    expect(sanitize('<<script>>alert("xss")<</script>>')).toBe('alert("xss")')
    expect(sanitize('<img src=x onerror=alert(1)>')).toBe('')
  })

  it('removes javascript: protocol strings', () => {
    expect(sanitize('javascript:alert(1)')).toBe('alert(1)')
    expect(sanitize('JAVASCRIPT:void(0)')).toBe('void(0)')
  })

  it('removes on* event handlers', () => {
    expect(sanitize('onerror=alert(1)')).toBe('')
    expect(sanitize('onclick=steal()')).toBe('')
    expect(sanitize('ONLOAD=hack()')).toBe('')
  })

  it('trims whitespace', () => {
    expect(sanitize('  hello  ')).toBe('hello')
    expect(sanitize('\n\thello\n\t')).toBe('hello')
  })

  it('preserves Swedish characters', () => {
    expect(sanitize('Hej! Jag heter Åsa Öberg från Malmö')).toBe('Hej! Jag heter Åsa Öberg från Malmö')
    expect(sanitize('Tack för hjälpen')).toBe('Tack för hjälpen')
  })

  it('preserves normal punctuation', () => {
    expect(sanitize('Hello, world! How are you?')).toBe('Hello, world! How are you?')
    expect(sanitize('Price: 100 SEK (inkl. moms)')).toBe('Price: 100 SEK (inkl. moms)')
  })

  it('handles null and undefined', () => {
    expect(sanitize(null as any)).toBe('')
    expect(sanitize(undefined as any)).toBe('')
  })

  it('handles empty string', () => {
    expect(sanitize('')).toBe('')
  })

  it('handles non-string input', () => {
    expect(sanitize(123 as any)).toBe('123')
    expect(sanitize(true as any)).toBe('true')
  })

  it('collapses multiple spaces into one', () => {
    expect(sanitize('hello    world')).toBe('hello world')
  })

  it('preserves newlines within text', () => {
    expect(sanitize('line1\nline2')).toBe('line1\nline2')
  })
})

describe('sanitizeEmail', () => {
  it('trims and lowercases email', () => {
    expect(sanitizeEmail('  Test@Example.COM  ')).toBe('test@example.com')
  })

  it('handles null/undefined', () => {
    expect(sanitizeEmail(null as any)).toBe('')
    expect(sanitizeEmail(undefined as any)).toBe('')
  })
})

describe('truncate', () => {
  it('truncates string to max length', () => {
    expect(truncate('hello world', 5)).toBe('hello')
  })

  it('does not truncate short strings', () => {
    expect(truncate('hi', 100)).toBe('hi')
  })

  it('handles empty string', () => {
    expect(truncate('', 10)).toBe('')
  })
})
