import { describe, expect, it, beforeEach, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import { useParams, URL_DEBOUNCE_MS } from './useParams';
import { Controls } from './Controls';
import type { ParamSchema } from './params';

const schema = [
  { kind: 'continuous', id: 'tax', label: 'Tax per unit', unit: '$', min: 0, max: 6, step: 0.1, default: 2 },
  {
    kind: 'discrete',
    id: 'levied_on',
    label: 'Tax collected from',
    options: [
      { value: 'sellers', label: 'Sellers' },
      { value: 'buyers', label: 'Buyers' },
    ],
    default: 'sellers',
  },
  { kind: 'toggle', id: 'show_dwl', label: 'Highlight deadweight loss', default: true },
] as const satisfies ParamSchema;

function Harness() {
  const params = useParams(schema);
  return (
    <>
      <Controls schema={schema} params={params} />
      <output data-testid="tax">{params.values.tax}</output>
      <output data-testid="dirty">{String(params.isDirty)}</output>
      <output data-testid="share">{params.shareUrl}</output>
    </>
  );
}

beforeEach(() => {
  window.history.replaceState(null, '', '/tax-incidence');
});

describe('useParams + Controls', () => {
  it('hydrates initial state from the URL', () => {
    window.history.replaceState(null, '', '/tax-incidence?tax=4.5&levied_on=buyers');
    render(<Harness />);
    expect(screen.getByTestId('tax').textContent).toBe('4.5');
    expect((screen.getByLabelText('Buyers') as HTMLInputElement).checked).toBe(true);
  });

  it('falls back to defaults for a garbled URL rather than erroring', () => {
    window.history.replaceState(null, '', '/tax-incidence?tax=banana&levied_on=martians');
    render(<Harness />);
    expect(screen.getByTestId('tax').textContent).toBe('2');
  });

  it('writes state back to the URL, debounced, without growing history', () => {
    vi.useFakeTimers();
    const before = window.history.length;
    render(<Harness />);

    const slider = screen.getByLabelText('Tax per unit');
    fireEvent.change(slider, { target: { value: '3.5' } });

    // Nothing written yet — a drag must not thrash the URL.
    expect(window.location.search).toBe('');

    act(() => {
      vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10);
    });
    expect(window.location.search).toBe('?tax=3.5');
    // replaceState, not pushState (§6).
    expect(window.history.length).toBe(before);
    vi.useRealTimers();
  });

  it('drops a parameter from the URL when it returns to its default', () => {
    vi.useFakeTimers();
    render(<Harness />);
    const slider = screen.getByLabelText('Tax per unit');

    fireEvent.change(slider, { target: { value: '5' } });
    act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10));
    expect(window.location.search).toBe('?tax=5');

    fireEvent.change(slider, { target: { value: '2' } });
    act(() => vi.advanceTimersByTime(URL_DEBOUNCE_MS + 10));
    expect(window.location.search).toBe('');
    vi.useRealTimers();
  });

  it('shows Reset only once dirty, and restores defaults', () => {
    render(<Harness />);
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();

    fireEvent.change(screen.getByLabelText('Tax per unit'), { target: { value: '1' } });
    expect(screen.getByTestId('dirty').textContent).toBe('true');

    fireEvent.click(screen.getByRole('button', { name: 'Reset' }));
    expect(screen.getByTestId('tax').textContent).toBe('2');
    expect(screen.queryByRole('button', { name: 'Reset' })).toBeNull();
  });

  it('produces a share URL that reproduces the state exactly', () => {
    render(<Harness />);
    fireEvent.change(screen.getByLabelText('Tax per unit'), { target: { value: '4.2' } });
    fireEvent.click(screen.getByLabelText('Buyers'));

    const share = screen.getByTestId('share').textContent ?? '';
    const query = share.slice(share.indexOf('?'));
    expect(query).toContain('tax=4.2');
    expect(query).toContain('levied_on=buyers');
  });
});

describe('control accessibility (§9)', () => {
  it('gives every control a native element with a programmatic label', () => {
    render(<Harness />);
    // Continuous -> native range input, reachable by its label text.
    const slider = screen.getByLabelText('Tax per unit');
    expect(slider.tagName).toBe('INPUT');
    expect(slider.getAttribute('type')).toBe('range');

    // Discrete -> native radios, grouped and labelled.
    expect((screen.getByLabelText('Sellers') as HTMLInputElement).type).toBe('radio');
    expect((screen.getByLabelText('Buyers') as HTMLInputElement).type).toBe('radio');

    // Toggle -> native checkbox.
    expect((screen.getByLabelText('Highlight deadweight loss') as HTMLInputElement).type).toBe(
      'checkbox',
    );
  });

  it('exposes the value to assistive tech with its unit', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Tax per unit').getAttribute('aria-valuetext')).toBe('2.0 $');
  });
});
