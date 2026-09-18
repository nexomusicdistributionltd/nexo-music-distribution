import { describe, expect, it } from 'vitest';
import { responseShape } from './response-shape';
describe('diagnostic privacy', () => {
  it('removes customer values and unknown or dynamic field names', () => {
    const result = JSON.stringify(responseShape({ data: [{ title: 'Private title', dividends: 912.34, token: 'secret', 'customer@example.com': 99 }] }));
    for (const value of ['Private title', '912.34', 'secret', 'customer@example.com', 'token']) expect(result).not.toContain(value);
    expect(result).toContain('dividends');
    expect(result).toContain('number');
  });
  it('does not invent schemas for empty and null data', () => {
    expect(JSON.stringify(responseShape([]))).toContain('item schema unknown');
    expect(responseShape(null)).toEqual({ type: 'null', note: 'No non-null schema observed' });
  });
  it('bounds deep or large inputs', () => {
    expect((responseShape(Array(100).fill(1)) as { samples: unknown[] }).samples).toHaveLength(3);
    let value: unknown = 'hidden';
    for(let i=0;i<20;i++) value={data:value};
    expect(JSON.stringify(responseShape(value))).toContain('truncated');
  });
});
