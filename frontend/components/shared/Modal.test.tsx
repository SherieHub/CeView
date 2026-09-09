import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import Modal from './Modal';
import { OverlayStackProvider } from './useOverlayStack';

describe('Modal variants', () => {
  it('defaults to the centred panel', () => {
    const { container } = render(
      <OverlayStackProvider>
        <Modal open onClose={vi.fn()} title="T"><p>body</p></Modal>
      </OverlayStackProvider>,
    );
    expect(container.querySelector('.modal-panel')).not.toBeNull();
    expect(container.querySelector('.modal-panel--full')).toBeNull();
  });

  it('renders full-screen without the default chrome when asked', () => {
    const { container } = render(
      <OverlayStackProvider>
        <Modal open onClose={vi.fn()} variant="full" label="Publish"><p>body</p></Modal>
      </OverlayStackProvider>,
    );
    expect(container.querySelector('.modal-panel--full')).not.toBeNull();
    expect(screen.getByRole('dialog', { name: 'Publish' })).toBeTruthy();
  });
});
