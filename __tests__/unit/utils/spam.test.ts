import { describe, it, expect } from 'vitest'
import { checkSpam } from '../../../src/utils/spam.js'

describe('checkSpam', () => {
  // Medical spam
  it('detects medical spam keywords', () => {
    expect(checkSpam('Buy viagra online now').isSpam).toBe(true)
    expect(checkSpam('Cheap cialis available').isSpam).toBe(true)
    expect(checkSpam('Online pharmacy deals').isSpam).toBe(true)
    expect(checkSpam('Buy viagra online now').category).toBe('medical')
  })

  // Gambling/crypto
  it('detects gambling and crypto patterns', () => {
    expect(checkSpam('Win big at casino today').isSpam).toBe(true)
    expect(checkSpam('Online gambling website').isSpam).toBe(true)
    expect(checkSpam('Try betting on sports').isSpam).toBe(true)
    expect(checkSpam('Invest in bitcoin today').isSpam).toBe(true)
    expect(checkSpam('Buy ethereum and crypto').isSpam).toBe(true)
    expect(checkSpam('Win big at casino today').category).toBe('gambling')
    expect(checkSpam('Invest in bitcoin today').category).toBe('crypto')
  })

  // Adult content
  it('detects adult content patterns', () => {
    expect(checkSpam('Visit our porn website').isSpam).toBe(true)
    expect(checkSpam('Adult content available').isSpam).toBe(true)
    expect(checkSpam('XXX videos for free').isSpam).toBe(true)
    expect(checkSpam('Visit our porn website').category).toBe('adult')
  })

  // Marketing spam
  it('detects marketing spam phrases', () => {
    expect(checkSpam('Buy now and save money').isSpam).toBe(true)
    expect(checkSpam('Amazing discount for you').isSpam).toBe(true)
    expect(checkSpam('Free offer just for you').isSpam).toBe(true)
    expect(checkSpam('Limited time deal today').isSpam).toBe(true)
    expect(checkSpam('Get the best price now').isSpam).toBe(true)
    expect(checkSpam('Buy now and save money').category).toBe('marketing')
  })

  // Financial spam
  it('detects financial spam', () => {
    expect(checkSpam('Earn money from home easily').isSpam).toBe(true)
    expect(checkSpam('Make money while you sleep').isSpam).toBe(true)
    expect(checkSpam('Great investment opportunity').isSpam).toBe(true)
    expect(checkSpam('Guaranteed profit returns').isSpam).toBe(true)
    expect(checkSpam('Get rich quick scheme here').isSpam).toBe(true)
    expect(checkSpam('Save $500 on your order').isSpam).toBe(true)
  })

  // URL markup
  it('detects URL markup patterns', () => {
    expect(checkSpam('Check this [url=http://spam.com]link[/url]').isSpam).toBe(true)
  })

  // HTML/script injection
  it('detects HTML and script injection', () => {
    expect(checkSpam('Hello <script>alert(1)</script> world').isSpam).toBe(true)
    expect(checkSpam('Visit javascript:void(0) now').isSpam).toBe(true)
    expect(checkSpam('See data:text/html,<h1>hi</h1>').isSpam).toBe(true)
    expect(checkSpam('Hello <script>alert(1)</script> world').category).toBe('security')
  })

  // Repetitive characters
  it('detects repetitive character patterns', () => {
    expect(checkSpam('Heeeeeello there friend').isSpam).toBe(true)
    expect(checkSpam('aaaaaaaaaaaaa bbbbb ccc').isSpam).toBe(true)
  })

  // Non-Latin character blocks
  it('detects blocks of non-Latin characters', () => {
    expect(checkSpam('Hello مرحبا بالعالم العربي friend').isSpam).toBe(true)
  })

  // External contact methods
  it('detects external contact app references', () => {
    expect(checkSpam('Contact me on whatsapp please').isSpam).toBe(true)
    expect(checkSpam('Message me via telegram now').isSpam).toBe(true)
  })

  // Clean text - Swedish
  it('returns clean for normal Swedish text', () => {
    const result = checkSpam('Hej! Jag undrar om nästa meetup i Malmö. Kan jag anmäla mig?')
    expect(result.isSpam).toBe(false)
    expect(result.category).toBeUndefined()
  })

  it('returns clean for longer Swedish text', () => {
    const result = checkSpam(
      'Tack för ett fantastiskt event förra veckan! Jag och mina kollegor tyckte det var jättebra. Vi undrar om ni planerar fler workshops inom React och TypeScript?'
    )
    expect(result.isSpam).toBe(false)
  })

  it('returns clean for Swedish text with special characters', () => {
    const result = checkSpam('Hej Åsa! Tack för hjälpen med biljetten till eventet i Göteborg.')
    expect(result.isSpam).toBe(false)
  })

  // Clean text - English
  it('returns clean for normal English text', () => {
    const result = checkSpam(
      'Hi there! I would like to know more about your upcoming tech meetup event. What topics will be covered?'
    )
    expect(result.isSpam).toBe(false)
  })

  it('returns clean for professional English text', () => {
    const result = checkSpam(
      'I am a developer looking to attend your next workshop. Could you provide more details about the schedule and location?'
    )
    expect(result.isSpam).toBe(false)
  })

  // Edge cases
  it('returns spam result with category and reason', () => {
    const result = checkSpam('Buy viagra cheap online')
    expect(result).toEqual({
      isSpam: true,
      category: 'medical',
      reason: expect.any(String),
    })
  })

  it('handles empty string', () => {
    expect(checkSpam('').isSpam).toBe(false)
  })

  it('handles null/undefined', () => {
    expect(checkSpam(null as any).isSpam).toBe(false)
    expect(checkSpam(undefined as any).isSpam).toBe(false)
  })

  // No false positives on partial word matches
  it('does not flag words containing spam substrings', () => {
    expect(checkSpam('The exchange rate is favorable for trading').isSpam).toBe(false)
    expect(checkSpam('This is a classic example of good design').isSpam).toBe(false)
    expect(checkSpam('The therapist recommended a new approach').isSpam).toBe(false)
  })
})
