import { fireEvent, render, screen } from '@testing-library/react';
import { ConfirmDialog } from './confirm-dialog';

it('keeps keyboard focus inside the confirmation, supports Escape and restores focus', () => {
  const trigger = document.createElement('button');
  trigger.textContent = 'Open';
  document.body.append(trigger);
  trigger.focus();
  const cancel = jest.fn();
  const { unmount } = render(<ConfirmDialog open title="Confirm change" description="Review this change" confirmLabel="Apply" onCancel={cancel} onConfirm={jest.fn()} />);
  const back = screen.getByRole('button', { name: 'Go back' });
  const apply = screen.getByRole('button', { name: 'Apply' });
  expect(back).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab', shiftKey: true });
  expect(apply).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Tab' });
  expect(back).toHaveFocus();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(cancel).toHaveBeenCalledTimes(1);
  expect(trigger.inert).toBe(true);
  unmount();
  expect(trigger).toHaveFocus();
  expect(trigger.inert).not.toBe(true);
  trigger.remove();
});
