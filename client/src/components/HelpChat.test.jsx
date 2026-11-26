import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../utils/analytics', () => ({ track: vi.fn() }));
import { track } from '../utils/analytics';
import HelpChat from './HelpChat';

function renderChat(onClose = vi.fn()) {
  render(
    <MemoryRouter initialEntries={['/app']}>
      <Routes>
        <Route path="/app" element={<HelpChat open onClose={onClose} />} />
        <Route path="/calendar" element={<div>Calendar page</div>} />
      </Routes>
    </MemoryRouter>
  );
  return onClose;
}

const ask = (text) => {
  fireEvent.change(screen.getByLabelText('Ask a question'), { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: 'Send' }));
};

describe('HelpChat', () => {
  beforeEach(() => vi.mocked(track).mockClear());

  it('opens with a greeting and suggested questions', () => {
    renderChat();
    expect(screen.getByRole('dialog', { name: 'Help' })).toBeInTheDocument();
    expect(screen.getByText(/Ask me how to do something in RepLab/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'How do I create a workout?' })).toBeInTheDocument();
  });

  it('answers a typed question and logs only the FAQ id', () => {
    renderChat();
    ask('how do i add a workout');
    expect(screen.getByText('how do i add a workout')).toBeInTheDocument();
    expect(screen.getByText(/Tap Create a Workout\./)).toBeInTheDocument();
    expect(track).toHaveBeenCalledWith('help_chat_answered', { faq_id: 'create-workout', via: 'typed' });
  });

  it('"Show me" navigates and closes the sheet', () => {
    const onClose = renderChat();
    ask('How do I add this to my calendar?');
    fireEvent.click(screen.getByRole('button', { name: 'Show me' }));
    expect(onClose).toHaveBeenCalled();
    expect(screen.getByText('Calendar page')).toBeInTheDocument();
  });

  it('no match shows contact support and logs the truncated query', () => {
    renderChat();
    const long = 'purple banana spaceship '.repeat(12);
    ask(long);
    expect(screen.getByText(/I don't have an answer for that yet/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Contact support' })).toHaveAttribute('href', 'mailto:support@replab-fitness.com');
    const call = vi.mocked(track).mock.calls.find((c) => c[0] === 'help_chat_unmatched');
    expect(call[1].query.length).toBeLessThanOrEqual(200);
  });

  it('weak match offers "Did you mean" chips', () => {
    renderChat();
    ask('workot');
    expect(screen.getByText(/Did you mean/)).toBeInTheDocument();
  });

  it('Escape closes', () => {
    const onClose = renderChat();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  it('input font is at least 16px (no iOS zoom)', () => {
    renderChat();
    expect(screen.getByLabelText('Ask a question').style.fontSize).toBe('16px');
  });
});
