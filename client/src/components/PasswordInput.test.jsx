// Show/hide eye inside password fields: toggles the type, never submits the
// form, and passes props (id, autoComplete, ref, style) through to the input.
import { createRef } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import PasswordInput from './PasswordInput';

describe('PasswordInput', () => {
  it('toggles between dots and plain text without submitting the form', () => {
    const onSubmit = vi.fn(e => e.preventDefault());
    const ref = createRef();
    render(
      <form onSubmit={onSubmit}>
        <PasswordInput id="pw" ref={ref} autoComplete="current-password" defaultValue="secret" style={{ padding: '12px 16px' }} />
      </form>,
    );
    const input = document.getElementById('pw');
    expect(ref.current).toBe(input);
    expect(input).toHaveAttribute('type', 'password');
    expect(input).toHaveAttribute('autocomplete', 'current-password');
    expect(input.style.paddingRight).toBe('44px');

    const eye = screen.getByRole('button', { name: 'Show password' });
    expect(eye).toHaveAttribute('type', 'button');
    expect(eye).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(eye);
    expect(input).toHaveAttribute('type', 'text');
    expect(screen.getByRole('button', { name: 'Hide password' })).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(eye);
    expect(input).toHaveAttribute('type', 'password');
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
